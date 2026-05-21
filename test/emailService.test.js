const test = require('node:test');
const assert = require('node:assert/strict');

const { formatEmail } = require('../src/mail/emailService');

test('formatEmail creates a concise grouped AI news email', () => {
  const email = formatEmail([
    {
      company: 'OpenAI',
      title: 'New model update',
      publishedAt: '2026-05-21T08:00:00.000Z',
      summary: 'A concise update about a model release.',
      link: 'https://openai.com/news/model'
    },
    {
      company: 'Anthropic',
      title: 'Safety research',
      publishedAt: '2026-05-20T10:30:00.000Z',
      summary: 'A short research summary.',
      link: 'https://anthropic.com/news/safety'
    }
  ]);

  assert.equal(email.subject, 'AI News Alert: 2 new updates');
  assert.match(email.text, /OpenAI/);
  assert.match(email.text, /New model update/);
  assert.match(email.text, /A concise update about a model release\./);
  assert.match(email.text, /https:\/\/openai.com\/news\/model/);
  assert.match(email.html, /<h2>AI News Alert<\/h2>/);
  assert.match(email.html, /New model update/);
});

test('formatEmail uses singular subject for one item', () => {
  const email = formatEmail([
    {
      company: 'Google AI',
      title: 'Gemini update',
      publishedAt: '2026-05-21T08:00:00.000Z',
      summary: 'Short summary.',
      link: 'https://blog.google/technology/ai/gemini'
    }
  ]);

  assert.equal(email.subject, 'AI News Alert: 1 new update');
});
