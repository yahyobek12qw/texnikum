import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBackup, restoreBackup } from '../../scripts/backup-lib.ts';
import { seedStructure } from '../../prisma/seed.js';
import { prisma } from '../src/lib/prisma.js';
import { A, P, PDF_BYTES, createAdminUser, loginAgent, makeApp, newsBody, pngBuffer, resetAll } from './helpers.js';

describe('backup va tiklash', () => {
  const app = makeApp();
  const uploadDir = process.env.UPLOAD_DIR!;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
  });

  it('backup → ma’lumotlarni yo‘qotish → tiklash: kontent, tarjimalar, bog‘lanishlar va fayllar qaytadi', async () => {
    await seedStructure(prisma);
    const api = await loginAgent(app);
    const img = (await api.upload(`${A}/media`, await pngBuffer(), 'rasm.png')).body;
    const pdf = (await api.upload(`${A}/media`, PDF_BYTES, 'nizom.pdf')).body;
    const n = (await api.post(`${A}/news`, newsBody('zaxira', 'Zaxira sinovi', {
      coverMediaId: img.id,
      translations: { uz: { title: 'Zaxira sinovi', slug: 'zaxira', excerpt: 'q', content: '<p>Matn</p>' }, ru: { title: 'Тест резервной копии', slug: 'rezerv', excerpt: '', content: '' } },
    }))).body;
    await api.post(`${A}/news/${n.id}/publish`);
    await api.post(`${A}/documents`, { type: 'PLAN', fileMediaId: pdf.id, status: 'PUBLISHED', translations: { uz: { title: 'Reja', description: '' } } });
    await api.patch(`${A}/settings`, { general: { officialName: { uz: 'Zaxira texnikumi', ru: '', en: '' }, shortName: { uz: '', ru: '', en: '' }, logoMediaId: null } });

    const before = {
      pages: await prisma.page.count(),
      pageTr: await prisma.pageTranslation.count(),
      nav: await prisma.navigationItem.count(),
      news: await prisma.news.count(),
      docs: await prisma.document.count(),
      media: await prisma.media.count(),
      audit: await prisma.auditLog.count(),
    };

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uchkoprik-backup-'));
    const manifest = await createBackup(prisma, dir, uploadDir);
    expect(manifest.tables.news).toBe(1);
    expect(manifest.uploadFiles).toBeGreaterThanOrEqual(3); // rasm, thumbnail, hujjat

    // Falokat: hamma narsa o'chadi, fayllar ham
    await resetAll();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    expect(await prisma.news.count()).toBe(0);
    expect((await request(app).get(`${P}/news/zaxira?locale=uz`)).status).toBe(404);

    await restoreBackup(prisma, dir, uploadDir);

    expect({
      pages: await prisma.page.count(),
      pageTr: await prisma.pageTranslation.count(),
      nav: await prisma.navigationItem.count(),
      news: await prisma.news.count(),
      docs: await prisma.document.count(),
      media: await prisma.media.count(),
      audit: await prisma.auditLog.count(),
    }).toEqual(before);

    // Ommaviy sayt tiklangan kontentni ko'rsatadi, rasm fayli ham qaytgan
    const ru = (await request(app).get(`${P}/news/rezerv?locale=ru`)).body;
    expect(ru.title).toBe('Тест резервной копии');
    expect(ru.cover.url).toBe(img.url);
    expect((await request(app).get(img.url)).status).toBe(200);
    expect((await request(app).get(`${P}/settings?locale=uz`)).body.officialName).toBe('Zaxira texnikumi');
    expect((await request(app).get(`${P}/navigation?locale=uz`)).body.main.length).toBeGreaterThan(5);
    expect((await request(app).get(`${P}/documents?locale=uz`)).body.items).toHaveLength(1);

    // Administrator hisobi tiklangan (parol xeshi bilan) — kirish mumkin; eski sessiyalar bekor
    const login = await request(app).post(`${A}/auth/login`).send({ email: 'admin@test.uz', password: 'Test-parol-12345' });
    expect(login.status).toBe(200);
    expect((await api.get(`${A}/auth/me`)).status).toBe(401);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
