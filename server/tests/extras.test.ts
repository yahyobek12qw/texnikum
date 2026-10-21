import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseVideoUrl } from '@uchkoprik/shared';
import { prisma } from '../src/lib/prisma.js';
import {
  A, P, createAdminUser, loginAgent, makeApp, newsBody, pageBody, pngBuffer, resetAll, resetContent, type AdminApi,
} from './helpers.js';

describe('video, bitiruvchilar, hamkorlar, statistika va hisobotlar', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  const get = (path: string) => request(app).get(`${P}${path}`);
  const tr = (title: string) => ({ uz: { title, description: 'Tavsif' } });

  it('video havolasi: faqat YouTube va Vimeo qabul qilinadi', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'YOUTUBE', externalId: 'dQw4w9WgXcQ' });
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=5')?.externalId).toBe('dQw4w9WgXcQ');
    expect(parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ')?.provider).toBe('YOUTUBE');
    expect(parseVideoUrl('https://vimeo.com/76979871')).toEqual({ provider: 'VIMEO', externalId: '76979871' });
    for (const bad of ['https://evil.example/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com/watch?v=qisqa', 'https://notyoutube.com/watch?v=dQw4w9WgXcQ', 'matn']) {
      expect(parseVideoUrl(bad), bad).toBeNull();
    }
  });

  it('videogalereya: yaratish, qoralama yashirin, nashr, uch tilda, noto‘g‘ri havola rad', async () => {
    const bad = await api.post(`${A}/videos`, { sourceUrl: 'https://evil.example/v', sortOrder: 0, translations: tr('X') });
    expect(bad.status).toBe(400);

    const created = await api.post(`${A}/videos`, { sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', sortOrder: 0, translations: { ...tr('Kollej hayoti'), ru: { title: 'Жизнь колледжа', description: '' } } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ provider: 'YOUTUBE', externalId: 'dQw4w9WgXcQ', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect((await get('/videos?locale=uz')).body.items).toHaveLength(0);
    await api.post(`${A}/videos/${created.body.id}/publish`).expect(200);

    const uz = (await get('/videos?locale=uz')).body.items[0];
    expect(uz.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(uz.title).toBe('Kollej hayoti');
    expect((await get('/videos?locale=ru')).body.items[0].title).toBe('Жизнь колледжа');
    const en = (await get('/videos?locale=en')).body.items[0];
    expect(en).toMatchObject({ isFallback: true, locale: 'uz' });

    // havolani almashtirish provayderni qayta aniqlaydi
    const patched = await api.patch(`${A}/videos/${created.body.id}`, { sourceUrl: 'https://vimeo.com/76979871' });
    expect(patched.body).toMatchObject({ provider: 'VIMEO', externalId: '76979871' });
    expect((await get('/videos?locale=uz')).body.items[0].embedUrl).toBe('https://player.vimeo.com/video/76979871?autoplay=1');
  });

  it('bitiruvchilar: CRUD, tarjima va fallback, nashr, rasm', async () => {
    const photo = (await api.upload(`${A}/media`, await pngBuffer(), 'foto.png')).body;
    const a = (await api.post(`${A}/alumni`, {
      graduationYear: 2022, photoMediaId: photo.id, sortOrder: 0,
      translations: { uz: { fullName: 'Namuna Bitiruvchi', program: 'IT', workplace: 'Kompaniya', story: 'Hikoya' }, ru: { fullName: 'Образец Выпускник', program: 'ИТ', workplace: '', story: '' } },
    })).body;
    expect((await get('/alumni?locale=uz')).body.items).toHaveLength(0);
    await api.post(`${A}/alumni/${a.id}/publish`).expect(200);

    const uz = (await get('/alumni?locale=uz')).body.items[0];
    expect(uz).toMatchObject({ fullName: 'Namuna Bitiruvchi', graduationYear: 2022, workplace: 'Kompaniya' });
    expect(uz.photo.url).toBe(photo.url);
    expect((await get('/alumni?locale=ru')).body.items[0].fullName).toBe('Образец Выпускник');
    expect((await get('/alumni?locale=en')).body.items[0].isFallback).toBe(true);

    expect((await api.post(`${A}/alumni`, { graduationYear: 1800, sortOrder: 0, translations: { uz: { fullName: 'X', program: '', workplace: '', story: '' } } })).status).toBe(400);
    await api.del(`${A}/alumni/${a.id}`).expect(204);
    expect((await get('/alumni?locale=uz')).body.items).toHaveLength(0);
  });

  it('hamkor korxonalar: CRUD, logotip va xavfsiz havola', async () => {
    const logo = (await api.upload(`${A}/media`, await pngBuffer(), 'logo.png')).body;
    expect((await api.post(`${A}/partners`, { websiteUrl: 'javascript:alert(1)', sortOrder: 0, translations: { uz: { name: 'X', description: '' } } })).status).toBe(400);
    const p = (await api.post(`${A}/partners`, { websiteUrl: 'https://example.uz', logoMediaId: logo.id, sortOrder: 1, translations: { uz: { name: 'Hamkor MChJ', description: 'Amaliyot hamkori' } } })).body;
    await api.post(`${A}/partners/${p.id}/publish`).expect(200);
    const item = (await get('/partners?locale=uz')).body.items[0];
    expect(item).toMatchObject({ name: 'Hamkor MChJ', websiteUrl: 'https://example.uz' });
    expect(item.logo.url).toBe(logo.url);

    // logotip ishlatilayotgani media foydalanish ro'yxatida ko'rinadi
    const usage = (await api.get(`${A}/media/${logo.id}`)).body.usage;
    expect(usage).toEqual([expect.objectContaining({ type: 'partner', title: 'Hamkor MChJ', blocking: false })]);
  });

  it('qabul hujjati turi (ADMISSION) mavjud; qabul sahifasi hujjatlarni ko‘rsatadi', async () => {
    const file = (await api.upload(`${A}/media`, Buffer.from('%PDF-1.4\n%%EOF\n'), 'qabul.pdf')).body;
    await api.post(`${A}/documents`, { type: 'ADMISSION', fileMediaId: file.id, status: 'PUBLISHED', translations: { uz: { title: 'Qabul qoidalari', description: '' } } }).expect(201);
    const res = await get('/documents?locale=uz&type=ADMISSION');
    expect(res.body.items.map((d: { title: string }) => d.title)).toEqual(['Qabul qoidalari']);
  });

  it('ko‘rishlar hisoblagichi: faqat mavjud sahifalar, botlar va DNT hisobga olinmaydi', async () => {
    const id = (await api.post(`${A}/pages`, pageBody('statistika-sinovi', 'Statistika'))).body.id;
    await api.post(`${A}/pages/${id}/publish`);
    const n = (await api.post(`${A}/news`, newsBody('stat-yangilik', 'Stat yangilik'))).body.id;
    await api.post(`${A}/news/${n}/publish`);

    const track = (path: string, headers: Record<string, string> = {}) => request(app).post(`${P}/track`).set(headers).send({ path });
    expect((await track('/uz/statistika-sinovi?utm=x')).status).toBe(204);
    expect((await track('/uz/statistika-sinovi')).status).toBe(204);
    expect((await track('/uz/news/stat-yangilik')).status).toBe(204);
    expect((await track('/uz')).status).toBe(204);
    // hisobga olinmaydiganlar
    await track('/uz/yoq-sahifa');
    await track('/admin/pages');
    await track('/uz/news/yoq-yangilik');
    await track('/uz/statistika-sinovi', { 'User-Agent': 'Googlebot/2.1' });
    await track('/uz/statistika-sinovi', { DNT: '1' });
    expect((await request(app).post(`${P}/track`).send({})).status).toBe(400);

    const rows = await prisma.pageView.findMany({ orderBy: { path: 'asc' } });
    expect(Object.fromEntries(rows.map((r) => [r.path, r.count]))).toEqual({ '/uz': 1, '/uz/news/stat-yangilik': 1, '/uz/statistika-sinovi': 2 });

    const stats = (await api.get(`${A}/stats?days=7`)).body;
    expect(stats.totals.views).toBe(4);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.at(-1).count).toBe(4);
    expect(stats.topPaths[0]).toEqual({ path: '/uz/statistika-sinovi', count: 2 });
    expect(stats.content).toMatchObject({ pages: 1, news: 1 });
    expect(stats.note).toMatch(/taxminiy/);
  });

  it('statistika moduli o‘chirilsa, hisoblash to‘xtaydi va admin sahifasi yopiladi', async () => {
    const id = (await api.post(`${A}/pages`, pageBody('sahifa-s', 'S'))).body.id;
    await api.post(`${A}/pages/${id}/publish`);
    await prisma.siteSetting.upsert({ where: { key: 'modules' }, create: { key: 'modules', value: { statistics: false } }, update: { value: { statistics: false } } });
    const { invalidateModules } = await import('../src/lib/modules.js');
    invalidateModules();
    await request(app).post(`${P}/track`).send({ path: '/uz/sahifa-s' }).expect(204);
    expect(await prisma.pageView.count()).toBe(0);
    expect((await api.get(`${A}/stats`)).status).toBe(404);
    expect((await get('/settings?locale=uz')).body.statistics).toEqual([]);
  });

  it('“Raqamlarda” ko‘rsatkichlari: administrator kiritadi, ommaviy API tilga moslab beradi', async () => {
    const patch = await api.patch(`${A}/settings`, { statistics: [
      { id: 's1', value: '1200', label: { uz: 'Talabalar', ru: 'Студенты', en: 'Students' } },
      { id: 's2', value: '85', label: { uz: 'O‘qituvchilar', ru: '', en: '' } },
    ] });
    expect(patch.status).toBe(200);
    expect((await get('/settings?locale=ru')).body.statistics).toEqual([
      { id: 's1', value: '1200', label: 'Студенты' },
      { id: 's2', value: '85', label: 'O‘qituvchilar' }, // ruscha yo'q -> o'zbekcha fallback
    ]);
    expect((await api.patch(`${A}/settings`, { statistics: [{ id: 's', value: '', label: { uz: 'X', ru: '', en: '' } }] })).status).toBe(400);
  });

  it('CSV hisobotlar: BOM, to‘g‘ri sarlavhalar, formula in’ektsiyasidan himoya, audit', async () => {
    const evil = (await api.post(`${A}/news`, newsBody('csv-sinov', '=HYPERLINK("http://evil.example","bos")'))).body.id;
    await api.post(`${A}/news/${evil}/publish`);
    const res = await api.get(`${A}/reports/content.csv`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="kontent-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Turi,Sarlavha (uz),Holat,Tillar');
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.example"",""bos"")"`);
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);

    await request(app).post(`${P}/track`).send({ path: '/uz' }).expect(204);
    const views = await api.get(`${A}/reports/views.csv?days=7`);
    expect(views.text).toContain('Sana,Sahifa,Ko‘rishlar');
    expect(views.text).toContain(',/uz,1');
    expect(await prisma.auditLog.count({ where: { action: 'EXPORT' } })).toBe(2);
  });
});
