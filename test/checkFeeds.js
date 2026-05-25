/**
 * Feed health-check script.
 * Usage: node test/checkFeeds.js
 *
 * Tests every feed URL in DEFAULT_FEEDS with two user-agents:
 *   1. The current bot UA
 *   2. A browser-like UA
 *
 * For Perplexity specifically, also probes alternative URLs.
 */

const BOT_UA = 'ai-news-monitoring-agent/1.0 (+personal use)';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PERPLEXITY_ALTS = [
  'https://www.perplexity.ai/hub/blog/rss.xml',   // current — likely 403
  'https://blog.perplexity.ai/rss',
  'https://blog.perplexity.ai/feed',
  'https://www.perplexity.ai/hub/blog',            // HTML page itself
];

// Inline the feed list so the script is self-contained even if rssService changes.
const { DEFAULT_FEEDS } = require('../src/services/rssService');

async function probe(url, ua, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body = await res.text();
    const preview = body.slice(0, 120).replace(/\s+/g, ' ').trim();
    return { status: res.status, ok: res.ok, preview };
  } catch (err) {
    clearTimeout(timer);
    return { status: null, ok: false, preview: err.message };
  }
}

function label(name, url) {
  return `${name.padEnd(28)} ${url}`;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Feed health check');
  console.log('='.repeat(80));

  const broken = [];

  // ── 1. Test every feed in DEFAULT_FEEDS ──────────────────────────────────────
  for (const feed of DEFAULT_FEEDS) {
    const urls = [feed.feedUrl, feed.pageUrl].filter(Boolean);
    for (const url of urls) {
      const [bot, browser] = await Promise.all([
        probe(url, BOT_UA),
        probe(url, BROWSER_UA),
      ]);

      const botTag   = bot.ok   ? `✓ ${bot.status}`   : `✗ ${bot.status ?? 'ERR'}`;
      const browTag  = browser.ok ? `✓ ${browser.status}` : `✗ ${browser.status ?? 'ERR'}`;

      const isBroken = !bot.ok && !browser.ok;
      if (isBroken) broken.push({ source: feed.source, url });

      const marker = isBroken ? '  !! BROKEN !!' : '';
      console.log(`\n  [${feed.source}]${marker}`);
      console.log(`    URL    : ${url}`);
      console.log(`    bot-UA : ${botTag}  | preview: ${bot.preview.slice(0, 80)}`);
      console.log(`    browser: ${browTag}  | preview: ${browser.preview.slice(0, 80)}`);
    }
  }

  // ── 2. Perplexity alternative probes ────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('Perplexity alternative URL probes');
  console.log('='.repeat(80));

  for (const url of PERPLEXITY_ALTS) {
    const [bot, browser] = await Promise.all([
      probe(url, BOT_UA),
      probe(url, BROWSER_UA),
    ]);
    const botTag  = bot.ok   ? `✓ ${bot.status}`   : `✗ ${bot.status ?? 'ERR'}`;
    const browTag = browser.ok ? `✓ ${browser.status}` : `✗ ${browser.status ?? 'ERR'}`;

    console.log(`\n  URL    : ${url}`);
    console.log(`  bot-UA : ${botTag}  | preview: ${bot.preview.slice(0, 100)}`);
    console.log(`  browser: ${browTag}  | preview: ${browser.preview.slice(0, 100)}`);
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('Summary of broken feeds (neither UA worked)');
  console.log('='.repeat(80));
  if (broken.length === 0) {
    console.log('  All feeds responded OK with at least one UA.');
  } else {
    for (const b of broken) {
      console.log(`  !! ${b.source}: ${b.url}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
