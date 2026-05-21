function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toUTCString();
}

function formatEmail(items) {
  const count = items.length;
  const subject = `AI News Alert: ${count} new ${count === 1 ? 'update' : 'updates'}`;

  const textLines = [
    `AI News Alert`,
    `${count} new ${count === 1 ? 'update' : 'updates'} found.`,
    ''
  ];

  const htmlItems = [];

  for (const item of items) {
    textLines.push(
      `${item.company}: ${item.title}`,
      `Published: ${formatDate(item.publishedAt)}`,
      `Summary: ${item.summary || 'No summary available.'}`,
      `Link: ${item.link}`,
      ''
    );

    htmlItems.push(`
      <li>
        <p><strong>${escapeHtml(item.company)}:</strong> ${escapeHtml(item.title)}</p>
        <p><strong>Published:</strong> ${escapeHtml(formatDate(item.publishedAt))}</p>
        <p><strong>Summary:</strong> ${escapeHtml(item.summary || 'No summary available.')}</p>
        <p><a href="${escapeHtml(item.link)}">Read article</a></p>
      </li>
    `);
  }

  const html = `
    <h2>AI News Alert</h2>
    <p>${count} new ${count === 1 ? 'update' : 'updates'} found.</p>
    <ul>${htmlItems.join('\n')}</ul>
  `;

  return {
    subject,
    text: textLines.join('\n').trim(),
    html
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

async function sendEmailAlert(items, config, logger = console) {
  if (!config.email.enabled) {
    logger.info('Email notifications disabled.');
    return { skipped: true };
  }

  const email = formatEmail(items);

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
