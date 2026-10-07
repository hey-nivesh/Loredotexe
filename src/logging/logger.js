/**
 * Structured Logger with automatic secret redaction and leveled output.
 */

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const SECRET_KEY_PATTERN = /(?:password|secret|token|key|authorization|cookie|bearer|credential)/i;

/**
 * Deeply sanitizes objects to mask sensitive values.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeData(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeData);
  }

  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = sanitizeData(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  return value;
}

export class Logger {
  /**
   * @param {string} [logLevel='info']
   * @param {string} [context='app']
   */
  constructor(logLevel = 'info', context = 'app') {
    this.level = LOG_LEVELS[logLevel.toLowerCase()] || LOG_LEVELS.info;
    this.context = context;
  }

  /**
   * @param {string} context
   * @returns {Logger}
   */
  child(context) {
    const child = new Logger('info', `${this.context}:${context}`);
    child.level = this.level;
    return child;
  }

  _log(levelName, message, meta = {}) {
    const numericLevel = LOG_LEVELS[levelName];
    if (numericLevel < this.level) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: levelName.toUpperCase(),
      context: this.context,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta: sanitizeData(meta) } : {})
    };

    const formatted = JSON.stringify(payload);
    if (levelName === 'error') {
      console.error(formatted);
    } else if (levelName === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message, meta) {
    this._log('debug', message, meta);
  }

  info(message, meta) {
    this._log('info', message, meta);
  }

  warn(message, meta) {
    this._log('warn', message, meta);
  }

  error(message, meta) {
    this._log('error', message, meta);
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');
