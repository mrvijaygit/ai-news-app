const cron = require('node-cron');

function startNewsScheduler({ schedule, task, logger = console }) {
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${schedule}`);
  }

  logger.info(`Starting AI news scheduler with cron: ${schedule}`);
  const job = cron.schedule(schedule, async () => {
    try {
      await task();
    } catch (error) {
      logger.error(`Scheduled news check failed: ${error.message}`);
    }
  });

  return job;
}

module.exports = { startNewsScheduler };
