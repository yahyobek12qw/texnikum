import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { A, P, createAdminUser, loginAgent, makeApp, newsBody, pageBody, resetAll, resetContent, type AdminApi } from './helpers.js';

describe('uch tilli kontent', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  async function publishedAbout() {
    const { id } = (await api.post(`${A}/pages`, pageBody('about', 'Texnikum haqida'))).body;
    await api.post(`${A}/pages/${id}/publish`);
    return id as string;
  }

  it('o‘zbekcha sahifa yaratadi; ruscha va inglizcha tarjima qo‘shadi (alohida slug bilan)', async () => {
    const id = await publishedAbout();
    const res = await api.patch(`${A}/pages/${id}`, {
      translations: {
        ru: { title: 'О техникуме', slug: 'o-tekhnikume', content: '<p>Текст</p>' },
        en: { title: 'About the college', slug: 'about-us', content: '<p>Text</p>' },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.translationStatus).toEqual({ uz: true, ru: true, en: true });

    const ru = (await request(app).get(`${P}/pages/o-tekhnikume?locale=ru`)).body;
    expect(ru.title).toBe('О техникуме');
    expect(ru.isFallback).toBe(false);
    expect(ru.locale).toBe('ru');
    const en = (await request(app).get(`${P}/pages/about-us?locale=en`)).body;
    expect(en.title).toBe('About the college');
    expect(en.alternates).toEqual([
      { locale: 'uz', slug: 'about', available: true },
      { locale: 'ru', slug: 'o-tekhnikume', available: true },
      { locale: 'en', slug: 'about-us', available: true },
    ]);
  });

  it('til almashtirganda: uz slug bilan ru so‘ralsa, ruscha sahifaning slugi qaytadi (mos sahifaga o‘tish)', async () => {
    const id = await publishedAbout();
    await api.patch(`${A}/pages/${id}`, { translations: { ru: { title: 'О техникуме', slug: 'o-tekhnikume', content: '' } } });

    const res = await request(app).get(`${P}/pages/about?locale=ru`);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('o-tekhnikume');
    expect(res.body.title).toBe('О техникуме');
    expect(res.body.isFallback).toBe(false);
  });

  it('tarjima mavjud bo‘lmasa: aniq fallback (uz) va foydalanuvchiga asl til ma’lum qilinadi', async () => {
    await publishedAbout();
    const res = await request(app).get(`${P}/pages/about?locale=en`);
    expect(res.status).toBe(200);
    expect(res.body.isFallback).toBe(true);
    expect(res.body.requestedLocale).toBe('en');
    expect(res.body.locale).toBe('uz');
    expect(res.body.title).toBe('Texnikum haqida');
    // mavjud bo‘lmagan tarjima "bor" deb ko‘rsatilmaydi
    expect(res.body.alternates.find((a: { locale: string }) => a.locale === 'en')).toEqual({ locale: 'en', slug: null, available: false });
  });

  it('so‘ralgan til yo‘q bo‘lsa, fallback tartibida avval uz olinadi (boshqa tildagi slug bilan so‘ralganda ham)', async () => {
    const id = await publishedAbout();
    await api.patch(`${A}/pages/${id}`, { translations: { ru: { title: 'О техникуме', slug: 'o-tekhnikume', content: '' } } });
    // ruscha slug bilan inglizcha so'raladi: en yo'q -> uz (birinchi fallback)
    const res = await request(app).get(`${P}/pages/o-tekhnikume?locale=en`);
    expect(res.body.locale).toBe('uz');
    expect(res.body.isFallback).toBe(true);
  });

  it('tarjimani null bilan o‘chiradi; o‘zbekcha tarjimani o‘chirib bo‘lmaydi', async () => {
    const id = await publishedAbout();
    await api.patch(`${A}/pages/${id}`, { translations: { ru: { title: 'О техникуме', slug: 'o-tekhnikume', content: '' } } });
    const res = await api.patch(`${A}/pages/${id}`, { translations: { ru: null } });
    expect(res.body.translationStatus.ru).toBe(false);
    const bad = await api.patch(`${A}/pages/${id}`, { translations: { uz: null } });
    expect(bad.status).toBe(400);
  });

  it('bir xil slug turli tillarda mustaqil bo‘la oladi', async () => {
    const id = await publishedAbout();
    const res = await api.patch(`${A}/pages/${id}`, { translations: { ru: { title: 'О нас', slug: 'about', content: '' } } });
    expect(res.status).toBe(200);
    expect((await request(app).get(`${P}/pages/about?locale=ru`)).body.title).toBe('О нас');
    expect((await request(app).get(`${P}/pages/about?locale=uz`)).body.title).toBe('Texnikum haqida');
  });

  it('yangiliklar: til bo‘yicha slug, fallback va alternates', async () => {
    const { id } = (await api.post(`${A}/news`, newsBody('birinchi', 'Birinchi yangilik'))).body;
    await api.patch(`${A}/news/${id}`, { translations: { ru: { title: 'Первая новость', slug: 'pervaya', excerpt: '', content: '' } } });
    await api.post(`${A}/news/${id}/publish`);

    const ru = (await request(app).get(`${P}/news/pervaya?locale=ru`)).body;
    expect(ru.title).toBe('Первая новость');
    expect(ru.isFallback).toBe(false);
    const en = (await request(app).get(`${P}/news/birinchi?locale=en`)).body;
    expect(en.isFallback).toBe(true);
    expect(en.locale).toBe('uz');
    expect(en.alternates.map((a: { available: boolean }) => a.available)).toEqual([true, true, false]);

    const list = (await request(app).get(`${P}/news?locale=ru`)).body;
    expect(list.items[0].title).toBe('Первая новость');
    const listEn = (await request(app).get(`${P}/news?locale=en`)).body;
    expect(listEn.items[0].isFallback).toBe(true);
  });

  it('noto‘g‘ri til parametrini rad etadi', async () => {
    const res = await request(app).get(`${P}/pages/about?locale=de`);
    expect(res.status).toBe(400);
  });

  it('admin: tarjimalar holati ro‘yxati yetishmayotgan tillar bo‘yicha filtrlanadi', async () => {
    const id = await publishedAbout();
    await api.patch(`${A}/pages/${id}`, { translations: { ru: { title: 'О нас', slug: 'o-nas', content: '' } } });
    await api.post(`${A}/pages`, pageBody('boshqa', 'Boshqa'));
    const all = (await api.get(`${A}/translations?entity=page`)).body;
    expect(all.meta.total).toBe(2);
    const missingRu = (await api.get(`${A}/translations?entity=page&missing=ru`)).body;
    expect(missingRu.items.map((i: { title: string }) => i.title)).toEqual(['Boshqa']);
  });
});
