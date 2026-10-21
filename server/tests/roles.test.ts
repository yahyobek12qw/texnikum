import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '@uchkoprik/shared';
import { prisma } from '../src/lib/prisma.js';
import {
  A, P, PDF_BYTES, createAdminUser, loginAgent, makeApp, newsBody, pageBody, pngBuffer, resetAll, resetContent, type AdminApi,
} from './helpers.js';

const PW = 'Parol-12345-abc';

describe('foydalanuvchilar, rollar va ruxsatlar', () => {
  const app = makeApp();
  let admin: AdminApi;
  let editor: AdminApi;
  let publisher: AdminApi;

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
    admin = await loginAgent(app);
    await admin.post(`${A}/users`, { email: 'editor@test.uz', name: 'Muharrir', role: 'EDITOR', password: PW }).expect(201);
    await admin.post(`${A}/users`, { email: 'pub@test.uz', name: 'Bosh muharrir', role: 'PUBLISHER', password: PW }).expect(201);
    editor = await loginAgent(app, 'editor@test.uz', PW);
    publisher = await loginAgent(app, 'pub@test.uz', PW);
  });

  it('/auth/me har bir rol uchun to‘g‘ri ruxsatlar ro‘yxatini qaytaradi', async () => {
    for (const [api, role] of [[admin, 'ADMIN'], [publisher, 'PUBLISHER'], [editor, 'EDITOR']] as const) {
      const me = (await api.get(`${A}/auth/me`)).body;
      expect(me.user.role).toBe(role);
      expect(me.permissions.sort()).toEqual([...ROLE_PERMISSIONS[role]].sort());
    }
  });

  it('muharrir: qoralama yarata va tahrirlay oladi, lekin nashr qila olmaydi', async () => {
    await resetContent();
    const created = await editor.post(`${A}/news`, newsBody('muharrir-yangilik', 'Muharrir yangiligi'));
    expect(created.status).toBe(201);
    const id = created.body.id;

    const publish = await editor.post(`${A}/news/${id}/publish`);
    expect(publish.status).toBe(403);
    expect(publish.body.error.code).toBe('PERMISSION_DENIED');

    const scheduled = await editor.patch(`${A}/news/${id}`, { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    expect(scheduled.status).toBe(403);

    const edit = await editor.patch(`${A}/news/${id}`, { isImportant: true });
    expect(edit.status).toBe(200);

    // yaratishda ham holatni PUBLISHED qilib yuborish nashr huquqini talab qiladi
    expect((await editor.post(`${A}/documents`, { type: 'OTHER', fileMediaId: 'x', status: 'PUBLISHED', translations: { uz: { title: 'H', description: '' } } })).status).toBe(403);


    expect((await editor.del(`${A}/news/${id}`)).status).toBe(403);
    expect((await request(app).get(`${P}/news/muharrir-yangilik?locale=uz`)).status).toBe(404);
  });

  it('muharrir nashr qilingan materialni tahrirlay olmaydi (aks holda bilvosita nashr qilgan bo‘lardi)', async () => {
    await resetContent();
    const id = (await publisher.post(`${A}/news`, newsBody('nashr-q', 'Nashr qilingan'))).body.id;
    await publisher.post(`${A}/news/${id}/publish`).expect(200);

    const res = await editor.patch(`${A}/news/${id}`, { translations: { uz: { title: 'Buzilgan', slug: 'nashr-q', excerpt: '', content: '' } } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PUBLISHED_EDIT_DENIED');
    expect((await request(app).get(`${P}/news/nashr-q?locale=uz`)).body.title).toBe('Nashr qilingan');

    // hujjat holatini o'zgartirish ham nashr huquqini talab qiladi
    const file = (await publisher.upload(`${A}/media`, PDF_BYTES, 'a.pdf')).body;
    const doc = (await editor.post(`${A}/documents`, { type: 'OTHER', fileMediaId: file.id, translations: { uz: { title: 'Hujjat', description: '' } } })).body;
    expect((await editor.patch(`${A}/documents/${doc.id}`, { status: 'PUBLISHED' })).status).toBe(403);
    expect((await editor.post(`${A}/documents`, { type: 'OTHER', fileMediaId: file.id, status: 'PUBLISHED', translations: { uz: { title: 'H2', description: '' } } })).status).toBe(403);
  });

  it('muharrir: media yuklay oladi, o‘chira olmaydi; boshqaruv bo‘limlariga kira olmaydi', async () => {
    const up = await editor.upload(`${A}/media`, await pngBuffer(), 'rasm.png');
    expect(up.status).toBe(201);
    expect((await editor.del(`${A}/media/${up.body.id}`)).status).toBe(403);

    for (const path of ['/settings', '/navigation', '/users', '/audit-logs']) {
      const res = await editor.get(`${A}${path}`);
      expect(res.status, path).toBe(403);
    }
    expect((await editor.patch(`${A}/settings`, { footer: { text: { uz: 'x', ru: '', en: '' } } })).status).toBe(403);
    expect((await editor.put(`${A}/navigation`, { menus: [{ key: 'main', items: [] }] })).status).toBe(403);
    expect((await editor.get(`${A}/stats`)).status).toBe(200);
    expect((await editor.get(`${A}/reports/content.csv`)).status).toBe(403);
  });

  it('bosh muharrir: nashr qiladi, o‘chiradi, hisobot yuklaydi; foydalanuvchi/sozlama/menyuga kira olmaydi', async () => {
    await resetContent();
    const id = (await publisher.post(`${A}/pages`, pageBody('bosh-muharrir', 'Sahifa'))).body.id;
    await publisher.post(`${A}/pages/${id}/publish`).expect(200);
    expect((await request(app).get(`${P}/pages/bosh-muharrir?locale=uz`)).status).toBe(200);
    await publisher.del(`${A}/pages/${id}`).expect(204);
    expect((await publisher.get(`${A}/reports/content.csv`)).status).toBe(200);

    for (const path of ['/users', '/settings', '/navigation', '/audit-logs']) {
      expect((await publisher.get(`${A}${path}`)).status, path).toBe(403);
    }
    const mod = await publisher.patch(`${A}/settings`, { modules: { search: true } });
    expect(mod.status).toBe(403);
  });

  it('administrator: foydalanuvchi yaratadi; takroriy email 409; zaif parol 400', async () => {
    expect((await admin.post(`${A}/users`, { email: 'editor@test.uz', name: 'X', role: 'EDITOR', password: PW })).status).toBe(409);
    expect((await admin.post(`${A}/users`, { email: 'weak@test.uz', name: 'X', role: 'EDITOR', password: 'qisqa' })).status).toBe(400);
    const list = (await admin.get(`${A}/users`)).body.items;
    expect(list.map((u: { email: string }) => u.email)).toEqual(expect.arrayContaining(['admin@test.uz', 'editor@test.uz', 'pub@test.uz']));
    expect(JSON.stringify(list)).not.toMatch(/passwordHash|argon2/);
  });

  it('o‘zini bloklash va oxirgi administratorni yo‘qotish mumkin emas', async () => {
    const me = (await admin.get(`${A}/auth/me`)).body.user;
    const selfDemote = await admin.patch(`${A}/users/${me.id}`, { role: 'EDITOR' });
    expect(selfDemote.status).toBe(403);
    expect(selfDemote.body.error.code).toBe('SELF_LOCKOUT');
    expect((await admin.patch(`${A}/users/${me.id}`, { isActive: false })).status).toBe(403);

    // ikkinchi administrator yaratilsa, birinchisini tushirish mumkin; oxirgisi — yo'q
    const second = (await admin.post(`${A}/users`, { email: 'admin2@test.uz', name: 'Ikkinchi', role: 'ADMIN', password: PW })).body;
    const admin2 = await loginAgent(app, 'admin2@test.uz', PW);
    await admin2.patch(`${A}/users/${me.id}`, { role: 'EDITOR' }).expect(200);
    const last = await admin2.patch(`${A}/users/${second.id}`, { role: 'EDITOR' });
    expect(last.status).toBe(403); // o'zi
    await prisma.user.update({ where: { id: me.id }, data: { role: 'ADMIN' } }); // asl holat
    admin = await loginAgent(app); // rol o'zgarganda eski sessiyalar bekor qilingan
  });

  it('rol o‘zgarishi va faolsizlantirish foydalanuvchi sessiyalarini darhol bekor qiladi', async () => {
    const u = (await admin.post(`${A}/users`, { email: 'temp@test.uz', name: 'Vaqtinchalik', role: 'EDITOR', password: PW })).body;
    const tmp = await loginAgent(app, 'temp@test.uz', PW);
    expect((await tmp.get(`${A}/auth/me`)).status).toBe(200);

    await admin.patch(`${A}/users/${u.id}`, { isActive: false }).expect(200);
    expect((await tmp.get(`${A}/auth/me`)).status).toBe(401);
    expect((await request(app).post(`${A}/auth/login`).send({ email: 'temp@test.uz', password: PW })).status).toBe(401);

    await admin.patch(`${A}/users/${u.id}`, { isActive: true, password: 'Yangi-parol-98765' }).expect(200);
    expect((await request(app).post(`${A}/auth/login`).send({ email: 'temp@test.uz', password: 'Yangi-parol-98765' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entity: 'user', entityId: u.id } })).toBeGreaterThanOrEqual(3);
  });
});
