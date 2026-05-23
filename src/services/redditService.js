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
  const v = text.toLowerCase();
  if (v.includes('anthropic') || v.includes('claude')) return 'Anthropic';
  if (v.includes('deepmind')) return 'Google DeepMind';
  if (v.includes('gemini') || v.includes('google ai')) return 'Google AI / Gemini';
  if (v.includes('openai') || v.includes('chatgpt') || v.includes(' gpt')) return 'OpenAI';
  if (v.includes('meta ai') || v.includes('llama') || v.includes('meta llm')) return 'Meta AI';
  if (v.includes('mistral') || v.includes('mixtral')) return 'Mistral AI';
  if (v.includes('grok') || v.includes(' xai') || v.includes('x.ai')) return 'xAI';
  if (v.includes('copilot') || v.includes('microsoft ai') || v.includes('azure ai') || v.includes(' phi-')) return 'Microsoft AI';
  if (v.includes('hugging face') || v.includes('huggingface')) return 'Hugging Face';
  if (v.includes('cohere')) return 'Cohere';
  if (v.includes('perplexity')) return 'Perplexity AI';
  if (v.includes('nvidia')) return 'NVIDIA AI';
  if (v.includes('bedrock') || v.includes('aws ai')) return 'AWS AI';
  return 'AI News';
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
