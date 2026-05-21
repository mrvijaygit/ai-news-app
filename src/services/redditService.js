const { createStableId, summarizeText } = require('../utils/itemUtils');

function redditSearchUrl(query, limit) {
  const params = new URLSearchParams({
    q: query,
    sort: 'new',
    t: 'day',
    limit: String(limit),
    restrict_sr: 'false'
  });
  return `https://www.reddit.com/search.json?${params.toString()}`;
}

function classifyCompany(text) {
  const value = text.toLowerCase();
  if (value.includes('anthropic') || value.includes('claude')) return 'Anthropic';
  if (value.includes('gemini') || value.includes('google')) return 'Google Gemini';
  if (value.includes('deepmind')) return 'DeepMind';
  if (value.includes('openai') || value.includes('chatgpt')) return 'OpenAI';
  return 'Reddit AI';
}

function createRedditFetcher({ config, logger = console }) {
  return async function fetchRedditNews() {
    if (!config.reddit.enabled) {
      return [];
    }

    const response = await fetch(redditSearchUrl(config.reddit.query, config.reddit.limit), {
      headers: { 'User-Agent': 'ai-news-monitoring-agent/1.0 (+personal use)' }
    });
    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}`);
    }

    const payload = await response.json();
    const posts = payload.data?.children || [];
    logger.info(`Fetched ${posts.length} Reddit item(s).`);

    return posts.map(({ data }) => {
      const title = data.title || 'Untitled Reddit post';
      const normalized = {
        company: classifyCompany(`${title} ${data.selftext || ''}`),
        source: 'Reddit',
        title,
        publishedAt: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : null,
        summary: summarizeText(data.selftext || title),
        link: data.permalink ? `https://www.reddit.com${data.permalink}` : data.url
      };
      return {
        ...normalized,
        id: data.name || createStableId(normalized)
      };
    });
  };
}

module.exports = {
  createRedditFetcher,
  redditSearchUrl
};
