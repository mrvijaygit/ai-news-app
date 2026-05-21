const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadConfig(env = process.env) {
  const config = {
    nodeEnv: env.NODE_ENV || 'development',
    logLevel: env.LOG_LEVEL || 'info',
    cronSchedule: env.CRON_SCHEDULE || '0 * * * *',
    runOnStart: bool(env.RUN_ON_START, true),
    exitAfterRun: bool(env.EXIT_AFTER_RUN, false),
    dryRun: bool(env.DRY_RUN, false),
    maxItemAgeHours: int(env.MAX_ITEM_AGE_HOURS, 48),
    seenStorePath: path.resolve(process.cwd(), env.SEEN_STORE_PATH || 'storage/seen-news.json'),
    officialFeedsEnabled: bool(env.OFFICIAL_FEEDS_ENABLED, true),
    email: {
      enabled: bool(env.EMAIL_ENABLED, true),
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: env.EMAIL_TO
    },
    smtp: {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: int(env.SMTP_PORT, 465),
      secure: bool(env.SMTP_SECURE, true),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    reddit: {
      enabled: bool(env.REDDIT_ENABLED, false),
      query: env.REDDIT_QUERY || '(OpenAI OR Anthropic OR Gemini OR DeepMind)',
      limit: int(env.REDDIT_LIMIT, 10)
    },
    hackerNews: {
      enabled: bool(env.HN_ENABLED, false),
      query: env.HN_QUERY || 'OpenAI Anthropic Gemini DeepMind',
      limit: int(env.HN_LIMIT, 20)
    },
    telegram: {
      enabled: bool(env.TELEGRAM_ENABLED, false),
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID
    },
    aiSummariesEnabled: bool(env.AI_SUMMARIES_ENABLED, false)
  };

  return config;
}

function validateConfig(config) {
  const errors = [];

  if (config.email.enabled && !config.dryRun) {
    for (const [name, value] of [
      ['SMTP_USER', config.smtp.user],
      ['SMTP_PASS', config.smtp.pass],
      ['EMAIL_FROM', config.email.from],
      ['EMAIL_TO', config.email.to]
    ]) {
      if (!value) {
        errors.push(`${name} is required when EMAIL_ENABLED=true and DRY_RUN=false`);
      }
    }
  }

  if (config.telegram.enabled) {
    if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required when TELEGRAM_ENABLED=true');
    if (!config.telegram.chatId) errors.push('TELEGRAM_CHAT_ID is required when TELEGRAM_ENABLED=true');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration error:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = {
  loadConfig,
  validateConfig
};
