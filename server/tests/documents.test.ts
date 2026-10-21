import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { A, P, PDF_BYTES, createAdminUser, loginAgent, makeApp, pngBuffer, resetAll, resetContent, type AdminApi } from './helpers.js';

describe('hujjatlar va media', () => {
  const app = makeApp();
  let api: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  const docBody = (fileMediaId: string, extra: object = {}) => ({
    type: 'REGULATION',
    fileMediaId,
    docDate: '2026-01-15',
    number: '12-son',
    translations: { uz: { title: 'Nizom', description: 'Texnikum nizomi' } },
    ...extra,
  });

  it('ruxsat etilgan PDF faylni yuklaydi', async () => {
    const res = await api.upload(`${A}/media`, PDF_BYTES, 'nizom.pdf');
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('DOCUMENT');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.url).toBeNull(); // hujjatlar to'g'ridan-to'g'ri ommaviy URLga ega emas
  });

  it('noto‘g‘ri formatni rad etadi (haqiqiy tarkib bo‘yicha)', async () => {
    const exe = await api.upload(`${A}/media`, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'virus.pdf');
    expect(exe.status).toBe(415);
    const text = await api.upload(`${A}/media`, Buffer.from('<html><script>alert(1)</script></html>'), 'sahifa.html');
    expect(text.status).toBe(415);
    const svg = await api.upload(`${A}/media`, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'rasm.svg');
    expect(svg.status).toBe(415);
  });

  it('kengaytmasi tarkibiga mos kelmaydigan faylni rad etadi', async () => {
    const res = await api.upload(`${A}/media`, PDF_BYTES, 'hujjat.png');
    expect(res.status).toBe(415);
    const res2 = await api.upload(`${A}/media`, await pngBuffer(), 'rasm.html');
    expect(res2.status).toBe(415);
  });

  it('limitdan katta faylni rad etadi', async () => {
    const big = Buffer.concat([PDF_BYTES, Buffer.alloc(1.2 * 1024 * 1024)]);
    const res = await api.upload(`${A}/media`, big, 'katta.pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('buzilgan rasmni rad etadi', async () => {
    const png = await pngBuffer();
    const broken = Buffer.concat([png.subarray(0, 40), Buffer.alloc(30, 7)]);
    const res = await api.upload(`${A}/media`, broken, 'buzuq.png');
    expect([415, 422]).toContain(res.status);
  });

  it('hujjat yaratadi, nashr qilinmaguncha ommaviy ro‘yxat va yuklab olish bloklanadi', async () => {
    const file = (await api.upload(`${A}/media`, PDF_BYTES, 'nizom.pdf')).body;
    const doc = await api.post(`${A}/documents`, docBody(file.id));
    expect(doc.status).toBe(201);
    expect(doc.body.status).toBe('DRAFT');

    expect((await request(app).get(`${P}/documents?locale=uz`)).body.items).toHaveLength(0);
    const blocked = await request(app).get(`${P}/documents/${doc.body.id}/download`);
    expect(blocked.status).toBe(404);
    // media faylga to'g'ridan-to'g'ri ommaviy kirish yo'q
    expect((await request(app).get(`/uploads/images/${file.id}.pdf`)).status).toBe(404);
    expect((await request(app).get(`${A}/media/${file.id}/file`)).status).toBe(401);
  });

  it('nashr qilingan hujjat ro‘yxatda ko‘rinadi va yuklab olinadi; arxivdan keyin yana bloklanadi', async () => {
    const file = (await api.upload(`${A}/media`, PDF_BYTES, 'nizom.pdf')).body;
    const doc = (await api.post(`${A}/documents`, docBody(file.id))).body;
    await api.patch(`${A}/documents/${doc.id}`, { status: 'PUBLISHED' }).expect(200);

    const list = (await request(app).get(`${P}/documents?locale=uz&type=REGULATION`)).body;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ title: 'Nizom', number: '12-son', file: { extension: 'pdf' } });

    const dl = await request(app).get(list.items[0].downloadUrl).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/^attachment; filename="?nizom\.pdf"?$/);
    expect((dl.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    await api.patch(`${A}/documents/${doc.id}`, { status: 'ARCHIVED' }).expect(200);
    expect((await request(app).get(list.items[0].downloadUrl)).status).toBe(404);
    expect((await request(app).get(`${P}/documents?locale=uz`)).body.items).toHaveLength(0);
  });

  it('hujjat uchun rasm faylini tanlashni rad etadi', async () => {
    const img = (await api.upload(`${A}/media`, await pngBuffer(), 'rasm.png')).body;
    const res = await api.post(`${A}/documents`, docBody(img.id));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEDIA_KIND_MISMATCH');
  });

  it('hujjat filtrlari: tur, qidiruv va uch tilli nom', async () => {
    const f1 = (await api.upload(`${A}/media`, PDF_BYTES, 'a.pdf')).body;
    const f2 = (await api.upload(`${A}/media`, PDF_BYTES, 'b.pdf')).body;
    const a = (await api.post(`${A}/documents`, docBody(f1.id, { status: 'PUBLISHED', translations: { uz: { title: 'Yillik reja', description: '' }, ru: { title: 'Годовой план', description: '' } }, type: 'PLAN' }))).body;
    await api.post(`${A}/documents`, docBody(f2.id, { status: 'PUBLISHED', type: 'REPORT', translations: { uz: { title: 'Hisobot 2025', description: '' } } }));
    expect(a.translationStatus).toEqual({ uz: true, ru: true, en: false });

    expect((await request(app).get(`${P}/documents?locale=uz&type=PLAN`)).body.items.map((i: { title: string }) => i.title)).toEqual(['Yillik reja']);
    expect((await request(app).get(`${P}/documents?locale=ru&type=PLAN`)).body.items[0].title).toBe('Годовой план');
    expect((await request(app).get(`${P}/documents?locale=uz&type=PLAN,REPORT`)).body.meta.total).toBe(2);
    expect((await request(app).get(`${P}/documents?locale=uz&q=hisobot`)).body.items).toHaveLength(1);
  });

  it('hujjatga biriktirilgan faylni o‘chirib bo‘lmaydi; kontentda ishlatilgan rasmni faqat tasdiq bilan o‘chiradi', async () => {
    const file = (await api.upload(`${A}/media`, PDF_BYTES, 'nizom.pdf')).body;
    await api.post(`${A}/documents`, docBody(file.id));
    const blocked = await api.del(`${A}/media/${file.id}?force=true`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('MEDIA_IN_USE_BLOCKING');

    const img = (await api.upload(`${A}/media`, await pngBuffer(), 'rasm.png')).body;
    await api.post(`${A}/pages`, {
      template: 'DEFAULT', sortOrder: 0,
      translations: { uz: { title: 'Rasmli', slug: 'rasmli', content: `<p><img src="${img.url}" alt="x"></p>` } },
    });
    const noConfirm = await api.del(`${A}/media/${img.id}`);
    expect(noConfirm.status).toBe(409);
    expect(noConfirm.body.error.code).toBe('MEDIA_IN_USE');
    expect(noConfirm.body.error.details[0]).toMatchObject({ type: 'page', title: 'Rasmli' });

    await api.del(`${A}/media/${img.id}?force=true`).expect(204);
    expect((await request(app).get(img.url)).status).toBe(404);

    // ishlatilmayotgan fayl tasdiqsiz o'chadi
    const unused = (await api.upload(`${A}/media`, await pngBuffer(20, 20), 'bo-sh.png')).body;
    await api.del(`${A}/media/${unused.id}`).expect(204);
  });

  it('media alt matni uch tilda saqlanadi va qidiriladi', async () => {
    const img = (await api.upload(`${A}/media`, await pngBuffer(), 'rasm.png')).body;
    const res = await api.patch(`${A}/media/${img.id}`, {
      showInGallery: true,
      translations: { uz: { alt: 'Bino jabhasi', caption: '' }, ru: { alt: 'Фасад здания', caption: '' }, en: { alt: 'Building facade', caption: '' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.translations.ru.alt).toBe('Фасад здания');
    expect((await api.get(`${A}/media?q=jabhasi`)).body.meta.total).toBe(1);
    expect((await api.get(`${A}/media?kind=DOCUMENT`)).body.meta.total).toBe(0);

    const gallery = (await request(app).get(`${P}/gallery?locale=ru`)).body;
    expect(gallery.items).toHaveLength(1);
    expect(gallery.items[0].image.alt).toBe('Фасад здания');
  });
});
