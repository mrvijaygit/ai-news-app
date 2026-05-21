function createLogger(level = 'info') {
  const levels = ['debug', 'info', 'warn', 'error'];
  const current = levels.includes(level) ? level : 'info';
  const threshold = levels.indexOf(current);

  function log(method, message, meta) {
    if (levels.indexOf(method) < threshold) {
      return;
    }
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    console[method](`[${new Date().toISOString()}] [${method.toUpperCase()}] ${message}${suffix}`);
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta)
  };
}

module.exports = { createLogger };
