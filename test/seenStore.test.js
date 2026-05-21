const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { SeenStore } = require('../src/storage/seenStore');

async function tempStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-news-store-'));
  return path.join(dir, 'seen-news.json');
}

test('SeenStore initializes a missing JSON file with an empty seen list', async () => {
  const filePath = await tempStorePath();
  const store = new SeenStore(filePath);

  const data = await store.load();

  assert.deepEqual(data.seen, []);
  const written = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.deepEqual(written.seen, []);
});

test('SeenStore filters unseen items by stable item ID', async () => {
  const filePath = await tempStorePath();
  const store = new SeenStore(filePath);
  await store.markSeen([{ id: 'openai:1' }]);

  const unseen = await store.filterUnseen([
    { id: 'openai:1', title: 'Already sent' },
    { id: 'anthropic:2', title: 'New item' }
  ]);

  assert.deepEqual(unseen.map((item) => item.id), ['anthropic:2']);
});

test('SeenStore markSeen appends new IDs without duplicates', async () => {
  const filePath = await tempStorePath();
  const store = new SeenStore(filePath);

  await store.markSeen([{ id: 'openai:1' }, { id: 'openai:1' }, { id: 'google:2' }]);
  await store.markSeen([{ id: 'google:2' }, { id: 'deepmind:3' }]);

  const data = await store.load();
  assert.deepEqual(data.seen, ['openai:1', 'google:2', 'deepmind:3']);
  assert.match(data.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
