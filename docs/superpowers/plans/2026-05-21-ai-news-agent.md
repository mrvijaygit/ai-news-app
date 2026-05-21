# AI News Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete free Node.js AI news monitoring agent with hourly scheduling, RSS fetching, JSON duplicate tracking, Gmail alerts, optional Reddit/Hacker News/Telegram modules, and setup docs.

**Architecture:** A small Node.js service loads `.env` configuration, fetches normalized news items from enabled sources, filters them through JSON-backed seen storage, and sends concise notifications. The app can run once for dry runs or stay resident under `node-cron` for hourly checks.

**Tech Stack:** Node.js, `rss-parser`, `nodemailer`, `node-cron`, `dotenv`, built-in `node:test`, JSON file storage.

---

## File Map

- `package.json`: Scripts, dependencies, CommonJS package metadata.
- `.env.example`: All required and optional environment variables.
- `README.md`: Setup, Gmail app password, local usage, deployment, and troubleshooting.
- `storage/seen-news.sample.json`: Example JSON storage shape.
- `.github/workflows/news-monitor.yml`: Optional GitHub Actions scheduled runner.
- `src/index.js`: Application entrypoint.
- `src/utils/config.js`: Environment config parsing and validation.
- `src/utils/logger.js`: Timestamped logging.
- `src/utils/itemUtils.js`: Stable IDs, summary generation, date sorting.
- `src/storage/seenStore.js`: JSON store for seen IDs.
- `src/services/rssService.js`: Official RSS source fetching.
- `src/services/redditService.js`: Optional Reddit RSS search.
- `src/services/hackerNewsService.js`: Optional HN Algolia keyword fetch.
- `src/services/newsMonitor.js`: Orchestration and notification flow.
- `src/mail/emailService.js`: Gmail email formatting/sending.
- `src/mail/telegramService.js`: Optional Telegram notifications.
- `src/scheduler/newsScheduler.js`: Cron wrapper.
- `test/*.test.js`: Core behavior tests.

## Tasks

### Task 1: Project Scaffolding

- [ ] Create `package.json`, `.env.example`, sample storage, and docs skeleton.
- [ ] Add Node test script and start scripts.

### Task 2: Core Utilities via TDD

- [ ] Write failing tests for stable IDs, concise summaries, and date sorting.
- [ ] Implement `src/utils/itemUtils.js`.
- [ ] Run tests and verify they pass.

### Task 3: JSON Seen Storage via TDD

- [ ] Write failing tests for missing-file initialization, unseen filtering, and marking IDs seen.
- [ ] Implement `src/storage/seenStore.js`.
- [ ] Run tests and verify they pass.

### Task 4: Notification Formatting via TDD

- [ ] Write failing tests for concise email subject/text/html formatting.
- [ ] Implement `src/mail/emailService.js`.
- [ ] Run tests and verify they pass.

### Task 5: Monitoring Orchestration via TDD

- [ ] Write failing tests proving only unseen items notify and are marked seen.
- [ ] Implement `src/services/newsMonitor.js`.
- [ ] Run tests and verify they pass.

### Task 6: Source Services and Scheduler

- [ ] Implement official RSS fetching, optional Reddit RSS, optional Hacker News API, Telegram, config, logger, scheduler, and entrypoint.
- [ ] Keep optional modules disabled unless env flags are true.

### Task 7: Documentation and Deployment

- [ ] Complete README with local, Gmail, GitHub Actions, and Railway instructions.
- [ ] Add GitHub Actions workflow example.

### Task 8: Verification

- [ ] Install dependencies.
- [ ] Run `npm test`.
- [ ] Run `npm run dry-run`.
