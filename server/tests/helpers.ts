import sharp from 'sharp';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';
import { invalidateModules } from '../src/lib/modules.js';
import { prisma } from '../src/lib/prisma.js';
import { MODULE_KEYS } from '@uchkoprik/shared';

export const ADMIN_EMAIL = 'admin@test.uz';
export const ADMIN_PASSWORD = 'Test-parol-12345';

export function makeApp(overrides: Partial<Config> = {}): Express {
  return createApp(overrides).app;
}

const CONTENT_TABLES = [
  'audit_logs', 'site_settings', 'page_views', 'gallery_video_translations', 'gallery_videos', 'alumni_translations', 'alumni', 'partner_translations', 'partners', 'navigation_item_translations', 'navigation_items', 'navigation_menus',
  'staff_translations', 'staff', 'education_program_translations', 'education_programs',
  'document_translations', 'documents', 'media_translations', 'news_translations', 'news',
  'category_translations', 'categories', 'page_versions', 'page_translations', 'pages', 'media',
];

export async function setModules(value: Record<string, boolean>) {
  await prisma.siteSetting.upsert({ where: { key: 'modules' }, create: { key: 'modules', value }, update: { value } });
  invalidateModules();
}

export const enableAllModules = () => setModules(Object.fromEntries(MODULE_KEYS.map((k) => [k, true])));

/** Kontent jadvallarini tozalaydi (foydalanuvchi va sessiyalar saqlanadi). Sinovlar uchun hamma modul yoqiladi. */
export async function resetContent() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${CONTENT_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await enableAllModules();
}

export async function resetAll() {
  await prisma.$executeRawUnsafe(`TRUNCATE "sessions", "users", ${CONTENT_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await enableAllModules();
}

export async function createAdminUser(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  return prisma.user.create({
    data: { email, name: 'Test Admin', passwordHash: await hashPassword(password), role: 'ADMIN' },
  });
}

/** Tizimga kirgan agent: cookie saqlanadi, CSRF sarlavhasi avtomatik qo'shiladi. */
export async function loginAgent(app: Express, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/admin/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf = res.body.csrfToken as string;
  const api = {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
    put: (url: string, body?: object) => agent.put(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    del: (url: string) => agent.delete(url).set('X-CSRF-Token', csrf),
    upload: (url: string, file: Buffer, filename: string) =>
      agent.post(url).set('X-CSRF-Token', csrf).attach('file', file, filename),
  };
  return api;
}
export type AdminApi = Awaited<ReturnType<typeof loginAgent>>;

export const A = '/api/v1/admin';
export const P = '/api/v1/public';

export const pageBody = (slug: string, title = `Sarlavha ${slug}`, extra: object = {}) => ({
  template: 'DEFAULT',
  sortOrder: 0,
  translations: { uz: { title, slug, content: '<p>Matn</p>' } },
  ...extra,
});

export const newsBody = (slug: string, title = `Yangilik ${slug}`, extra: object = {}) => ({
  type: 'NEWS',
  isImportant: false,
  translations: { uz: { title, slug, excerpt: 'Qisqa tavsif', content: '<p>Matn</p>' } },
  ...extra,
});

export async function pngBuffer(width = 40, height = 30): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#12345b' } }).png().toBuffer();
}

export const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
