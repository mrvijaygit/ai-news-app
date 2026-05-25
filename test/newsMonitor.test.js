const test = require('node:test');
const assert = require('node:assert/strict');

const { filterRecentItems, runNewsMonitor } = require('../src/services/newsMonitor');

test('filterRecentItems keeps dated items inside the configured age window', () => {
  const now = Date.now();
  const recent = new Date(now - 60 * 60 * 1000).toISOString();
  const old = new Date(now - 72 * 60 * 60 * 1000).toISOString();

  const items = filterRecentItems([
    { id: 'recent', publishedAt: recent },
    { id: 'old', publishedAt: old },
    { id: 'missing-date' }
  ], 48);

  // Items with no publishedAt are assumed recent and passed through
  assert.deepEqual(items.map((item) => item.id), ['recent', 'missing-date']);
});

test('runNewsMonitor sends alerts only for unseen items and marks them seen', async () => {
  const notifications = [];
  const marked = [];
  const logs = [];

  const result = await runNewsMonitor({
    fetchers: [
      async () => [
        { id: 'openai:1', title: 'Old', publishedAt: '2026-05-20T00:00:00.000Z' },
        { id: 'openai:2', title: 'Newer', publishedAt: '2026-05-21T00:00:00.000Z' }
      ],
      async () => [
        { id: 'anthropic:3', title: 'Newest', publishedAt: '2026-05-22T00:00:00.000Z' }
      ]
    ],
    store: {
      filterUnseen: async (items) => items.filter((item) => item.id !== 'openai:1'),
      markSeen: async (items) => marked.push(...items)
    },
    notifiers: [
      async (items) => notifications.push(items.map((item) => item.id))
    ],
    maxItemAgeHours: 0,
    logger: {
      info: (message) => logs.push(message),
      warn: (message) => logs.push(message),
      error: (message) => logs.push(message)
    }
  });

  assert.equal(result.fetchedCount, 3);
  assert.equal(result.newCount, 2);
  assert.deepEqual(notifications, [['anthropic:3', 'openai:2']]);
  assert.deepEqual(marked.map((item) => item.id), ['anthropic:3', 'openai:2']);
});

test('runNewsMonitor does not notify or mark seen when there are no new items', async () => {
  let notified = false;
  let marked = false;

  const result = await runNewsMonitor({
    fetchers: [async () => [{ id: 'openai:1', title: 'Old' }]],
    store: {
      filterUnseen: async () => [],
      markSeen: async () => {
        marked = true;
      }
    },
    notifiers: [
      async () => {
        notified = true;
      }
    ],
    maxItemAgeHours: 0,
    logger: console
  });

  assert.equal(result.newCount, 0);
  assert.equal(notified, false);
  assert.equal(marked, false);
});

test('runNewsMonitor can skip persisting seen IDs for dry-run style checks', async () => {
  let marked = false;

  const result = await runNewsMonitor({
    fetchers: [async () => [{ id: 'openai:1', title: 'New' }]],
    store: {
      filterUnseen: async (items) => items,
      markSeen: async () => {
        marked = true;
      }
    },
    notifiers: [async () => {}],
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    maxItemAgeHours: 0,
    persistSeen: false
  });

  assert.equal(result.newCount, 1);
  assert.equal(result.persisted, false);
  assert.equal(marked, false);
});

test('runNewsMonitor keeps working when one source fails', async () => {
  const result = await runNewsMonitor({
    fetchers: [
      async () => {
        throw new Error('feed unavailable');
      },
      async () => [{ id: 'google:1', title: 'Gemini news' }]
    ],
    store: {
      filterUnseen: async (items) => items,
      markSeen: async () => {}
    },
    notifiers: [async () => {}],
    maxItemAgeHours: 0,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  });

  assert.equal(result.fetchedCount, 1);
  assert.equal(result.newCount, 1);
});
