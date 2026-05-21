const { sortByPublishedDesc } = require('../utils/itemUtils');

function filterRecentItems(items, maxItemAgeHours) {
  if (!maxItemAgeHours || maxItemAgeHours <= 0) {
    return items;
  }

  const cutoff = Date.now() - maxItemAgeHours * 60 * 60 * 1000;
  return items.filter((item) => {
    const value = Date.parse(item.publishedAt || '');
    return !Number.isNaN(value) && value >= cutoff;
  });
}

async function runNewsMonitor({
  fetchers,
  store,
  notifiers,
  logger = console,
  maxItemAgeHours = 48,
  persistSeen = true
}) {
  const fetched = [];

  for (const fetcher of fetchers) {
    try {
      const items = await fetcher();
      fetched.push(...items);
    } catch (error) {
      logger.error(`Source fetch failed: ${error.message}`);
    }
  }

  const recentItems = filterRecentItems(fetched, maxItemAgeHours);
  const newItems = sortByPublishedDesc(await store.filterUnseen(recentItems));

  if (newItems.length === 0) {
    logger.info(`No new AI news found. Checked ${fetched.length} fetched item(s), ${recentItems.length} recent item(s).`);
    return {
      fetchedCount: fetched.length,
      recentCount: recentItems.length,
      newCount: 0
    };
  }

  logger.info(`Found ${newItems.length} new AI news item(s). Sending notifications.`);

  for (const notifier of notifiers) {
    await notifier(newItems);
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
    items: newItems
  };
}

module.exports = {
  filterRecentItems,
  runNewsMonitor
};
