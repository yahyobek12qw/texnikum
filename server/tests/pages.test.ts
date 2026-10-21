import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A, P, createAdminUser, loginAgent, makeApp, pageBody, resetAll, resetContent, type AdminApi,
} from './helpers.js';

describe('sahifalar', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  it('yangi sahifa yaratadi (qoralama sifatida) va qoralama ommaviy API’da ko‘rinmaydi', async () => {
    const res = await api.post(`${A}/pages`, pageBody('tarix', 'Tarix'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.translations.uz.slug).toBe('tarix');
    expect(res.body.translationStatus).toEqual({ uz: true, ru: false, en: false });

    const pub = await request(app).get(`${P}/pages/tarix?locale=uz`);
    expect(pub.status).toBe(404);
  });

  it('sahifani tahrirlaydi', async () => {
    const created = (await api.post(`${A}/pages`, pageBody('tarix', 'Tarix'))).body;
    const res = await api.patch(`${A}/pages/${created.id}`, {
      translations: { uz: { title: 'Tarix (yangi)', slug: 'tarix', content: '<p>Yangi matn</p>' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.translations.uz.title).toBe('Tarix (yangi)');
    expect(res.body.translations.uz.content).toBe('<p>Yangi matn</p>');
  });

  it('nashr qiladi, ommaviy API’da ko‘rinadi, nashrdan qaytarilsa yana yo‘qoladi', async () => {
    const { id } = (await api.post(`${A}/pages`, pageBody('tarix', 'Tarix'))).body;
    const pub = await api.post(`${A}/pages/${id}/publish`);
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe('PUBLISHED');
    expect(pub.body.publishedAt).toBeTruthy();

    const visible = await request(app).get(`${P}/pages/tarix?locale=uz`);
    expect(visible.status).toBe(200);
    expect(visible.body.title).toBe('Tarix');

    await api.post(`${A}/pages/${id}/unpublish`).expect(200);
    expect((await request(app).get(`${P}/pages/tarix?locale=uz`)).status).toBe(404);
  });

  it('arxivlaydi — arxivlangan sahifa ommaviy ko‘rinmaydi', async () => {
    const { id } = (await api.post(`${A}/pages`, pageBody('arxiv', 'Arxiv'))).body;
    await api.post(`${A}/pages/${id}/publish`).expect(200);
    const archived = await api.post(`${A}/pages/${id}/archive`);
    expect(archived.body.status).toBe('ARCHIVED');
    expect((await request(app).get(`${P}/pages/arxiv?locale=uz`)).status).toBe(404);
  });

  it('takroriy slugni rad etadi (409 SLUG_TAKEN)', async () => {
    await api.post(`${A}/pages`, pageBody('bir', 'Bir')).expect(201);
    const dup = await api.post(`${A}/pages`, pageBody('bir', 'Boshqa'));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');

    // tahrirlashda ham
    const other = (await api.post(`${A}/pages`, pageBody('ikki', 'Ikki'))).body;
    const edit = await api.patch(`${A}/pages/${other.id}`, { translations: { uz: { title: 'Ikki', slug: 'bir', content: '' } } });
    expect(edit.status).toBe(409);
  });

  it('tizim uchun band slugni rad etadi', async () => {
    const res = await api.post(`${A}/pages`, pageBody('news', 'Yangiliklar'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_RESERVED');
  });

  it('noto‘g‘ri ma’lumotni validatsiya qiladi', async () => {
    const res = await api.post(`${A}/pages`, { template: 'DEFAULT', sortOrder: 0, translations: { uz: { title: '', slug: 'Noto g ri', content: '' } } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('har tahrirda versiya saqlanadi va oldingi versiyani tiklaydi', async () => {
    const { id } = (await api.post(`${A}/pages`, pageBody('versiya', 'Birinchi sarlavha'))).body;
    await api.patch(`${A}/pages/${id}`, { translations: { uz: { title: 'Ikkinchi sarlavha', slug: 'versiya', content: '<p>2</p>' } } }).expect(200);
    await api.patch(`${A}/pages/${id}`, { translations: { uz: { title: 'Uchinchi sarlavha', slug: 'versiya', content: '<p>3</p>' } } }).expect(200);

    const versions = (await api.get(`${A}/pages/${id}/versions`)).body.items;
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);

    const restored = await api.post(`${A}/pages/${id}/restore-version`, { version: 1 });
    expect(restored.status).toBe(200);
    expect(restored.body.translations.uz.title).toBe('Birinchi sarlavha');

    // tiklash yangi versiya sifatida qayd etiladi
    const after = (await api.get(`${A}/pages/${id}/versions`)).body.items;
    expect(after[0].version).toBe(4);

    expect((await api.post(`${A}/pages/${id}/restore-version`, { version: 99 })).status).toBe(404);
  });

  it('ota sahifa tanlash: sikl va o‘z-o‘zini ota qilishni rad etadi, ichki sahifasi bor sahifa o‘chirilmaydi', async () => {
    const parent = (await api.post(`${A}/pages`, pageBody('ota', 'Ota'))).body;
    const child = (await api.post(`${A}/pages`, pageBody('bola', 'Bola', { parentId: parent.id }))).body;
    expect(child.parentId).toBe(parent.id);

    expect((await api.patch(`${A}/pages/${parent.id}`, { parentId: child.id })).status).toBe(400);
    expect((await api.patch(`${A}/pages/${parent.id}`, { parentId: parent.id })).status).toBe(400);

    const del = await api.del(`${A}/pages/${parent.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('HAS_CHILDREN');

    await api.del(`${A}/pages/${child.id}`).expect(204);
    await api.del(`${A}/pages/${parent.id}`).expect(204);
  });

  it('rich-text kontentni tozalaydi (XSS)', async () => {
    const dirty =
      '<p onclick="alert(1)">Salom<script>alert(1)</script></p>' +
      '<a href="javascript:alert(1)">bos</a><img src="x" onerror="alert(1)">' +
      '<iframe src="https://evil.example"></iframe><a href="https://ok.uz">ok</a>';
    const res = await api.post(`${A}/pages`, pageBody('xss', 'XSS', { translations: { uz: { title: 'XSS', slug: 'xss', content: dirty } } }));
    expect(res.status).toBe(201);
    const html: string = res.body.translations.uz.content;
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|<iframe/i);
    expect(html).toContain('Salom');
    expect(html).toMatch(/href="https:\/\/ok\.uz"[^>]*rel="noopener noreferrer"/);
  });

  it('ommaviy sahifada nashr qilingan ichki sahifalar va nonushta (breadcrumbs) qaytadi', async () => {
    const parent = (await api.post(`${A}/pages`, pageBody('bolim', 'Bo‘lim', { template: 'SECTION' }))).body;
    const published = (await api.post(`${A}/pages`, pageBody('ichki-1', 'Ichki 1', { parentId: parent.id }))).body;
    await api.post(`${A}/pages`, pageBody('ichki-2', 'Ichki 2 (qoralama)', { parentId: parent.id }));
    await api.post(`${A}/pages/${parent.id}/publish`);
    await api.post(`${A}/pages/${published.id}/publish`);

    const section = (await request(app).get(`${P}/pages/bolim?locale=uz`)).body;
    expect(section.children.map((c: { slug: string }) => c.slug)).toEqual(['ichki-1']);

    const child = (await request(app).get(`${P}/pages/ichki-1?locale=uz`)).body;
    expect(child.breadcrumbs).toEqual([{ title: 'Bo‘lim', href: '/uz/bolim' }]);
    // yon navigatsiya: ichki sahifa ota bo'limning nashr qilingan sahifalarini ko'radi (qoralamalarsiz)
    expect(child.section).toEqual({ title: 'Bo‘lim', href: '/uz/bolim', items: [expect.objectContaining({ slug: 'ichki-1' })] });
    expect(section.section.items).toHaveLength(1);
  });
});
