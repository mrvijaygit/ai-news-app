const Parser = require('rss-parser');
const { createStableId, summarizeText } = require('../utils/itemUtils');

// ─── HTML helpers ────────────────────────────────────────────────────────────

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...');
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function resolveUrl(href, baseUrl) {
  if (!href) return baseUrl;
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const clean = value.trim();
  // Try UTC-normalized first so bare date strings ("Apr 16, 2026") become midnight UTC.
  // Appending " UTC" breaks ISO strings that already have a "Z" or offset, causing NaN,
  // so we fall back to native parsing which handles those correctly.
  const withUtc = Date.parse(`${clean} UTC`);
  if (!Number.isNaN(withUtc)) return new Date(withUtc).toISOString();
  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

// ─── Site-specific HTML parsers ───────────────────────────────────────────────

function parseAnthropicNewsPage(html, feed = { company: 'Anthropic', source: 'Anthropic News' }) {
  const items = [];
  const linkRegex = /<a href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  const seen = new Set();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, path, cardHtml] = match;
    if (seen.has(path)) continue;
    seen.add(path);

    const titleMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const title = stripTags(titleMatch?.[1] || '');

    if (!title) continue;

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: `https://www.anthropic.com${path}`
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  return items;
}

function parseMistralNewsPage(html, feed) {
  const items = [];
  const seen = new Set();
  const linkRegex = /<a[^>]+href="(\/(?:news|fr\/actualites)\/[^"?#]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, path, cardHtml] = match;
    if (seen.has(path)) continue;
    seen.add(path);

    const titleMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const title = stripTags(titleMatch?.[1] || '');
    if (!title) continue;

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: `https://mistral.ai${path}`
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  return items;
}

function parseXaiPage(html, feed) {
  const items = [];
  const seen = new Set();
  const linkRegex = /<a[^>]+href="(\/blog\/[^"?#]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, path, cardHtml] = match;
    if (seen.has(path)) continue;
    seen.add(path);

    const titleMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const title = stripTags(titleMatch?.[1] || '');
    if (!title) continue;

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: `https://x.ai${path}`
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  return items;
}

// Generic parser for modern blog pages with <article> tags or <h2>/<h3>+link patterns
function parseGenericBlogPage(html, feed) {
  const items = [];
  const seen = new Set();

  function pushItem(title, link, dateStr, summaryStr) {
    const resolved = resolveUrl(link, feed.pageUrl);
    if (seen.has(resolved) || !title || title.length < 5) return;
    seen.add(resolved);
    const normalized = {
      company: feed.company,
      source: feed.source,
      title: stripTags(title),
      publishedAt: normalizeDate(stripTags(dateStr || '')),
      summary: summarizeText(stripTags(summaryStr || title)),
      link: resolved
    };
    items.push({ ...normalized, id: createStableId(normalized) });
  }

  // Pattern 1: <article> blocks
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let match;
  let usedArticles = false;

  while ((match = articleRegex.exec(html)) !== null) {
    usedArticles = true;
    const block = match[1];
    const titleMatch = block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const linkMatch = block.match(/href="([^"]+)"/);
    const dateMatch = block.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (!titleMatch) continue;
    pushItem(titleMatch[1], linkMatch?.[1], dateMatch?.[1], summaryMatch?.[1]);
  }

  if (usedArticles) return items;

  // Pattern 2: <h2> or <h3> containing <a> — common in WordPress, Ghost
  const headingRegex = /<h[23][^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/g;
  while ((match = headingRegex.exec(html)) !== null) {
    const [, href, rawTitle] = match;
    const afterHead = html.slice(match.index, match.index + 1200);
    const dateMatch = afterHead.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = afterHead.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    pushItem(rawTitle, href, dateMatch?.[1], summaryMatch?.[1]);
  }

  return items;
}

// ─── RSS item normaliser ──────────────────────────────────────────────────────

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

// ─── Feed registry ────────────────────────────────────────────────────────────

const DEFAULT_FEEDS = [
  // ── Core AI Labs ──────────────────────────────────────────────────────────
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
    htmlFallback: true,
    parseHtml: parseAnthropicNewsPage
  },
  {
    company: 'Google AI / Gemini',
    source: 'Google AI Blog',
    feedUrl: 'https://blog.google/technology/ai/rss/',
    pageUrl: 'https://blog.google/technology/ai/'
  },
  {
    company: 'Google DeepMind',
    source: 'Google DeepMind Blog',
    feedUrl: 'https://deepmind.google/blog/rss/',
    pageUrl: 'https://deepmind.google/blog/',
    htmlFallback: true
  },
  {
    company: 'Meta AI',
    source: 'Meta AI Blog',
    feedUrl: 'https://ai.meta.com/blog/rss/',
    pageUrl: 'https://ai.meta.com/blog/',
    htmlFallback: true
  },
  {
    company: 'Mistral AI',
    source: 'Mistral AI News',
    feedUrl: 'https://mistral.ai/news/rss.xml',
    pageUrl: 'https://mistral.ai/news/',
    htmlFallback: true,
    parseHtml: parseMistralNewsPage
  },
  {
    company: 'xAI',
    source: 'xAI Blog',
    feedUrl: 'https://x.ai/blog/rss.xml',
    pageUrl: 'https://x.ai/blog',
    htmlFallback: true,
    parseHtml: parseXaiPage
  },
  // ── Big Tech AI ───────────────────────────────────────────────────────────
  {
    company: 'Microsoft AI',
    source: 'Microsoft AI Blog',
    feedUrl: 'https://blogs.microsoft.com/ai/feed/',
    pageUrl: 'https://blogs.microsoft.com/ai/'
  },
  {
    company: 'AWS AI',
    source: 'AWS Machine Learning Blog',
    feedUrl: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    pageUrl: 'https://aws.amazon.com/blogs/machine-learning/'
  },
  {
    company: 'NVIDIA AI',
    source: 'NVIDIA Technical Blog',
    feedUrl: 'https://developer.nvidia.com/blog/feed/',
    pageUrl: 'https://developer.nvidia.com/blog/'
  },
  // ── AI Ecosystem ──────────────────────────────────────────────────────────
  {
    company: 'Hugging Face',
    source: 'Hugging Face Blog',
    feedUrl: 'https://huggingface.co/blog/feed.xml',
    pageUrl: 'https://huggingface.co/blog'
  },
  {
    company: 'Cohere',
    source: 'Cohere Blog',
    feedUrl: 'https://cohere.com/blog/rss.xml',
    pageUrl: 'https://cohere.com/blog',
    htmlFallback: true
  },
  {
    company: 'Perplexity AI',
    source: 'Perplexity Blog',
    feedUrl: 'https://www.perplexity.ai/hub/blog/rss.xml',
    pageUrl: 'https://www.perplexity.ai/hub/blog',
    htmlFallback: true
  }
];

// ─── Fetcher factory ──────────────────────────────────────────────────────────

function createRssFetcher({ feeds = DEFAULT_FEEDS, logger = console } = {}) {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'ai-news-monitoring-agent/1.0 (+personal use)'
    }
  });

  return async function fetchRssNews() {
    const allItems = [];
    const health = [];

    for (const feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.feedUrl);
        const items = (parsed.items || []).map((item) => normalizeRssItem(item, feed));
        logger.info(`Fetched ${items.length} item(s) from ${feed.source}.`);
        allItems.push(...items);
        health.push({ source: feed.source, status: 'ok', count: items.length });
      } catch (error) {
        if (!feed.htmlFallback) {
          logger.error(`Failed to fetch ${feed.source}: ${error.message}`);
          health.push({ source: feed.source, status: 'error', error: error.message });
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
          const parseFn = feed.parseHtml
            ? (h) => feed.parseHtml(h, feed)
            : (h) => parseGenericBlogPage(h, feed);
          const items = parseFn(html);
          logger.info(`Fetched ${items.length} item(s) from ${feed.source} via HTML fallback.`);
          allItems.push(...items);
          health.push({ source: feed.source, status: 'ok', count: items.length, method: 'html-fallback' });
        } catch (fallbackError) {
          logger.error(`HTML fallback also failed for ${feed.source}: ${fallbackError.message}`);
          health.push({ source: feed.source, status: 'error', error: fallbackError.message });
        }
      }
    }

    return { items: allItems, health };
  };
}

module.exports = {
  DEFAULT_FEEDS,
  createRssFetcher,
  normalizeRssItem,
  parseAnthropicNewsPage,
  parseGenericBlogPage,
  parseMistralNewsPage,
  parseXaiPage
};
