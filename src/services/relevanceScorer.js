async function scoreWithAI(items, config, logger = console) {
  if (!items.length) return items;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    logger.warn('AI scoring requires @anthropic-ai/sdk. Run: npm install @anthropic-ai/sdk');
    return items;
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const BATCH_SIZE = 20;
  const result = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const lines = batch
      .map((item, idx) =>
        `${idx + 1}. [${item.company}] ${item.title}${item.summary ? ': ' + item.summary.slice(0, 120) : ''}`
      )
      .join('\n');

    const prompt = `You filter AI news to surface model and agent releases only. Score each article 0.0–1.0:
- 1.0 = New AI model, agent, or API release announcement
- 0.7 = Major capability update, research paper, or benchmark result
- 0.4 = General AI company news (partnerships, products, case studies)
- 0.1 = Not relevant (infrastructure, HR, financial, unrelated tech)

Articles:
${lines}

Reply with ONLY a JSON array of scores in order, e.g.: [0.9, 0.3, 1.0]`;

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const match = text.match(/\[[\d.,\s]+\]/);
      if (!match) throw new Error('No JSON array in response');

      const scores = JSON.parse(match[0]);
      batch.forEach((item, idx) => {
        result.push({ ...item, aiRelevanceScore: typeof scores[idx] === 'number' ? scores[idx] : 0.5 });
      });
    } catch (error) {
      logger.error(`AI scoring batch failed: ${error.message}. Keeping all items in this batch.`);
      batch.forEach((item) => result.push({ ...item, aiRelevanceScore: 0.5 }));
    }
  }

  return result;
}

function filterByAiScore(items, threshold = 0.5) {
  return items.filter((item) => (item.aiRelevanceScore ?? 1) >= threshold);
}

module.exports = { scoreWithAI, filterByAiScore };
