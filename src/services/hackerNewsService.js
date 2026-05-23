const { createStableId, summarizeText } = require('../utils/itemUtils');

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
