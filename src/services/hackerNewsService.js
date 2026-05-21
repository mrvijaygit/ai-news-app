const { createStableId, summarizeText } = require('../utils/itemUtils');

function classifyCompany(text) {
  const value = text.toLowerCase();
  if (value.includes('anthropic') || value.includes('claude')) return 'Anthropic';
  if (value.includes('gemini') || value.includes('google')) return 'Google Gemini';
  if (value.includes('deepmind')) return 'DeepMind';
  if (value.includes('openai') || value.includes('chatgpt')) return 'OpenAI';
  return 'Hacker News AI';
}

function hackerNewsUrl(query, limit) {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: String(limit)
  });
  return `https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`;
}

function createHackerNewsFetcher({ config, logger = console }) {
  return async function fetchHackerNews() {
    if (!config.hackerNews.enabled) {
      return [];
    }

    const response = await fetch(hackerNewsUrl(config.hackerNews.query, config.hackerNews.limit));
    if (!response.ok) {
      throw new Error(`Hacker News API returned ${response.status}`);
    }

    const payload = await response.json();
    const hits = payload.hits || [];
    logger.info(`Fetched ${hits.length} Hacker News item(s).`);

    return hits.map((hit) => {
      const title = hit.title || hit.story_title || 'Untitled Hacker News story';
      const link = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const normalized = {
        company: classifyCompany(title),
        source: 'Hacker News',
        title,
        publishedAt: hit.created_at || null,
        summary: summarizeText(title),
        link
      };
      return {
        ...normalized,
        id: hit.objectID ? `hn:${hit.objectID}` : createStableId(normalized)
      };
    });
  };
}

module.exports = {
  createHackerNewsFetcher,
  hackerNewsUrl
};
