const { formatEmail } = require('./emailService');

function formatTelegramMessage(items) {
  const email = formatEmail(items);
  return email.text;
}

async function sendTelegramAlert(items, config, logger = console) {
  if (!config.telegram.enabled) {
    return { skipped: true };
  }

  const text = formatTelegramMessage(items);

  if (config.dryRun) {
    logger.info(`[dry-run] Would send Telegram alert for ${items.length} item(s).`);
    return { dryRun: true, text };
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegram.chatId,
      text,
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

module.exports = {
  formatTelegramMessage,
  sendTelegramAlert
};
