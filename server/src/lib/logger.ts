import { pino } from 'pino';
import { loadConfig } from '../config/env.js';

const level = loadConfig().logLevel;

/** Maxfiy maydonlar loglarga tushmasligi uchun redaksiya qilinadi. */
export const logger = pino({
  level,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
