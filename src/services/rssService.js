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
  // xAI uses /news/ paths (not /blog/) and unquoted hrefs in some cases
  const linkRegex = /<a[^>]+href="(\/(?:news|blog)\/[^"?#]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
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

function parseDeepMindPage(html, feed) {
  // DeepMind uses <article class="card card-blog ..."> with an unquoted href on
  // the overlay-link anchor: href=/blog/slug or href=https://blog.google/...
  const items = [];
  const seen = new Set();

  const articleRegex = /<article[^>]*card-blog[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];

    // The overlay anchor has an unquoted href attribute
    const hrefMatch = block.match(/class=card__overlay-link[^>]+href=([^\s>"']+)/);
    const titleMatch = block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = block.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);

    const title = stripTags(titleMatch?.[1] || '');
    if (!title) continue;

    let rawHref = hrefMatch?.[1] || '';
    const link = rawHref.startsWith('http')
      ? rawHref
      : `https://deepmind.google${rawHref}`;

    if (seen.has(link)) continue;
    seen.add(link);

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  return items;
}

function parseMetaAIPage(html, feed) {
  // Meta AI blog uses full absolute href="https://ai.meta.com/blog/…" links.
  // The title text sits directly inside the <a> element (after stripping child tags).
  const items = [];
  const seen = new Set();

  // Match <a href="https://ai.meta.com/blog/SLUG">…title text…</a>
  const linkRegex = /<a[^>]+href="(https:\/\/ai\.meta\.com\/blog\/[^"?#]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, url, innerHtml] = match;
    if (seen.has(url)) continue;

    const title = stripTags(innerHtml).trim();
    // Skip navigation-style links (too short or containing only icons)
    if (!title || title.length < 10) continue;
    seen.add(url);

    // Look for a nearby date in the ~2 KB following this link
    const after = html.slice(match.index, match.index + 2000);
    const dateMatch = after.match(/(\w+ \d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})/);
    const summaryMatch = after.match(/<p[^>]*>([\s\S]*?)<\/p>/);

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(dateMatch?.[1] || ''),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: url
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  return items;
}

async function parseCohereFromSitemap(feed) {
  // Cohere's RSS URL silently redirects to their HTML page (not valid XML) and their
  // blog listing page is JS-rendered with only a single visible link.  The sitemap at
  // /sitemap.xml contains every post URL plus a <lastmod> date and is reliably fetchable.
  const SITEMAP_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const sitemapRes = await fetch('https://cohere.com/sitemap.xml', {
    headers: { 'User-Agent': SITEMAP_UA }
  });
  if (!sitemapRes.ok) throw new Error(`Cohere sitemap returned ${sitemapRes.status}`);
  const xml = await sitemapRes.text();

  const items = [];
  const seen = new Set();

  // Parse <url> blocks that contain /blog/ paths
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let block;

  while ((block = urlBlockRegex.exec(xml)) !== null) {
    const inner = block[1];
    const locMatch = inner.match(/<loc>(https:\/\/cohere\.com\/blog\/[^<]+)<\/loc>/);
    if (!locMatch) continue;
    const link = locMatch[1].trim();
    if (seen.has(link)) continue;
    seen.add(link);

    const lastmodMatch = inner.match(/<lastmod>([^<]+)<\/lastmod>/);
    // Derive a human-readable title from the slug
    const slug = link.split('/blog/')[1] || '';
    const title = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(lastmodMatch?.[1] || ''),
      summary: summarizeText(title),
      link
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  // Sort by date descending and return the most recent 50
  items.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });

  return items.slice(0, 50);
}

async function parseMistralFromSitemap(feed) {
  // Mistral's news listing is heavily JS-rendered (only 1 item visible in HTML).
  // Their sitemap at /sitemap-0.xml enumerates all /news/* URLs with lastmod dates.
  const SITEMAP_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const sitemapRes = await fetch('https://mistral.ai/sitemap-0.xml', {
    headers: { 'User-Agent': SITEMAP_UA }
  });
  if (!sitemapRes.ok) throw new Error(`Mistral sitemap returned ${sitemapRes.status}`);
  const xml = await sitemapRes.text();

  const items = [];
  const seen = new Set();

  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let block;

  while ((block = urlBlockRegex.exec(xml)) !== null) {
    const inner = block[1];
    // Only English /news/ paths (skip /fr/, /it/, /de/ duplicates)
    const locMatch = inner.match(/<loc>(https:\/\/mistral\.ai\/news\/[^<]+)<\/loc>/);
    if (!locMatch) continue;
    const link = locMatch[1].trim();
    if (seen.has(link)) continue;
    seen.add(link);

    const lastmodMatch = inner.match(/<lastmod>([^<]+)<\/lastmod>/);
    const slug = link.split('/news/')[1] || '';
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(lastmodMatch?.[1] || ''),
      summary: summarizeText(title),
      link
    };

    items.push({ ...normalized, id: createStableId(normalized) });
  }

  // Sort by date descending, keep the most recent 50
  items.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });

  return items.slice(0, 50);
}

function parsePerplexityPage(html, feed) {
  // Perplexity's blog (hosted on Framer) uses <a href="/hub/blog/SLUG">
  const items = [];
  const seen = new Set();
  const linkRegex = /<a[^>]+href="(\/hub\/blog\/[^"?#]+)"[^>]*>([\s\S]*?)(?=<\/a>)/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, path, cardHtml] = match;
    if (seen.has(path)) continue;
    seen.add(path);

    const titleMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
    const dateMatch = cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/);
    const summaryMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);

    // Also try to find the title directly as text when there is no <h*> tag
    const rawText = stripTags(cardHtml).trim();
    const title = stripTags(titleMatch?.[1] || '') || (rawText.length > 5 ? rawText.slice(0, 120) : '');
    if (!title) continue;

    const normalized = {
      company: feed.company,
      source: feed.source,
      title,
      publishedAt: normalizeDate(stripTags(dateMatch?.[1] || '')),
      summary: summarizeText(stripTags(summaryMatch?.[1] || title)),
      link: `https://www.perplexity.ai${path}`
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
    // RSS URL is dead (404); fall straight through to the HTML parser.
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
    // RSS URL is dead (404); fall through to the custom DeepMind HTML parser.
    company: 'Google DeepMind',
    source: 'Google DeepMind Blog',
    feedUrl: 'https://deepmind.google/blog/rss/',
    pageUrl: 'https://deepmind.google/blog/',
    htmlFallback: true,
    parseHtml: parseDeepMindPage
  },
  {
    // RSS URL is dead (404); fall through to the Meta AI HTML parser.
    company: 'Meta AI',
    source: 'Meta AI Blog',
    feedUrl: 'https://ai.meta.com/blog/rss/',
    pageUrl: 'https://ai.meta.com/blog/',
    htmlFallback: true,
    parseHtml: parseMetaAIPage
  },
  {
    // RSS URL is dead (404) and the news listing page is JS-rendered (only 1 item
    // visible in static HTML).  Use the sitemap as a reliable post index instead.
    company: 'Mistral AI',
    source: 'Mistral AI News',
    pageUrl: 'https://mistral.ai/news/',
    fetchItems: parseMistralFromSitemap
  },
  {
    // RSS URL is dead (404); blog page works with bot UA.
    // parseXaiPage now matches /news/ paths (xAI moved from /blog/ to /news/).
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
    // RSS URL returns the HTML blog page (not XML); use sitemap-based custom fetcher.
    company: 'Cohere',
    source: 'Cohere Blog',
    pageUrl: 'https://cohere.com/blog',
    fetchItems: parseCohereFromSitemap
  },
  {
    // Perplexity's blog is fully behind Cloudflare bot-mitigation.
    // Both the RSS endpoint and all blog page URLs return 403/404 for any user-agent.
    // The entry is kept so we attempt it and log the failure rather than silently
    // dropping the source.  If Perplexity ever exposes a public RSS feed, update
    // feedUrl here and remove the comment.
    company: 'Perplexity AI',
    source: 'Perplexity Blog',
    feedUrl: 'https://www.perplexity.ai/hub/blog/rss.xml',
    pageUrl: 'https://www.perplexity.ai/hub/blog',
    htmlFallback: true,
    parseHtml: parsePerplexityPage
  }
];

// ─── Fetcher factory ──────────────────────────────────────────────────────────

// Browser-like UA avoids bot-blocking on most sites.
// Some sites (e.g. xAI) respond fine to this UA but reject a generic bot string.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function createRssFetcher({ feeds = DEFAULT_FEEDS, logger = console } = {}) {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': BROWSER_UA
    }
  });

  return async function fetchRssNews() {
    const allItems = [];
    const health = [];

    for (const feed of feeds) {
      // Feeds with a custom async fetcher (e.g. sitemap-based) bypass the RSS path
      if (feed.fetchItems) {
        try {
          const items = await feed.fetchItems(feed);
          logger.info(`Fetched ${items.length} item(s) from ${feed.source} via custom fetcher.`);
          allItems.push(...items);
          health.push({ source: feed.source, status: 'ok', count: items.length, method: 'custom' });
        } catch (err) {
          logger.error(`Custom fetcher failed for ${feed.source}: ${err.message}`);
          health.push({ source: feed.source, status: 'error', error: err.message });
        }
        continue;
      }

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
          // Some sites block the browser UA (Cloudflare, Meta, xAI) but accept a
          // generic bot string, and vice versa. Try browser UA first; if the
          // response is not OK (or blocked), retry with the bot string.
          const BOT_UA = 'ai-news-monitoring-agent/1.0 (+personal use)';
          const uasToTry = feed.fallbackUA
            ? [feed.fallbackUA]
            : [BROWSER_UA, BOT_UA];

          let html = null;
          for (const ua of uasToTry) {
            const response = await fetch(feed.pageUrl, { headers: { 'User-Agent': ua } });
            if (response.ok) {
              html = await response.text();
              break;
            }
          }
          if (html === null) {
            throw new Error('All user-agents blocked on HTML fallback');
          }

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
  parseCohereFromSitemap,
  parseDeepMindPage,
  parseGenericBlogPage,
  parseMetaAIPage,
  parseMistralFromSitemap,
  parseMistralNewsPage,
  parsePerplexityPage,
  parseXaiPage
};
