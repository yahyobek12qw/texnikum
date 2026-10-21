import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { MODULES, defaultModules } from '@uchkoprik/shared';
import { seedStructure } from '../../prisma/seed.js';
import { prisma } from '../src/lib/prisma.js';
import {
  A, P, PDF_BYTES, createAdminUser, enableAllModules, loginAgent, makeApp, newsBody, pageBody, resetAll, resetContent, setModules, type AdminApi,
} from './helpers.js';

describe('funksiya modullari (yoqish/o‘chirish)', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });

  const get = (path: string) => request(app).get(`${P}${path}`);

  it('standart holat: asosiy modullar yoqilgan, “qolgan funksiyalar” o‘chirilgan', () => {
    const d = defaultModules();
    for (const m of MODULES) expect(d[m.key], m.key).toBe(m.group === 'main');
    expect(d.search).toBe(false);
    expect(d.videoGallery).toBe(true);
    expect(d.alumni).toBe(true);
    expect(d.partners).toBe(true);
    expect(d.admission).toBe(true);
    expect(d.statistics).toBe(true);
  });

  it('o‘chirilgan modullar: qidiruv, foydali havolalar, shaffoflik, faoliyat, o‘qituvchilar saytda yashiriladi', async () => {
    await resetContent();
    await seedStructure(prisma);
    await setModules({}); // standart holat
    await api.patch(`${A}/settings`, { usefulLinks: [{ id: 'l1', label: { uz: 'Vazirlik', ru: '', en: '' }, url: 'https://edu.uz' }] }).expect(200);

    const settings = (await get('/settings?locale=uz')).body;
    expect(settings.modules.search).toBe(false);
    expect(settings.modules.videoGallery).toBe(true);
    expect(settings.usefulLinks).toEqual([]); // ma'lumot bor, lekin modul o'chiq

    const search = await get('/search?q=texnikum&locale=uz');
    expect(search.status).toBe(404);
    expect(search.body.error.code).toBe('MODULE_DISABLED');

    // sahifalar (modul bo'yicha)
    expect((await get('/pages/transparency?locale=uz')).status).toBe(404);
    expect((await get('/pages/open-data?locale=uz')).status).toBe(404);
    expect((await get('/pages/activity?locale=uz')).status).toBe(404);
    expect((await get('/pages/teachers?locale=uz')).status).toBe(404);
    expect((await get('/pages/about?locale=uz')).status).toBe(200);
    expect((await get('/pages/admission?locale=uz')).status).toBe(200);
    expect((await get('/staff?locale=uz&kind=TEACHER')).status).toBe(404);

    // menyu: o'chirilgan bo'limlar yo'qoladi, yangi bo'limlar bor
    const nav = (await get('/navigation?locale=uz')).body.main;
    const flat = JSON.stringify(nav);
    expect(flat).not.toContain('/uz/transparency');
    expect(flat).not.toContain('/uz/activity');
    expect(flat).not.toContain('/uz/teachers');
    expect(flat).toContain('/uz/admission');
    expect(flat).toContain('/uz/alumni');
    expect(flat).toContain('/uz/partners');

    // sitemap
    const sm = (await request(app).get('/sitemap.xml')).text;
    expect(sm).not.toContain('/uz/transparency');
    expect(sm).toContain('/uz/admission');
  });

  it('administrator modulni yoqadi — saytda darhol paydo bo‘ladi; o‘chirsa, ma’lumot yo‘qolmaydi', async () => {
    await resetContent();
    await seedStructure(prisma);
    await setModules({});
    const id = (await api.post(`${A}/news`, newsBody('qidiruv-sinovi', 'Qidiruv sinovi yangiligi'))).body.id;
    await api.post(`${A}/news/${id}/publish`).expect(200);

    expect((await get('/search?q=Qidiruv&locale=uz')).status).toBe(404);
    await api.patch(`${A}/settings`, { modules: { search: true } }).expect(200);
    const on = await get('/search?q=Qidiruv&locale=uz');
    expect(on.status).toBe(200);
    expect(on.body.items[0].title).toBe('Qidiruv sinovi yangiligi');

    // "teachers" va "transparency" yoqilganda sahifalar qaytadi
    await api.patch(`${A}/settings`, { modules: { search: true, transparency: true } }).expect(200);
    expect((await get('/pages/open-data?locale=uz')).status).toBe(200);
    expect(JSON.stringify((await get('/navigation?locale=uz')).body.main)).toContain('/uz/transparency');

    // qayta o'chirish: kontent bazada qoladi
    await api.patch(`${A}/settings`, { modules: { search: false, transparency: false } }).expect(200);
    expect((await get('/search?q=Qidiruv&locale=uz')).status).toBe(404);
    expect(await prisma.news.count()).toBe(1);
    expect(await prisma.page.count({ where: { module: 'transparency' } })).toBeGreaterThan(0);
  });

  it('yangilik turlari alohida yoqiladi: o‘chirilgan tur ro‘yxat, sahifa va sitemapda ko‘rinmaydi', async () => {
    await resetContent();
    const n = (await api.post(`${A}/news`, newsBody('yangilik-1', 'Yangilik 1'))).body.id;
    const a = (await api.post(`${A}/news`, newsBody('elon-1', 'E’lon 1', { type: 'ANNOUNCEMENT' }))).body.id;
    await api.post(`${A}/news/${n}/publish`);
    await api.post(`${A}/news/${a}/publish`);
    expect((await get('/news?locale=uz')).body.meta.total).toBe(2);

    await setModules({ announcements: false });
    expect((await get('/news?locale=uz')).body.items.map((i: { slug: string }) => i.slug)).toEqual(['yangilik-1']);
    const listOff = await get('/news?locale=uz&type=ANNOUNCEMENT');
    expect(listOff.status).toBe(404);
    expect((await get('/news/elon-1?locale=uz')).status).toBe(404);
    expect((await request(app).get('/sitemap.xml')).text).not.toContain('elon-1');
    expect((await get('/news/yangilik-1?locale=uz')).status).toBe(200);
  });

  it('o‘chirilgan modul admin API’da ham yopiladi; hujjat turlari modulga bog‘liq', async () => {
    await resetContent();
    await setModules({ videoGallery: false, alumni: false, admission: false });
    expect((await api.get(`${A}/videos`)).status).toBe(404);
    expect((await api.get(`${A}/alumni`)).body.error.code).toBe('MODULE_DISABLED');
    expect((await get('/videos?locale=uz')).status).toBe(404);

    const file = (await api.upload(`${A}/media`, PDF_BYTES, 'qabul.pdf')).body;
    const doc = (await api.post(`${A}/documents`, { type: 'ADMISSION', fileMediaId: file.id, status: 'PUBLISHED', translations: { uz: { title: 'Qabul qoidalari', description: '' } } })).body;
    expect((await get('/documents?locale=uz')).body.items).toHaveLength(0);
    expect((await get(`/documents/${doc.id}/download`)).status).toBe(404);
    await enableAllModules();
    expect((await get('/documents?locale=uz')).body.items).toHaveLength(1);
    expect((await get(`/documents/${doc.id}/download`)).status).toBe(200);
  });

  it('modullarni faqat ruxsati bor foydalanuvchi o‘zgartiradi; noto‘g‘ri kalit rad etiladi', async () => {
    const res = await api.patch(`${A}/settings`, { modules: { yoq: true } });
    expect(res.status).toBe(400);
    const me = (await api.get(`${A}/auth/me`)).body;
    expect(me.modules).toBeDefined();
    expect(Object.keys(me.modules).sort()).toEqual(MODULES.map((m) => m.key).sort());
  });

  it('sahifa elementi: modul o‘chirilgan bo‘lsa, bo‘limdagi ichki sahifalar ro‘yxatdan chiqadi', async () => {
    await resetContent();
    const parent = (await api.post(`${A}/pages`, pageBody('bolim-x', 'Bo‘lim X', { template: 'SECTION' }))).body;
    const child = (await api.post(`${A}/pages`, pageBody('ichki-x', 'Ichki X', { parentId: parent.id }))).body;
    await api.post(`${A}/pages/${parent.id}/publish`);
    await api.post(`${A}/pages/${child.id}/publish`);
    await prisma.page.update({ where: { id: child.id }, data: { module: 'activity' } });
    await setModules({ activity: false });
    expect((await get('/pages/bolim-x?locale=uz')).body.children).toEqual([]);
    expect((await get('/pages/ichki-x?locale=uz')).status).toBe(404);
    await setModules({ activity: true });
    expect((await get('/pages/bolim-x?locale=uz')).body.children).toHaveLength(1);
  });
});
