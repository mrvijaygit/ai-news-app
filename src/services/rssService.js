const Parser = require('rss-parser');
const { createStableId, summarizeText } = require('../utils/itemUtils');

const DEFAULT_FEEDS = [
  {
    company: 'OpenAI',
    source: 'OpenAI News',
    feedUrl: 'https://openai.com/news/rss.xml',
    pageUrl: 'https://openai.com/news/'
  },
  {
    company: 'Anthropic',
    source: 'Anthropic News',
    feedUrl: 'https://www.anthropic.com/news/rss.xml',
    pageUrl: 'https://www.anthropic.com/news',
    htmlFallback: true
  },
  {
    company: 'Google AI / Gemini / DeepMind',
    source: 'Google AI Blog',
    feedUrl: 'https://blog.google/technology/ai/rss/',
    pageUrl: 'https://blog.google/technology/ai/'
  }
];

function normalizeRssItem(item, feed) {
  const normalized = {
    company: feed.company,
    source: feed.source,
    title: item.title || 'Untitled',
    publishedAt: item.isoDate || item.pubDate || null,
    summary: summarizeText(item.contentSnippet || item.content || item.summary || item.title || ''),
    link: item.link || feed.pageUrl
  };
  return {
    ...normalized,
    id: item.guid || createStableId(normalized)
  };
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeAnthropicDate(value) {
  const parsed = Date.parse(`${value} UTC`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function parseAnthropicNewsPage(html) {
  const items = [];
  const linkRegex = /<a href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  const seen = new Set();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, path, cardHtml] = match;
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);

    const titleMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const title = stripTags(titleMatch?.[1] || '');

    if (!title) {
      continue;
    }

    const normalized = {
      company: 'Anthropic',
      source: 'Anthropic News',
      title,
      publishedAt: normalizeAnthropicDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: `https://www.anthropic.com${path}`
    };

    items.push({
      ...normalized,
      id: createStableId(normalized)
    });
  }

  return items;
}

function createRssFetcher({ feeds = DEFAULT_FEEDS, logger = console } = {}) {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'ai-news-monitoring-agent/1.0 (+personal use)'
    }
  });

  return async function fetchRssNews() {
    const allItems = [];
    for (const feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.feedUrl);
        const items = (parsed.items || []).map((item) => normalizeRssItem(item, feed));
        logger.info(`Fetched ${items.length} item(s) from ${feed.source}.`);
        allItems.push(...items);
      } catch (error) {
        if (!feed.htmlFallback) {
          logger.error(`Failed to fetch ${feed.source}: ${error.message}`);
          continue;
        }

        try {
          logger.warn(`RSS failed for ${feed.source}; trying official page fallback.`);
          const response = await fetch(feed.pageUrl, {
            headers: { 'User-Agent': 'ai-news-monitoring-agent/1.0 (+personal use)' }
          });
          if (!response.ok) {
            throw new Error(`Status code ${response.status}`);
          }
          const html = await response.text();
          const items = parseAnthropicNewsPage(html);
          logger.info(`Fetched ${items.length} item(s) from ${feed.source} official page.`);
          allItems.push(...items);
        } catch (fallbackError) {
          logger.error(`Failed to fetch ${feed.source}: ${fallbackError.message}`);
        }
      }
    }
    return allItems;
  };
}

module.exports = {
  DEFAULT_FEEDS,
  createRssFetcher,
  normalizeRssItem,
  parseAnthropicNewsPage
};
