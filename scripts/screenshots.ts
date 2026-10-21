// Vizual tekshiruv: alohida baza + demo ma'lumot + production server ko'tarib, asosiy sahifalarning skrinshotlarini oladi.
// Ishlatish: npm run build && npx tsx scripts/screenshots.ts <chiqish-papka>
import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { startEmbeddedDb } from './embedded-db.ts';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] ?? 'shots');
fs.mkdirSync(out, { recursive: true });
const PORT = 4150;

const dataDir = path.join(root, '.pgdata-shots');
fs.rmSync(dataDir, { recursive: true, force: true });
const { pg, url } = await startEmbeddedDb({ dataDir, port: 54349, database: 'shots', persistent: false });
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uchkoprik-shots-'));
const password = `Shots-${crypto.randomBytes(8).toString('base64url')}9`;
const env = { ...process.env, DATABASE_URL: url, UPLOAD_DIR: uploadDir } as NodeJS.ProcessEnv;
const run = (cmd: string, extra: NodeJS.ProcessEnv = {}) => execSync(cmd, { cwd: root, env: { ...env, ...extra }, stdio: 'pipe' });

let server: ReturnType<typeof spawn> | null = null;
try {
  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
  run('npx tsx prisma/seed-demo.ts');
  run('npx tsx scripts/create-admin.ts', { ADMIN_EMAIL: 'shots@test.uz', ADMIN_NAME: 'Shots', ADMIN_PASSWORD: password });
  server = spawn('node', ['server/dist/server.js'], {
    cwd: root,
    env: { ...env, NODE_ENV: 'production', PORT: String(PORT), PUBLIC_URL: `http://localhost:${PORT}`, COOKIE_SECURE: 'true', LOG_LEVEL: 'silent', API_RATE_MAX: '100000', ENABLE_API_DOCS: 'false' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/healthz`)).ok) break; } catch { /* kutamiz */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  const browser = await chromium.launch({ channel: 'msedge' });
  const sizes = { d: { width: 1366, height: 850 }, m: { width: 390, height: 844 } };
  const publicPaths: [string, string][] = [
    ['home', '/uz'], ['news', '/uz/news'], ['article', '/uz/news/yangi-oquv-yili'], ['about', '/uz/about'], ['mission', '/uz/mission'],
    ['documents', '/uz/documents'], ['programs', '/uz/programs'], ['leadership', '/uz/leadership'], ['contacts', '/uz/contacts'],
    ['gallery', '/uz/gallery'], ['links', '/uz/useful-links'], ['search', '/uz/search?q=texnikum'], ['notfound', '/uz/yoq'],
  ];
  for (const [key, size] of Object.entries(sizes)) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const [name, p] of publicPaths) {
      await page.goto(`http://localhost:${PORT}${p}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(out, `${key}-pub-${name}.png`), fullPage: true });
    }
    await page.goto(`http://localhost:${PORT}/admin/login`);
    await page.screenshot({ path: path.join(out, `${key}-adm-login.png`) });
    await page.getByLabel('Elektron pochta').fill('shots@test.uz');
    await page.getByLabel('Parol').fill(password);
    await page.getByRole('button', { name: 'Kirish' }).click();
    await page.waitForURL(/\/admin$/);
    const pageId = await page.evaluate(async () => ((await (await fetch('/api/v1/admin/pages?pageSize=100')).json()) as { items: { id: string; translations: { uz?: { slug: string } } }[] }).items.find((i) => i.translations.uz?.slug === 'mission')!.id);
    const newsId = await page.evaluate(async () => ((await (await fetch('/api/v1/admin/news?pageSize=5')).json()) as { items: { id: string }[] }).items[0]!.id);
    const admin: [string, string][] = [
      ['dashboard', '/admin'], ['pages', '/admin/pages'], ['page-edit', `/admin/pages/${pageId}`], ['news', '/admin/news'], ['news-edit', `/admin/news/${newsId}`],
      ['documents', '/admin/documents'], ['media', '/admin/media'], ['navigation', '/admin/navigation'], ['settings', '/admin/settings'], ['home', '/admin/home'], ['translations', '/admin/translations'],
    ];
    for (const [name, p] of admin) {
      await page.goto(`http://localhost:${PORT}${p}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${key}-adm-${name}.png`), fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`Skrinshotlar: ${out}`);
} finally {
  server?.kill();
  await pg.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(uploadDir, { recursive: true, force: true });
}
