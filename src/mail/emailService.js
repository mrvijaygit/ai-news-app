function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toUTCString();
}

function groupByCompany(items) {
  const groups = new Map();
  for (const item of items) {
    const company = item.company || 'Other';
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company).push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function formatEmail(items, meta = {}) {
  const count = items.length;
  const { failedFeeds = [] } = meta;

  if (count === 0 && failedFeeds.length > 0) {
    const subject = `AI News Agent: ${failedFeeds.length} feed${failedFeeds.length === 1 ? '' : 's'} failing`;
    const text = [
      'Feed Health Alert',
      '',
      'The following sources are currently failing:',
      ...failedFeeds.map((f) => `  • ${f.source}: ${f.error || 'unknown error'}`)
    ].join('\n');
    const html = `
      <h2>Feed Health Alert</h2>
      <p>The following sources are currently failing:</p>
      <ul>${failedFeeds.map((f) => `<li><strong>${escapeHtml(f.source)}</strong>: ${escapeHtml(f.error || 'unknown error')}</li>`).join('')}</ul>
    `;
    return { subject, text, html };
  }

  const subject = `AI News Alert: ${count} new ${count === 1 ? 'update' : 'updates'}`;
  const groups = groupByCompany(items);
  const textLines = [`AI News Alert`, `${count} new ${count === 1 ? 'update' : 'updates'} found.`, ''];
  const htmlParts = [`<h2>AI News Alert</h2><p>${count} new ${count === 1 ? 'update' : 'updates'} found.</p>`];

  for (const [company, companyItems] of groups) {
    textLines.push(`── ${company} ──`);
    htmlParts.push(`<h3>${escapeHtml(company)}</h3><ul>`);

    for (const item of companyItems) {
      textLines.push(
        `${item.company}: ${item.title}`,
        `Published: ${formatDate(item.publishedAt)}`,
        `Summary: ${item.summary || 'No summary available.'}`,
        `Link: ${item.link}`,
        ''
      );
      htmlParts.push(`
        <li>
          <p><strong>${escapeHtml(item.company)}:</strong> ${escapeHtml(item.title)}</p>
          <p><strong>Published:</strong> ${escapeHtml(formatDate(item.publishedAt))}</p>
          <p><strong>Summary:</strong> ${escapeHtml(item.summary || 'No summary available.')}</p>
          <p><a href="${escapeHtml(item.link)}">Read article</a></p>
        </li>
      `);
    }

    htmlParts.push('</ul>');
    textLines.push('');
  }

  if (failedFeeds.length > 0) {
    textLines.push(`⚠ ${failedFeeds.length} feed(s) had errors:`);
    failedFeeds.forEach((f) => textLines.push(`  • ${f.source}: ${f.error || 'unknown error'}`));
    htmlParts.push(`<hr/><p style="color:#999;font-size:0.85em;"><strong>⚠ Feed issues:</strong> ${failedFeeds.map((f) => `${escapeHtml(f.source)}: ${escapeHtml(f.error || 'unknown error')}`).join('; ')}</p>`);
  }

  return {
    subject,
    text: textLines.join('\n').trim(),
    html: htmlParts.join('\n')
  };
}

function createTransport(config) {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
}

async function sendEmailAlert(items, config, logger = console, meta = {}) {
  if (!config.email.enabled) {
    logger.info('Email notifications disabled.');
    return { skipped: true };
  }

  const email = formatEmail(items, meta);

  if (config.dryRun) {
    logger.info(`[dry-run] Would send email: ${email.subject}`);
    return { dryRun: true, email };
  }

  const transporter = createTransport(config);
  return transporter.sendMail({
    from: config.email.from,
    to: config.email.to,
    subject: email.subject,
    text: email.text,
    html: email.html
  });
}

module.exports = {
  escapeHtml,
  formatEmail,
  sendEmailAlert
};
