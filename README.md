# AI News Monitoring Agent

A lightweight, free Node.js agent that checks AI news, detects newly published posts, avoids duplicate alerts with JSON file storage, and sends concise Gmail email notifications.

It monitors:

- OpenAI
- Anthropic
- Google AI / Gemini / DeepMind

Optional `.env` flags can also enable Reddit, Hacker News, and Telegram notifications.

## Features

- Runs automatically every hour with `node-cron`
- Fetches official RSS feeds with `rss-parser`
- Detects new posts by stable IDs
- Saves seen items in `storage/seen-news.json`
- Sends Gmail SMTP alerts with `nodemailer`
- Generates concise extractive summaries for free
- Optional Reddit AI news monitoring
- Optional Hacker News keyword monitoring
- Optional Telegram notification support
- Beginner-friendly local setup, no database, no paid API

## Requirements

- Node.js 18 or newer
- A Gmail account
- A Gmail app password for SMTP

## Setup

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM="AI News Agent <your-gmail-address@gmail.com>"
EMAIL_TO=recipient@example.com
```

## Gmail App Password

Gmail SMTP requires an app password, not your normal Gmail password.

1. Enable 2-Step Verification on your Google account.
2. Open Google Account security settings.
3. Create an app password for Mail.
4. Put that generated password in `SMTP_PASS`.

## Run Locally

Run once immediately, then continue hourly:

```bash
npm start
```

Run a safe dry run without sending email:

```bash
npm run dry-run
```

Dry runs use in-memory duplicate tracking, so you can preview behavior without creating or changing `storage/seen-news.json`.

Run tests:

```bash
npm test
```

## Environment Variables

Core settings:

```env
CRON_SCHEDULE=0 * * * *
RUN_ON_START=true
EXIT_AFTER_RUN=false
DRY_RUN=false
MAX_ITEM_AGE_HOURS=48
SEEN_STORE_PATH=storage/seen-news.json
```

Email:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM="AI News Agent <your-gmail-address@gmail.com>"
EMAIL_TO=recipient@example.com
```

Optional Reddit:

```env
REDDIT_ENABLED=true
REDDIT_QUERY=(OpenAI OR Anthropic OR Gemini OR DeepMind)
REDDIT_LIMIT=10
```

Optional Hacker News:

```env
HN_ENABLED=true
HN_QUERY=OpenAI Anthropic Gemini DeepMind
HN_LIMIT=20
```

Optional Telegram:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

## How Duplicate Prevention Works

The agent stores sent item IDs in `storage/seen-news.json`.

When a run starts:

1. It fetches latest items from enabled sources.
2. It compares item IDs with the JSON store.
3. It sends notifications only for unseen items.
4. It marks successfully notified items as seen.

The local storage file is intentionally ignored by Git so private runtime state is not committed.

## Source Notes

Configured official sources:

- `https://openai.com/news/rss.xml`
- `https://www.anthropic.com/news` through an official-page fallback because Anthropic may not expose a stable RSS endpoint
- `https://blog.google/technology/ai/rss/`

The requested pages are:

- `https://openai.com/news/`
- `https://www.anthropic.com/news`
- `https://blog.google/technology/ai/`

RSS feed URLs can change. If a feed fails, the agent logs the error and continues with other sources.

## Free Deployment Option: Railway

Railway-style deployment is the best fit for this project because the app is a long-running scheduled process and JSON storage works naturally on a persistent service.

1. Push this project to GitHub.
2. Create a Railway project from the GitHub repository.
3. Add the same variables from `.env` in Railway variables.
4. Use this start command:

```bash
npm start
```

5. Ensure the service does not run in dry-run mode:

```env
DRY_RUN=false
EXIT_AFTER_RUN=false
RUN_ON_START=true
```

Free tier availability and limits can change, so check Railway's current policy before relying on it for production alerts.

## Recommended Free Deployment: GitHub Actions

The workflow at `.github/workflows/news-monitor.yml` runs once every hour and can also be started manually from the GitHub Actions tab.

### 1. Push to GitHub

Create a GitHub repository and push this project:

```bash
git init
git add .
git commit -m "initial AI news monitoring agent"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Add Repository Secrets

In GitHub, open:

```text
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Add these repository secrets:

- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_TO`

Optional Telegram secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### 3. Optional Repository Variables

In:

```text
Repository -> Settings -> Secrets and variables -> Actions -> Variables
```

You can add:

- `MAX_ITEM_AGE_HOURS`: defaults to `48`
- `REDDIT_ENABLED`: `true` or `false`
- `HN_ENABLED`: `true` or `false`
- `TELEGRAM_ENABLED`: `true` or `false`

### 4. Enable Actions and Run Once

Open the GitHub Actions tab, choose `AI News Monitor`, and click `Run workflow`.

After a successful run, the workflow commits `storage/seen-news.json` back to the repository. This is how duplicate prevention persists between GitHub Actions runs. The file is force-added by the workflow because it is ignored for local development.

### 5. Hourly Schedule

The workflow uses:

```yaml
schedule:
  - cron: "0 * * * *"
```

GitHub schedules run in UTC. Scheduled runs may be delayed during GitHub load, but hourly monitoring is fine for this project.

## Project Structure

```text
src/
  index.js
  mail/
  scheduler/
  services/
  storage/
  utils/
storage/
  seen-news.sample.json
test/
docs/
```

## Troubleshooting

`Configuration error`: Check missing `.env` values. In `DRY_RUN=true`, Gmail credentials are not required.

`Invalid login`: Use a Gmail app password, not your normal Gmail password.

`No new AI news found`: The agent is working, but all fetched items were already in the seen store.

`Feed failed`: RSS URLs can change. Update the feed URL in `src/services/rssService.js` if an official feed moves.
