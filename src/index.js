const { loadConfig, validateConfig } = require('./utils/config');
const { createLogger } = require('./utils/logger');
const { SeenStore } = require('./storage/seenStore');
const { createRssFetcher } = require('./services/rssService');
const { createRedditFetcher } = require('./services/redditService');
const { createHackerNewsFetcher } = require('./services/hackerNewsService');
const { runNewsMonitor } = require('./services/newsMonitor');
const { sendEmailAlert } = require('./mail/emailService');
const { sendTelegramAlert } = require('./mail/telegramService');
const { startNewsScheduler } = require('./scheduler/newsScheduler');

function buildFetchers(config, logger) {
  const fetchers = [];
  if (config.officialFeedsEnabled) {
    fetchers.push(createRssFetcher({ logger }));
  }
  if (config.reddit.enabled) {
    fetchers.push(createRedditFetcher({ config, logger }));
  }
  if (config.hackerNews.enabled) {
    fetchers.push(createHackerNewsFetcher({ config, logger }));
  }
  return fetchers;
}

function buildNotifiers(config, logger) {
  const notifiers = [];
  if (config.email.enabled) {
    notifiers.push((items, meta) => sendEmailAlert(items, config, logger, meta));
  }
  if (config.telegram.enabled) {
    notifiers.push((items) => sendTelegramAlert(items, config, logger));
  }
  return notifiers;
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  validateConfig(config);

  if (config.aiSummariesEnabled) {
    logger.warn('AI_SUMMARIES_ENABLED=true is set, but no paid API integration is used. Free extractive summaries remain active.');
  }

  const store = config.dryRun
    ? {
        filterUnseen: async (items) => items,
        markSeen: async () => {}
      }
    : new SeenStore(config.seenStorePath);
  const fetchers = buildFetchers(config, logger);
  const notifiers = buildNotifiers(config, logger);

  if (fetchers.length === 0) {
    throw new Error('No news sources enabled. Enable OFFICIAL_FEEDS_ENABLED, REDDIT_ENABLED, or HN_ENABLED.');
  }
  if (notifiers.length === 0) {
    logger.warn('No notifiers enabled. The agent will fetch and store seen IDs but will not send alerts.');
  }

  const task = () => runNewsMonitor({
    fetchers,
    store,
    notifiers,
    logger,
    maxItemAgeHours: config.maxItemAgeHours,
    persistSeen: !config.dryRun,
    config
  });

  if (config.runOnStart) {
    await task();
  }

  if (config.exitAfterRun) {
    setImmediate(() => process.exit(0));
    return;
  }

  startNewsScheduler({
    schedule: config.cronSchedule,
    task,
    logger
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildFetchers,
  buildNotifiers,
  main
};
