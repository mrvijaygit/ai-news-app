const ACTION_KEYWORDS = [
  'introduc', 'announc', 'launch', 'releas', 'unveil', 'present',
  'debut', 'open-sourc', 'open source', 'now available', 'preview',
  'beta', 'generally available', 'general availability'
];

const PRODUCT_KEYWORDS = [
  'model', 'agent', ' api', ' sdk', 'llm', 'language model',
  'chatbot', 'assistant', 'copilot', 'reasoning', 'multimodal',
  'vision', 'gpt', 'claude', 'gemini', 'llama', 'mistral', 'grok',
  'phi', 'sonnet', 'opus', 'haiku', 'nova', 'titan', 'mixtral',
  'deepseek', 'benchmark', 'parameter', 'billion', 'trillion',
  'context window', 'fine-tun', 'embedding', 'diffusion',
  'text-to', 'research paper', 'breakthrough', 'state-of-the-art',
  'sota', 'function call', 'tool use'
];

function scoreItem(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase();
  let score = 0;
  for (const kw of ACTION_KEYWORDS) {
    if (text.includes(kw)) score += 2;
  }
  for (const kw of PRODUCT_KEYWORDS) {
    if (text.includes(kw)) score += 1;
  }
  return score;
}

function filterByKeywords(items, minScore = 1) {
  return items.filter((item) => scoreItem(item) >= minScore);
}

module.exports = { filterByKeywords, scoreItem };
