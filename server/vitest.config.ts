import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export const TEST_DB_PORT = 54329;
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/uchkoprik_test?schema=public`;

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    pool: 'forks',
    fileParallelism: false, // barcha fayllar bitta test bazasidan foydalanadi
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      LOG_LEVEL: 'silent',
      PUBLIC_URL: 'http://localhost:5173',
      COOKIE_SECURE: 'false',
      FORCE_HTTPS: 'false',
      LOGIN_RATE_MAX: '1000',
      API_RATE_MAX: '100000',
      MAX_UPLOAD_MB: '1',
      UPLOAD_DIR: path.join(os.tmpdir(), 'uchkoprik-test-uploads'),
      CLIENT_DIST_DIR: path.join(os.tmpdir(), 'uchkoprik-no-client-dist'),
    },
  },
});
