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
        seenAt: (parsed.seenAt && typeof parsed.seenAt === 'object' && !Array.isArray(parsed.seenAt))
          ? parsed.seenAt
          : {},
        updatedAt: parsed.updatedAt || null
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initial = { seen: [], seenAt: {}, updatedAt: null };
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
    const now = new Date().toISOString();

    for (const item of items) {
      if (item && item.id) {
        seen.add(item.id);
        data.seenAt[item.id] = now;
      }
    }

    const next = {
      seen: [...seen],
      seenAt: data.seenAt,
      updatedAt: now
    };
    await this.save(next);
    return next;
  }

  async prune(maxAgeDays = 60) {
    const data = await this.load();
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const fallbackTs = data.updatedAt ? Date.parse(data.updatedAt) : 0;

    const before = data.seen.length;
    data.seen = data.seen.filter((id) => {
      const ts = data.seenAt[id] ? Date.parse(data.seenAt[id]) : fallbackTs;
      return ts >= cutoff;
    });

    for (const id of Object.keys(data.seenAt)) {
      if (!data.seen.includes(id)) delete data.seenAt[id];
    }

    const pruned = before - data.seen.length;
    if (pruned > 0) await this.save(data);
    return pruned;
  }
}

module.exports = { SeenStore };
