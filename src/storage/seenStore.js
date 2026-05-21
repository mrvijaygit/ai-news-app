const fs = require('node:fs/promises');
const path = require('node:path');

class SeenStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        seen: Array.isArray(parsed.seen) ? parsed.seen : [],
        updatedAt: parsed.updatedAt || null
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initial = { seen: [], updatedAt: null };
        await this.save(initial);
        return initial;
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid seen store JSON at ${this.filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  async save(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  async filterUnseen(items) {
    const data = await this.load();
    const seen = new Set(data.seen);
    return items.filter((item) => item.id && !seen.has(item.id));
  }

  async markSeen(items) {
    const data = await this.load();
    const seen = new Set(data.seen);

    for (const item of items) {
      if (item && item.id) {
        seen.add(item.id);
      }
    }

    const next = {
      seen: [...seen],
      updatedAt: new Date().toISOString()
    };
    await this.save(next);
    return next;
  }
}

module.exports = { SeenStore };
