import { execSync, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startEmbeddedDb } from '../scripts/embedded-db.ts';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 4100;
const DB_PORT = 54339;
const STATE = path.join(os.tmpdir(), 'uchkoprik-e2e-state.json');

async function waitFor(url: string, ms = 40_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // hali ishga tushmagan
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server ${url} ga javob bermadi`);
}

export default async function globalSetup() {
  if (!fs.existsSync(path.join(root, 'server/dist/server.js')) || !fs.existsSync(path.join(root, 'client/dist/index.html'))) {
    throw new Error('Production build topilmadi. Avval `npm run build` ni ishga tushiring.');
  }

  const dataDir = path.join(root, '.pgdata-e2e');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const { pg, url } = await startEmbeddedDb({ dataDir, port: DB_PORT, database: 'uchkoprik_e2e', persistent: false });

  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uchkoprik-e2e-uploads-'));
  const adminEmail = 'e2e-admin@test.uz';
  const adminPassword = `E2e-${crypto.randomBytes(9).toString('base64url')}9`;
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'production' } as NodeJS.ProcessEnv;

  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'pipe' });
  execSync('npx tsx scripts/modules.ts all-on', { cwd: root, env, stdio: 'pipe' }); // E2E uchun barcha modullar yoqiladi
  execSync('npx tsx scripts/create-admin.ts', {
    cwd: root,
    env: { ...env, ADMIN_EMAIL: adminEmail, ADMIN_NAME: 'E2E Admin', ADMIN_PASSWORD: adminPassword },
    stdio: 'pipe',
  });

  const server: ChildProcess = spawn('node', ['server/dist/server.js'], {
    cwd: root,
    env: {
      ...env,
      PORT: String(PORT),
      PUBLIC_URL: `http://localhost:${PORT}`,
      COOKIE_SECURE: 'true', // production: Secure cookie (localhost istisno sifatida http'da ham ishlaydi)
      FORCE_HTTPS: 'false',
      LOG_LEVEL: 'warn',
      UPLOAD_DIR: uploadDir,
      LOGIN_RATE_MAX: '50',
      API_RATE_MAX: '100000',
      SCHEDULER_INTERVAL_SECONDS: '1',
      ENABLE_API_DOCS: 'false',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await waitFor(`http://localhost:${PORT}/healthz`);

  fs.writeFileSync(STATE, JSON.stringify({ serverPid: server.pid, uploadDir }));
  process.env.E2E_ADMIN_EMAIL = adminEmail;
  process.env.E2E_ADMIN_PASSWORD = adminPassword;
  (globalThis as { __e2e?: unknown }).__e2e = { server, pg };
  // Playwright qaytarilgan funksiyani teardown sifatida chaqiradi
  return async () => {
    server.kill();
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(uploadDir, { recursive: true, force: true });
    fs.rmSync(STATE, { force: true });
  };
}
