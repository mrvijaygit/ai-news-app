const crypto = require('node:crypto');

function stripTrackingParams(rawLink = '') {
  try {
    const url = new URL(rawLink);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    return url.toString();
  } catch {
    return String(rawLink).trim();
  }
}

function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function createStableId(item) {
  const company = normalizeWhitespace(item.company || item.source || 'unknown').toLowerCase();
  const title = normalizeWhitespace(item.title || '').toLowerCase();
  const link = stripTrackingParams(item.link || '').toLowerCase();
  const publishedAt = normalizeWhitespace(item.publishedAt || item.pubDate || '');
  const input = `${company}|${title}|${link}|${publishedAt}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  return `${company}:${hash}`;
}

function summarizeText(text = '', maxLength = 220) {
  const clean = normalizeWhitespace(
    String(text)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );

  if (clean.length <= maxLength) {
    return clean;
  }

  const slice = clean.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trim()}...`;
}

function dateValue(item) {
  const value = Date.parse(item.publishedAt || item.pubDate || item.isoDate || '');
  return Number.isNaN(value) ? 0 : value;
}

function sortByPublishedDesc(items) {
  return [...items].sort((a, b) => dateValue(b) - dateValue(a));
}

module.exports = {
  createStableId,
  normalizeWhitespace,
  sortByPublishedDesc,
  stripTrackingParams,
  summarizeText
};
