const { sortByPublishedDesc } = require('../utils/itemUtils');
const { filterByKeywords } = require('./relevanceFilter');
const { scoreWithAI, filterByAiScore } = require('./relevanceScorer');

function filterRecentItems(items, maxItemAgeHours) {
  if (!maxItemAgeHours || maxItemAgeHours <= 0) {
    return items;
  }
  const cutoff = Date.now() - maxItemAgeHours * 60 * 60 * 1000;
  return items.filter((item) => {
    // Items with no publish date (common from HTML scrapers) are assumed recent
    // and passed through — the seen-store deduplication handles them correctly.
    if (!item.publishedAt) return true;
    const value = Date.parse(item.publishedAt);
    return Number.isNaN(value) || value >= cutoff;
  });
}

async function runNewsMonitor({
  fetchers,
  store,
  notifiers,
  logger = console,
  maxItemAgeHours = 48,
  persistSeen = true,
  config = null
}) {
  const fetched = [];
  const feedHealth = [];

  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      const items = Array.isArray(result) ? result : (result.items || []);
      const health = Array.isArray(result) ? [] : (result.health || []);
      fetched.push(...items);
      feedHealth.push(...health);
    } catch (error) {
      logger.error(`Source fetch failed: ${error.message}`);
    }
  }

  // Prune old seen IDs (only when config is provided and store supports it)
  if (config && persistSeen && store.prune) {
    const pruned = await store.prune(config.seenStore?.maxAgeDays ?? 60);
    if (pruned > 0) logger.info(`Pruned ${pruned} old seen ID(s) from store.`);
  }

  const recentItems = filterRecentItems(fetched, maxItemAgeHours);

  // Keyword relevance filter (only when config explicitly enables it)
  let relevantItems = recentItems;
  if (config?.relevanceFilter?.enabled) {
    const before = relevantItems.length;
    relevantItems = filterByKeywords(recentItems);
    const removed = before - relevantItems.length;
    if (removed > 0) logger.info(`Keyword filter removed ${removed} low-relevance item(s).`);
  }

  // AI scoring (only when config enables it and API key is present)
  if (config?.aiSummariesEnabled && config?.anthropicApiKey) {
    try {
      relevantItems = await scoreWithAI(relevantItems, config, logger);
      relevantItems = filterByAiScore(relevantItems, config.relevanceFilter?.minScore ?? 0.5);
    } catch (error) {
      logger.error(`AI scoring failed: ${error.message}`);
    }
  }

  const newItems = sortByPublishedDesc(await store.filterUnseen(relevantItems));
  const failedFeeds = feedHealth.filter((h) => h.status === 'error');

  if (newItems.length === 0) {
    logger.info(`No new AI news found. Checked ${fetched.length} item(s), ${recentItems.length} recent, ${relevantItems.length} relevant.`);

    // Send health-only alert when feeds are broken and no news was found
    if (failedFeeds.length > 0 && notifiers.length > 0) {
      for (const notifier of notifiers) {
        await notifier([], { failedFeeds });
      }
    }

    return {
      fetchedCount: fetched.length,
      recentCount: recentItems.length,
      newCount: 0,
      feedHealth
    };
  }

  logger.info(`Found ${newItems.length} new AI news item(s). Sending notifications.`);

  for (const notifier of notifiers) {
    await notifier(newItems, { failedFeeds });
  }

  if (persistSeen) {
    await store.markSeen(newItems);
  } else {
    logger.info('Skipping seen-store update because persistence is disabled.');
  }

  return {
    fetchedCount: fetched.length,
    recentCount: recentItems.length,
    newCount: newItems.length,
    persisted: persistSeen,
    items: newItems,
    feedHealth
  };
}

module.exports = {
  filterRecentItems,
  runNewsMonitor
};
