import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedStructure } from '../../prisma/seed.js';
import { prisma } from '../src/lib/prisma.js';
import {
  A, P, createAdminUser, loginAgent, makeApp, newsBody, pageBody, pngBuffer, resetAll, resetContent, type AdminApi,
} from './helpers.js';

describe('menyu, sozlamalar, qidiruv, SEO, audit', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  const label = (uz: string, ru = '', en = '') => ({ uz, ru, en });

  it('menyu o‘zgarishi ommaviy API’da aks etadi; qoralama sahifa menyudan yashiriladi', async () => {
    const pub = (await api.post(`${A}/pages`, pageBody('haqida', 'Haqida'))).body;
    const draft = (await api.post(`${A}/pages`, pageBody('yashirin', 'Yashirin'))).body;
    await api.post(`${A}/pages/${pub.id}/publish`);

    const res = await api.put(`${A}/navigation`, {
      menus: [
        {
          key: 'main',
          items: [
            { kind: 'PAGE', pageId: pub.id, newTab: false, labels: label('Haqida', 'О нас', 'About'), children: [
              { kind: 'EXTERNAL', url: 'https://gov.uz', newTab: true, labels: label('Hukumat portali'), children: [] },
            ] },
            { kind: 'PAGE', pageId: draft.id, newTab: false, labels: label('Yashirin'), children: [] },
            { kind: 'ROUTE', route: '/news', newTab: false, labels: label('Yangiliklar', 'Новости', 'News'), children: [] },
          ],
        },
        { key: 'footer', items: [] },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.menus[0].items).toHaveLength(3);

    const uz = (await request(app).get(`${P}/navigation?locale=uz`)).body;
    expect(uz.main.map((i: { label: string }) => i.label)).toEqual(['Haqida', 'Yangiliklar']);
    expect(uz.main[0].href).toBe('/uz/haqida');
    expect(uz.main[0].children[0]).toMatchObject({ href: 'https://gov.uz', external: true, newTab: true });
    expect(uz.main[1].href).toBe('/uz/news');

    const ru = (await request(app).get(`${P}/navigation?locale=ru`)).body;
    expect(ru.main[0].label).toBe('О нас');
    // inglizcha nom bo'sh bo'lsa, fallback sifatida o'zbekcha ko'rsatiladi
    expect((await request(app).get(`${P}/navigation?locale=en`)).body.main[0].label).toBe('About');
    expect(ru.main[0].children[0].label).toBe('Hukumat portali');

    // tartib o'zgartiriladi
    const swapped = res.body.menus[0].items;
    await api.put(`${A}/navigation`, {
      menus: [{ key: 'main', items: [swapped[2], swapped[0]].map((i: Record<string, unknown>) => ({ ...i, labels: i.labels, children: i.children })) }],
    }).expect(200);
    const after = (await request(app).get(`${P}/navigation?locale=uz`)).body;
    expect(after.main.map((i: { label: string }) => i.label)).toEqual(['Yangiliklar', 'Haqida']);
  });

  it('menyuda xavfli URL va to‘liq bo‘lmagan band rad etiladi', async () => {
    const js = await api.put(`${A}/navigation`, { menus: [{ key: 'main', items: [{ kind: 'EXTERNAL', url: 'javascript:alert(1)', newTab: false, labels: label('x'), children: [] }] }] });
    expect(js.status).toBe(400);
    const noLabel = await api.put(`${A}/navigation`, { menus: [{ key: 'main', items: [{ kind: 'ROUTE', route: '/news', newTab: false, labels: label(''), children: [] }] }] });
    expect(noLabel.status).toBe(400);
    const noPage = await api.put(`${A}/navigation`, { menus: [{ key: 'main', items: [{ kind: 'PAGE', newTab: false, labels: label('x'), children: [] }] }] });
    expect(noPage.status).toBe(400);
  });

  it('sayt sozlamalari bazada saqlanadi va ommaviy API tilga moslab qaytaradi', async () => {
    const empty = (await api.get(`${A}/settings`)).body;
    expect(empty.general.officialName).toEqual({ uz: '', ru: '', en: '' });

    const logo = (await api.upload(`${A}/media`, await pngBuffer(), 'logo.png')).body;
    const patch = await api.patch(`${A}/settings`, {
      general: { officialName: label('Test texnikumi', 'Тестовый техникум', 'Test College'), shortName: label('TT'), logoMediaId: logo.id },
      contacts: { address: label('Test manzil'), phones: ['+998 71 000 00 00'], email: 'info@test.uz', workingHours: label('Du-Ju 9:00-18:00'), mapUrl: 'https://maps.example/x' },
      usefulLinks: [{ id: 'l1', label: label('Vazirlik', 'Министерство'), url: 'https://edu.uz' }],
      banners: [{ id: 'b1', imageMediaId: logo.id, title: label('Banner'), text: label(''), linkUrl: '/uz/news', isActive: true }, { id: 'b2', imageMediaId: null, title: label('Faol emas'), text: label(''), linkUrl: '', isActive: false }],
    });
    expect(patch.status).toBe(200);

    const uz = (await request(app).get(`${P}/settings?locale=uz`)).body;
    expect(uz.officialName).toBe('Test texnikumi');
    expect(uz.logo.url).toBe(logo.url ?? uz.logo.url);
    expect(uz.phones).toEqual(['+998 71 000 00 00']);
    expect(uz.banners).toHaveLength(1); // faqat faol banner
    const ru = (await request(app).get(`${P}/settings?locale=ru`)).body;
    expect(ru.officialName).toBe('Тестовый техникум');
    expect(ru.usefulLinks[0].label).toBe('Министерство');
    // inglizcha tarjima yo'q -> uzbekcha fallback
    expect((await request(app).get(`${P}/settings?locale=en`)).body.usefulLinks[0].label).toBe('Vazirlik');

    // sozlamalarda ishlatilayotgan logotipni o'chirib bo'lmaydi
    const del = await api.del(`${A}/media/${logo.id}?force=true`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('MEDIA_IN_USE_BLOCKING');
  });

  it('sozlamalarda xavfli havola va noto‘g‘ri email rad etiladi', async () => {
    const bad = await api.patch(`${A}/settings`, { social: { telegram: 'javascript:alert(1)', instagram: '', facebook: '', youtube: '' } });
    expect(bad.status).toBe(400);
    const badMail = await api.patch(`${A}/settings`, { contacts: { address: label(''), phones: [], email: 'noto-gri', workingHours: label(''), mapUrl: '' } });
    expect(badMail.status).toBe(400);
    expect((await api.patch(`${A}/settings`, {})).status).toBe(400);
  });

  it('qidiruv tanlangan til bo‘yicha nashr qilingan kontentdan topadi; sahifalash ishlaydi', async () => {
    const p = (await api.post(`${A}/pages`, pageBody('amaliyot', 'Amaliyot', { translations: { uz: { title: 'Amaliyot', slug: 'amaliyot', content: '<p>Talabalar korxonalarda amaliyot o‘taydi</p>' }, ru: { title: 'Практика', slug: 'praktika', content: '<p>Студенты проходят практику</p>' } } }))).body;
    await api.post(`${A}/pages/${p.id}/publish`);
    for (let i = 1; i <= 3; i++) {
      const n = (await api.post(`${A}/news`, newsBody(`n${i}`, `Amaliyot yangiligi ${i}`))).body;
      await api.post(`${A}/news/${n.id}/publish`);
    }

    const uz = (await request(app).get(`${P}/search?locale=uz&q=amaliyot&pageSize=2`)).body;
    expect(uz.meta.total).toBe(4);
    expect(uz.items).toHaveLength(2);
    expect(uz.items.every((i: { snippet: string }) => typeof i.snippet === 'string')).toBe(true);

    const ru = (await request(app).get(`${P}/search?locale=ru&q=ПРАКТИКУ`)).body; // katta-kichik harfga befarq
    expect(ru.items).toHaveLength(1);
    expect(ru.items[0]).toMatchObject({ type: 'page', href: '/ru/praktika' });

    expect((await request(app).get(`${P}/search?locale=uz&q=yoqsoz`)).body.items).toHaveLength(0);
    expect((await request(app).get(`${P}/search?locale=uz&q=a`)).status).toBe(400);
  });

  it('sitemap.xml faqat nashr qilinganlarni hreflang bilan beradi, robots.txt admin va api’ni yopadi', async () => {
    const pub = (await api.post(`${A}/pages`, pageBody('ochiq-sahifa', 'Ochiq', { translations: { uz: { title: 'Ochiq', slug: 'ochiq-sahifa', content: '' }, ru: { title: 'Открытая', slug: 'otkrytaya', content: '' } } }))).body;
    await api.post(`${A}/pages/${pub.id}/publish`);
    await api.post(`${A}/pages`, pageBody('qoralama-sahifa', 'Qoralama'));

    const sm = await request(app).get('/sitemap.xml');
    expect(sm.status).toBe(200);
    expect(sm.headers['content-type']).toMatch(/xml/);
    expect(sm.text).toContain('http://localhost:5173/uz/ochiq-sahifa');
    expect(sm.text).toContain('hreflang="ru" href="http://localhost:5173/ru/otkrytaya"');
    expect(sm.text).not.toContain('qoralama-sahifa');

    const robots = await request(app).get('/robots.txt');
    expect(robots.text).toContain('Disallow: /admin');
    expect(robots.text).toContain('Sitemap: http://localhost:5173/sitemap.xml');
  });

  it('kategoriya, yo‘nalish va xodim CRUD; ishlatilayotgan kategoriya o‘chirilmaydi', async () => {
    const cat = (await api.post(`${A}/categories`, { scope: 'NEWS', sortOrder: 1, translations: { uz: { name: 'Tadbirlar', slug: 'tadbirlar' }, ru: { name: 'События', slug: 'sobytiya' } } })).body;
    const dupe = await api.post(`${A}/categories`, { scope: 'NEWS', sortOrder: 2, translations: { uz: { name: 'Boshqa', slug: 'tadbirlar' } } });
    expect(dupe.status).toBe(409);
    const n = (await api.post(`${A}/news`, newsBody('kat', 'Kat', { categoryId: cat.id }))).body;
    const del = await api.del(`${A}/categories/${cat.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CATEGORY_IN_USE');
    // hujjat kategoriyasini yangilikka berib bo'lmaydi
    const docCat = (await api.post(`${A}/categories`, { scope: 'DOCUMENT', sortOrder: 0, translations: { uz: { name: 'Hujjat kat.', slug: 'hujjat-kat' } } })).body;
    expect((await api.patch(`${A}/news/${n.id}`, { categoryId: docCat.id })).status).toBe(400);

    const prog = await api.post(`${A}/education-programs`, { code: '60610100', sortOrder: 0, translations: { uz: { title: 'Dasturiy injiniring', summary: 'Qisqa', description: '<p>Tavsif</p>', duration: '3 yil', qualification: '' } } });
    expect(prog.status).toBe(201);
    expect((await request(app).get(`${P}/education-programs?locale=uz`)).body.items).toHaveLength(0);
    await api.post(`${A}/education-programs/${prog.body.id}/publish`).expect(200);
    const pubProg = (await request(app).get(`${P}/education-programs?locale=uz`)).body.items;
    expect(pubProg[0]).toMatchObject({ title: 'Dasturiy injiniring', code: '60610100', duration: '3 yil' });

    const st = await api.post(`${A}/staff`, { kind: 'LEADERSHIP', sortOrder: 0, email: 'direktor@test.uz', phone: '+998 71 111 11 11', translations: { uz: { fullName: 'Test F.I.Sh.', position: 'Direktor', bio: '' } } });
    expect(st.status).toBe(201);
    expect((await request(app).get(`${P}/staff?locale=uz&kind=LEADERSHIP`)).body.items).toHaveLength(0);
    await api.post(`${A}/staff/${st.body.id}/publish`).expect(200);
    const list = (await request(app).get(`${P}/staff?locale=uz&kind=LEADERSHIP`)).body.items;
    expect(list[0]).toMatchObject({ fullName: 'Test F.I.Sh.', position: 'Direktor' });
    expect((await request(app).get(`${P}/staff?locale=uz&kind=TEACHER`)).body.items).toHaveLength(0);
    expect((await api.post(`${A}/staff`, { kind: 'STAFF', sortOrder: 0, email: 'xato', translations: { uz: { fullName: 'A', position: '', bio: '' } } })).status).toBe(400);
  });

  it('dashboard statistikasi bazadan hisoblanadi; audit jurnali amallarni qayd etadi', async () => {
    const empty = (await api.get(`${A}/dashboard`)).body;
    expect(empty.pages).toEqual({ total: 0, published: 0, draft: 0, archived: 0 });
    expect(empty.news.total).toBe(0);

    const a = (await api.post(`${A}/pages`, pageBody('a', 'A'))).body;
    await api.post(`${A}/pages`, pageBody('b', 'B'));
    await api.post(`${A}/pages/${a.id}/publish`);
    await api.post(`${A}/news`, newsBody('x', 'X'));
    await api.upload(`${A}/media`, await pngBuffer(), 'r.png');

    const stats = (await api.get(`${A}/dashboard`)).body;
    expect(stats.pages).toEqual({ total: 2, published: 1, draft: 1, archived: 0 });
    expect(stats.news).toMatchObject({ total: 1, draft: 1, published: 0 });
    expect(stats.media.total).toBe(1);
    expect(stats.recentContent.length).toBe(3);
    expect(stats.recentActions.length).toBeGreaterThan(0);

    const log = (await api.get(`${A}/audit-logs?entity=page`)).body;
    expect(log.items.map((i: { action: string }) => i.action)).toEqual(expect.arrayContaining(['CREATE', 'PUBLISH']));
    expect(log.items[0].userEmail).toBe('admin@test.uz');
    expect(JSON.stringify(log)).not.toMatch(/passwordHash|csrf/i);
  });

  it('seed: sayt tuzilmasini yaratadi, qayta ishga tushirilsa takrorlamaydi va soxta kontent kiritmaydi', async () => {
    const first = await seedStructure(prisma);
    expect(first.pages).toBeGreaterThan(10);
    const second = await seedStructure(prisma);
    expect(second.pages).toBe(0);
    expect(await prisma.news.count()).toBe(0);
    expect(await prisma.document.count()).toBe(0);
    expect(await prisma.pageTranslation.count({ where: { content: { not: '' } } })).toBe(0);

    const nav = (await request(app).get(`${P}/navigation?locale=ru`)).body;
    expect(nav.main.length).toBeGreaterThan(5);
    expect(nav.main[1].children.length).toBe(4);
    const leadership = (await request(app).get(`${P}/pages/leadership?locale=uz`)).body;
    expect(leadership).toMatchObject({ template: 'STAFF', options: { staffKind: 'LEADERSHIP' } });
  });

  it('noma’lum API yo‘nalishi JSON xatolik qaytaradi, health-check ishlaydi', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const bad = await request(app).post(`${A}/auth/login`).set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
    expect((await request(app).get('/healthz')).body).toEqual({ status: 'ok' });
  });
});
