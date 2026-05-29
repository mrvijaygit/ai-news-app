const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_ITEMS = 200;

const COMPACT_FIELDS = ['id', 'title', 'summary', 'link', 'source', 'company', 'publishedAt'];

function compact(item) {
  const out = {};
  for (const k of COMPACT_FIELDS) out[k] = item[k] ?? null;
  return out;
}

class NewsFeedStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        updatedAt: parsed.updatedAt || null
      };
    } catch (error) {
      if (error.code === 'ENOENT') return { items: [], updatedAt: null };
      if (error instanceof SyntaxError) throw new Error(`Invalid news-feed JSON: ${error.message}`);
      throw error;
    }
  }

  async save(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  async addItems(newItems) {
    if (!newItems || !newItems.length) return 0;
    const data = await this.load();
    const existingIds = new Set(data.items.map((i) => i.id));
    const fresh = newItems
      .filter((i) => i && i.id && !existingIds.has(i.id))
      .map(compact);
    if (!fresh.length) return 0;

    await this.save({
      items: [...fresh, ...data.items].slice(0, MAX_ITEMS),
      updatedAt: new Date().toISOString()
    });
    return fresh.length;
  }
}

module.exports = { NewsFeedStore };
