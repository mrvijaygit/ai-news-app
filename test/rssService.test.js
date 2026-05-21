const test = require('node:test');
const assert = require('node:assert/strict');

const { parseAnthropicNewsPage } = require('../src/services/rssService');

test('parseAnthropicNewsPage extracts official Anthropic news cards', () => {
  const html = `
    <a href="/news/claude-opus-4-7">
      <h2>Introducing Claude Opus 4.7</h2>
      <time>Apr 16, 2026</time>
      <p>Our latest Opus model brings stronger performance across coding.</p>
    </a>
  `;

  const items = parseAnthropicNewsPage(html);

  assert.equal(items.length, 1);
  assert.equal(items[0].company, 'Anthropic');
  assert.equal(items[0].title, 'Introducing Claude Opus 4.7');
  assert.equal(items[0].publishedAt, '2026-04-16T00:00:00.000Z');
  assert.equal(items[0].link, 'https://www.anthropic.com/news/claude-opus-4-7');
  assert.match(items[0].id, /^anthropic:/);
});
