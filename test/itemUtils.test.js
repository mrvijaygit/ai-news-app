const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createStableId,
  summarizeText,
  sortByPublishedDesc
} = require('../src/utils/itemUtils');

test('createStableId returns the same ID for equivalent article fields', () => {
  const first = createStableId({
    company: 'OpenAI',
    title: '  New model released ',
    link: 'https://openai.com/news/model?utm_source=x',
    publishedAt: '2026-05-21T10:00:00.000Z'
  });

  const second = createStableId({
    company: 'openai',
    title: 'New model released',
    link: 'https://openai.com/news/model?utm_campaign=y',
    publishedAt: '2026-05-21T10:00:00.000Z'
  });

  assert.equal(first, second);
  assert.match(first, /^openai:/);
});

test('summarizeText strips markup and limits long text', () => {
  const summary = summarizeText(
    '<p>OpenAI announced a new research update with many details.</p><p>This second sentence should be trimmed when the limit is small.</p>',
    72
  );

  assert.equal(summary, 'OpenAI announced a new research update with many details. This second...');
});

test('sortByPublishedDesc orders newest valid dates first and undated items last', () => {
  const sorted = sortByPublishedDesc([
    { title: 'No date' },
    { title: 'Older', publishedAt: '2026-05-20T00:00:00.000Z' },
    { title: 'Newer', publishedAt: '2026-05-21T00:00:00.000Z' }
  ]);

  assert.deepEqual(sorted.map((item) => item.title), ['Newer', 'Older', 'No date']);
});
