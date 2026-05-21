# AI News Agent Design

## Goal

Build a free, lightweight Node.js agent that checks AI company news hourly, detects newly published items, avoids duplicate notifications, and sends concise alerts through Gmail SMTP. Optional Reddit, Hacker News, Telegram, and AI-summary support are controlled by environment variables and disabled by default.

## Architecture

The app is a local Node.js CLI/service. `src/index.js` loads configuration, creates the monitoring dependencies, and either runs once or starts an hourly `node-cron` schedule. Source services fetch and normalize items into a shared shape, storage tracks already-seen IDs in JSON, and notification services send email or Telegram alerts only for unseen posts.

## Components

- `src/utils/config.js`: Reads `.env`, applies defaults, validates required notification settings.
- `src/utils/logger.js`: Small timestamped logger.
- `src/utils/itemUtils.js`: Generates stable IDs and concise summaries.
- `src/services/rssService.js`: Fetches official RSS feeds with `rss-parser`.
- `src/services/redditService.js`: Optional RSS-based Reddit search monitoring.
- `src/services/hackerNewsService.js`: Optional public Algolia HN API keyword monitoring.
- `src/services/newsMonitor.js`: Orchestrates all enabled fetchers, de-duplicates, sends notifications, and updates storage.
- `src/storage/seenStore.js`: JSON-backed seen-ID storage with atomic writes.
- `src/mail/emailService.js`: Gmail SMTP alerts via `nodemailer`.
- `src/mail/telegramService.js`: Optional Telegram Bot API alerts through built-in `fetch`.
- `src/scheduler/newsScheduler.js`: Hourly cron scheduling.

## Data Flow

1. Load enabled sources from `.env`.
2. Fetch official feeds and optional bonus sources.
3. Normalize each article to `id`, `company`, `title`, `publishedAt`, `summary`, `link`, and `source`.
4. Load seen IDs from `storage/seen-news.json`.
5. Filter unseen items.
6. Send a grouped concise email and optional Telegram alert.
7. Mark successfully processed items as seen.

## Error Handling

Each source fetch is isolated and logged, so one broken feed does not stop the whole run. Missing storage is created automatically. Notification errors are logged and re-thrown so the scheduler can report failed runs without corrupting state.

## Testing

Use Node's built-in test runner. Tests cover item ID stability, summary formatting, JSON seen-store behavior, email formatting, and monitor de-duplication.

## Deployment

The README will document local usage, Gmail app password setup, GitHub Actions hourly runs, and Railway-style long-running deployment. GitHub Actions state persistence is documented as optional and limited because file storage is simplest for local/Railway usage.
