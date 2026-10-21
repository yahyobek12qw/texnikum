import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { purgeStaleUploads } from '../src/modules/media/media.service.js';
import { A, P, createAdminUser, loginAgent, pngBuffer, resetAll, resetContent, type AdminApi } from './helpers.js';

/**
 * Haqiqiy video emas: faqat to'g'ri konteyner sarlavhasi (magic bytes). Server tarkibni sarlavha bo'yicha aniqlaydi;
 * ijro etilishini tekshirish brauzer (e2e) testida.
 */
const box = (brand: string) =>
  Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from(brand), Buffer.from([0, 0, 2, 0]), Buffer.from(brand), Buffer.from('iso2'), Buffer.alloc(4000, 7)]);
const MP4 = box('isom');
const MOV = box('qt  ');
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84]), Buffer.from('webm'), Buffer.alloc(4000, 3)]);

const tr = (title: string) => ({ uz: { title, description: '' } });

describe('video fayl yuklash (kompyuter/telefon)', () => {
  const { app, config } = createApp();
  let api: AdminApi;
  const diskPath = (storedName: string) => path.join(config.uploadDir, 'videos', storedName);
  const storedNameOf = (url: string) => url.split('/').pop()!;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    api = await loginAgent(app);
  });
  beforeEach(resetContent);

  const uploadVideo = async (buf: Buffer = MP4, name = 'klip.mp4') => api.upload(`${A}/videos/upload`, buf, name);
  const createVideo = async (fileMediaId: string, extra: object = {}) =>
    api.post(`${A}/videos`, { fileMediaId, sortOrder: 0, translations: tr('Kollej videosi'), ...extra });

  it('mp4, mov va webm qabul qilinadi; Media kutubxonasida ko‘rinmaydi', async () => {
    for (const [buf, name, ext] of [[MP4, 'klip.mp4', 'mp4'], [MOV, 'IMG_0001.MOV', 'mov'], [WEBM, 'yozuv.webm', 'webm']] as const) {
      const res = await uploadVideo(buf, name);
      expect(res.status, name).toBe(201);
      expect(res.body.kind).toBe('VIDEO');
      expect(res.body.url).toMatch(new RegExp(`^/uploads/videos/[0-9a-f-]{36}\\.${ext}$`));
      expect(fs.existsSync(diskPath(storedNameOf(res.body.url)))).toBe(true);
    }
    const list = (await api.get(`${A}/media`)).body;
    expect(list.items.filter((m: { kind: string }) => m.kind === 'VIDEO')).toHaveLength(0);
    expect((await api.get(`${A}/media?kind=VIDEO`)).body.items).toHaveLength(3);
  });

  it('noto‘g‘ri fayllar rad etiladi (soxta kengaytma, rasm, matn, ruxsatsiz kengaytma)', async () => {
    expect((await uploadVideo(Buffer.from('bu video emas, oddiy matn'.repeat(50)), 'soxta.mp4')).status).toBe(415);
    expect((await uploadVideo(await pngBuffer(), 'rasm.mp4')).status).toBe(415);
    expect((await uploadVideo(MP4, 'klip.exe')).status).toBe(415);
    expect((await uploadVideo(MP4, 'klip.txt')).status).toBe(415);
    expect((await api.upload(`${A}/videos/upload`, Buffer.alloc(0), 'bosh.mp4')).status).toBe(400);
    // vaqtinchalik fayllar qolmaydi
    const tmp = path.join(config.uploadDir, 'tmp');
    expect(fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((f) => f.endsWith('.part')) : []).toHaveLength(0);
    // oddiy media yuklash video qabul qilmaydi
    expect((await api.upload(`${A}/media`, MP4, 'klip.mp4')).status).toBe(415);
  });

  it('hajm chegarasi (MAX_VIDEO_MB) va autentifikatsiya', async () => {
    const small = createApp({ maxVideoBytes: 2000 }).app;
    const a2 = await loginAgent(small);
    expect((await a2.upload(`${A}/videos/upload`, MP4, 'katta.mp4')).status).toBe(413);
    const tmp = path.join(config.uploadDir, 'tmp');
    expect(fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((f) => f.endsWith('.part')) : []).toHaveLength(0);
    expect((await request(app).post(`${A}/videos/upload`).attach('file', MP4, 'klip.mp4')).status).toBe(401);
  });

  it('videoga biriktirish: qoralama yopiq, nashrdan so‘ng hamma ko‘radi, Range ishlaydi', async () => {
    const up = (await uploadVideo()).body;
    const created = await createVideo(up.id);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ provider: 'UPLOAD', sourceUrl: '' });
    expect(created.body.file).toMatchObject({ id: up.id, originalName: 'klip.mp4', url: up.url });

    // qoralama: begona ko'ra olmaydi, xodim ko'ra oladi
    expect((await request(app).get(up.url)).status).toBe(404);
    const asAdmin = await api.get(up.url);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers['cache-control']).toContain('no-store');
    expect((await request(app).get(`${P}/videos?locale=uz`)).body.items).toHaveLength(0);

    await api.post(`${A}/videos/${created.body.id}/publish`).expect(200);
    const pub = (await request(app).get(`${P}/videos?locale=uz`)).body.items[0];
    expect(pub).toMatchObject({ provider: 'UPLOAD', fileUrl: up.url, embedUrl: null, watchUrl: null });

    const full = await request(app).get(up.url);
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toContain('video/mp4');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.body.length ?? Number(full.headers['content-length'])).toBe(MP4.length);

    const part = await request(app).get(up.url).set('Range', 'bytes=0-9');
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-9/${MP4.length}`);

    // nashrdan olinsa, yana yopiladi
    await api.post(`${A}/videos/${created.body.id}/unpublish`).expect(200);
    expect((await request(app).get(up.url)).status).toBe(404);
  });

  it('.mov fayl video/mp4 sifatida beriladi', async () => {
    const up = (await uploadVideo(MOV, 'IMG_1.mov')).body;
    const v = await createVideo(up.id);
    await api.post(`${A}/videos/${v.body.id}/publish`).expect(200);
    const res = await request(app).get(up.url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('video/mp4');
  });

  it('manba qoidalari: aynan bittasi, rasm emas, bitta fayl bitta videoga', async () => {
    const up = (await uploadVideo()).body;
    const both = await api.post(`${A}/videos`, { sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', fileMediaId: up.id, sortOrder: 0, translations: tr('X') });
    expect(both.status).toBe(400);
    const none = await api.post(`${A}/videos`, { sortOrder: 0, translations: tr('X') });
    expect(none.status).toBe(400);
    const img = (await api.upload(`${A}/media`, await pngBuffer(), 'foto.png')).body;
    expect((await createVideo(img.id)).status).toBe(400);
    expect((await createVideo(up.id)).status).toBe(201);
    expect((await createVideo(up.id)).status).toBe(409);
    // biriktirilgan faylni Media orqali o'chirib bo'lmaydi
    expect((await api.del(`${A}/media/${up.id}`)).status).toBe(409);
  });

  it('havolaga almashtirish, almashtirish va o‘chirishda eski fayl diskdan olib tashlanadi', async () => {
    const a = (await uploadVideo()).body;
    const v = (await createVideo(a.id)).body;

    const b = (await uploadVideo(WEBM, 'ikkinchi.webm')).body;
    const swapped = await api.patch(`${A}/videos/${v.id}`, { fileMediaId: b.id });
    expect(swapped.body.file.id).toBe(b.id);
    expect(fs.existsSync(diskPath(storedNameOf(a.url)))).toBe(false);
    expect(await prisma.media.findUnique({ where: { id: a.id } })).toBeNull();

    const link = await api.patch(`${A}/videos/${v.id}`, { sourceUrl: 'https://vimeo.com/76979871' });
    expect(link.body).toMatchObject({ provider: 'VIMEO', file: null });
    expect(fs.existsSync(diskPath(storedNameOf(b.url)))).toBe(false);

    const c = (await uploadVideo()).body;
    await api.patch(`${A}/videos/${v.id}`, { fileMediaId: c.id }).expect(200);
    await api.del(`${A}/videos/${v.id}`).expect(204);
    expect(fs.existsSync(diskPath(storedNameOf(c.url)))).toBe(false);
    expect(await prisma.media.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it('saqlanmagan (yetim) videolar 24 soatdan keyin tozalanadi', async () => {
    const fresh = (await uploadVideo()).body;
    const old = (await uploadVideo()).body;
    await prisma.media.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 48 * 3600 * 1000) } });
    await purgeStaleUploads(config);
    expect(await prisma.media.findUnique({ where: { id: old.id } })).toBeNull();
    expect(fs.existsSync(diskPath(storedNameOf(old.url)))).toBe(false);
    expect(await prisma.media.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });

  it('modul o‘chirilsa, yuklangan video ommaviy berilmaydi', async () => {
    const up = (await uploadVideo()).body;
    const v = (await createVideo(up.id)).body;
    await api.post(`${A}/videos/${v.id}/publish`).expect(200);
    expect((await request(app).get(up.url)).status).toBe(200);
    const { setModules, enableAllModules } = await import('./helpers.js');
    await setModules({ videoGallery: false });
    expect((await request(app).get(up.url)).status).toBe(404);
    await enableAllModules();
  });
});
