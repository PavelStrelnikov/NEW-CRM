/**
 * Centralized logging utility with environment-based control.
 * Logs are suppressed in production builds.
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
  debug: (...args: any[]) => {
    if (IS_DEV) {
      console.debug('[DEBUG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (IS_DEV) {
      console.log('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Mask sensitive data for safe logging
   */
  maskSensitive: (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    const masked = { ...obj };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];

    for (const key in masked) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        masked[key] = '***';
      }
    }

    return masked;
  }
};
