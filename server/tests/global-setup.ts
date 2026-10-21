import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startEmbeddedDb } from '../../scripts/embedded-db.ts';
import { TEST_DATABASE_URL, TEST_DB_PORT } from '../vitest.config.ts';

const root = path.resolve(import.meta.dirname, '../..');
let stop: (() => Promise<void>) | null = null;

/** Sinov uchun real PostgreSQL ishga tushiriladi va Prisma migratsiyalari bo'sh bazaga qo'llanadi. */
export async function setup() {
  const dataDir = path.join(root, '.pgdata-test');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const { pg } = await startEmbeddedDb({
    dataDir,
    port: TEST_DB_PORT,
    database: 'uchkoprik_test',
    persistent: false,
  });
  stop = () => pg.stop();

  execSync('npx prisma migrate deploy', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

export async function teardown() {
  await stop?.();
  fs.rmSync(path.join(root, '.pgdata-test'), { recursive: true, force: true });
}
