import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { publishDueNews } from '../src/modules/news/scheduler.js';
import {
  A, P, createAdminUser, loginAgent, makeApp, newsBody, pngBuffer, resetAll, resetContent, type AdminApi,
} from './helpers.js';

describe('yangiliklar', () => {
  const { app, config } = (() => {
    const a = makeApp();
    return { app: a, config: { uploadDir: process.env.UPLOAD_DIR! } };
  })();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  it('yangilik yaratadi, tahrirlaydi va qoralamani ommaviy API’dan yashiradi', async () => {
    const created = await api.post(`${A}/news`, newsBody('birinchi', 'Birinchi'));
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('DRAFT');

    const edited = await api.patch(`${A}/news/${created.body.id}`, {
      isImportant: true,
      translations: { uz: { title: 'Birinchi (tahrirlangan)', slug: 'birinchi', excerpt: 'Yangi tavsif', content: '<p>x</p>' } },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.isImportant).toBe(true);
    expect(edited.body.title).toBe('Birinchi (tahrirlangan)');

    const list = await request(app).get(`${P}/news?locale=uz`);
    expect(list.body.items).toHaveLength(0);
    expect(list.body.meta.total).toBe(0);
    expect((await request(app).get(`${P}/news/birinchi?locale=uz`)).status).toBe(404);
  });

  it('nashr qiladi, nashrdan qaytaradi va arxivlaydi', async () => {
    const { id } = (await api.post(`${A}/news`, newsBody('yangilik', 'Yangilik'))).body;

    const pub = await api.post(`${A}/news/${id}/publish`);
    expect(pub.body.status).toBe('PUBLISHED');
    expect(pub.body.publishedAt).toBeTruthy();
    expect((await request(app).get(`${P}/news/yangilik?locale=uz`)).status).toBe(200);
    expect((await request(app).get(`${P}/news?locale=uz`)).body.items).toHaveLength(1);

    await api.post(`${A}/news/${id}/unpublish`).expect(200);
    expect((await request(app).get(`${P}/news/yangilik?locale=uz`)).status).toBe(404);

    await api.post(`${A}/news/${id}/publish`).expect(200);
    const arch = await api.post(`${A}/news/${id}/archive`);
    expect(arch.body.status).toBe('ARCHIVED');
    expect((await request(app).get(`${P}/news/yangilik?locale=uz`)).status).toBe(404);
  });

  it('qoralama yangilik ro‘yxatda ham, qidiruvda ham ko‘rinmaydi', async () => {
    await api.post(`${A}/news`, newsBody('yashirin', 'Yashirin maxsus-soz'));
    const pubItem = (await api.post(`${A}/news`, newsBody('ochiq', 'Ochiq maxsus-soz'))).body;
    await api.post(`${A}/news/${pubItem.id}/publish`);

    const search = (await request(app).get(`${P}/search?locale=uz&q=maxsus-soz`)).body;
    expect(search.items.map((i: { title: string }) => i.title)).toEqual(['Ochiq maxsus-soz']);
    const list = (await request(app).get(`${P}/news?locale=uz`)).body;
    expect(list.items.map((i: { slug: string }) => i.slug)).toEqual(['ochiq']);
  });

  it('muqova rasmini yuklaydi va yangilikka biriktiradi', async () => {
    const up = await api.upload(`${A}/media`, await pngBuffer(), 'muqova.png');
    expect(up.status).toBe(201);
    expect(up.body.kind).toBe('IMAGE');
    expect(up.body.url).toMatch(/^\/uploads\/images\/[0-9a-f-]{36}\.png$/);
    expect(up.body.thumbUrl).toMatch(/^\/uploads\/thumbs\/[0-9a-f-]{36}\.webp$/);

    const { id } = (await api.post(`${A}/news`, newsBody('rasmli', 'Rasmli', { coverMediaId: up.body.id }))).body;
    await api.post(`${A}/news/${id}/publish`);
    const detail = (await request(app).get(`${P}/news/rasmli?locale=uz`)).body;
    expect(detail.cover.url).toBe(up.body.url);

    // rasm ommaviy URL orqali beriladi
    const file = await request(app).get(up.body.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
    expect(file.headers['x-content-type-options']).toBe('nosniff');

    // hujjat faylini muqova qilib bo‘lmaydi
    const pdf = await api.upload(`${A}/media`, Buffer.from('%PDF-1.4\n%%EOF\n'), 'x.pdf');
    const bad = await api.post(`${A}/news`, newsBody('xato-muqova', 'Xato', { coverMediaId: pdf.body.id }));
    expect(bad.status).toBe(400);
  });

  it('rejalashtirilgan nashr: vaqti kelganda scheduler nashr qiladi, kelmaganda emas', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const { id } = (await api.post(`${A}/news`, newsBody('rejali', 'Rejali', { scheduledAt: future }))).body;

    expect(await publishDueNews()).toBe(0);
    expect((await request(app).get(`${P}/news/rejali?locale=uz`)).status).toBe(404);

    // vaqt kelgan holat: scheduledAt ni o'tmishga o'tkazamiz
    await prisma.news.update({ where: { id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    expect(await publishDueNews()).toBe(1);
    expect(await publishDueNews()).toBe(0); // ikki marta nashr qilinmaydi

    const row = await prisma.news.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('PUBLISHED');
    expect(row.scheduledAt).toBeNull();
    expect((await request(app).get(`${P}/news/rejali?locale=uz`)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'SCHEDULED_PUBLISH', entityId: id } })).toBe(1);
  });

  it('o‘tmishdagi sanaga rejalashtirishni rad etadi', async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const res = await api.post(`${A}/news`, newsBody('otmish', 'O‘tmish', { scheduledAt: past }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SCHEDULE_IN_PAST');
  });

  it('pagination, tur va kategoriya bo‘yicha filtrlaydi', async () => {
    const cat = (await api.post(`${A}/categories`, { scope: 'NEWS', sortOrder: 0, translations: { uz: { name: 'Sport', slug: 'sport' } } })).body;
    for (let i = 1; i <= 5; i++) {
      const { id } = (await api.post(`${A}/news`, newsBody(`n-${i}`, `Yangilik ${i}`, { categoryId: i <= 2 ? cat.id : null }))).body;
      await api.post(`${A}/news/${id}/publish`);
    }
    const ann = (await api.post(`${A}/news`, newsBody('elon-1', 'E’lon', { type: 'ANNOUNCEMENT' }))).body;
    await api.post(`${A}/news/${ann.id}/publish`);

    const page1 = (await request(app).get(`${P}/news?locale=uz&pageSize=2&page=1&type=NEWS`)).body;
    expect(page1.items).toHaveLength(2);
    expect(page1.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    const page3 = (await request(app).get(`${P}/news?locale=uz&pageSize=2&page=3&type=NEWS`)).body;
    expect(page3.items).toHaveLength(1);

    const bySport = (await request(app).get(`${P}/news?locale=uz&category=sport`)).body;
    expect(bySport.meta.total).toBe(2);
    const announcements = (await request(app).get(`${P}/news?locale=uz&type=ANNOUNCEMENT`)).body;
    expect(announcements.items.map((i: { slug: string }) => i.slug)).toEqual(['elon-1']);

    const adminList = (await api.get(`${A}/news?status=DRAFT&type=ANNOUNCEMENT`)).body;
    expect(adminList.meta.total).toBe(0);
  });

  it('o‘chirishda yangilik va tarjimalari ketadi; audit jurnaliga yoziladi', async () => {
    const { id } = (await api.post(`${A}/news`, newsBody('ochadi', 'O‘chadi'))).body;
    await api.del(`${A}/news/${id}`).expect(204);
    expect((await api.get(`${A}/news/${id}`)).status).toBe(404);
    expect(await prisma.newsTranslation.count({ where: { newsId: id } })).toBe(0);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['CREATE', 'DELETE']);
  });

  it('yuklangan fayl nomi tasodifiy, asl nom yo‘l sifatida ishlatilmaydi', async () => {
    const up = await api.upload(`${A}/media`, await pngBuffer(), '../../etc/passwd.png');
    expect(up.status).toBe(201);
    expect(up.body.originalName).not.toContain('/');
    const stored = path.basename(up.body.url);
    expect(stored).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fs.existsSync(path.join(config.uploadDir, 'images', stored))).toBe(true);
  });
});
