import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { A, ADMIN_EMAIL, ADMIN_PASSWORD, createAdminUser, loginAgent, makeApp, resetAll } from './helpers.js';

describe('autentifikatsiya', () => {
  const app = makeApp();

  beforeAll(async () => {
    await resetAll();
    await createAdminUser();
  });

  it('to‘g‘ri login va parol bilan kiradi, parol xeshi Argon2id', async () => {
    const res = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('sessiya tokeni bazada xeshlangan holda saqlanadi', async () => {
    const res = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const token = /sid=([^;]+)/.exec((res.headers['set-cookie'] as unknown as string[])[0]!)![1]!;
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    expect(await prisma.session.count()).toBeGreaterThan(0);
  });

  it('noto‘g‘ri parolni rad etadi va foydalanuvchi mavjudligini oshkor qilmaydi', async () => {
    const wrongPassword = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: 'noto-gri-parol-1' });
    const unknownUser = await request(app).post(`${A}/auth/login`).send({ email: 'yoq@test.uz', password: 'noto-gri-parol-1' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('sessiyasiz admin API’ga kirishni rad etadi', async () => {
    for (const url of ['/pages', '/news', '/documents', '/media', '/settings', '/navigation', '/audit-logs', '/dashboard']) {
      const res = await request(app).get(`${A}${url}`);
      expect(res.status, url).toBe(401);
    }
    const write = await request(app).post(`${A}/pages`).send({});
    expect(write.status).toBe(401);
  });

  it('CSRF tokensiz o‘zgartiruvchi so‘rovni rad etadi', async () => {
    const agent = request.agent(app);
    await agent.post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(200);
    const noToken = await agent.post(`${A}/pages`).send({});
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF_INVALID');
    const badToken = await agent.post(`${A}/pages`).set('X-CSRF-Token', 'x'.repeat(43)).send({});
    expect(badToken.status).toBe(403);
    // GET so'rovlar token talab qilmaydi
    await agent.get(`${A}/pages`).expect(200);
  });

  it('boshqa saytdan kelgan Origin’ni rad etadi', async () => {
    const res = await request(app)
      .post(`${A}/auth/login`)
      .set('Origin', 'https://evil.example')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('logoutdan keyin sessiya bekor bo‘ladi', async () => {
    const login = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]!);
    const csrf = login.body.csrfToken as string;
    await request(app).get(`${A}/auth/me`).set('Cookie', cookie).expect(200);

    await request(app).post(`${A}/auth/logout`).set('Cookie', cookie).set('X-CSRF-Token', csrf).expect(204);

    // Logoutdan keyin xuddi shu cookie bilan kirib bo'lmaydi
    const after = await request(app).get(`${A}/auth/me`).set('Cookie', cookie);
    expect(after.status).toBe(401);
    expect(await prisma.session.count({ where: { id: { not: '' } } })).toBeGreaterThanOrEqual(0);
  });

  it('muddati tugagan sessiyani rad etadi', async () => {
    const api = await loginAgent(app);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api.get(`${A}/auth/me`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('parol almashtirishda joriy parol tekshiriladi va boshqa sessiyalar bekor qilinadi', async () => {
    const a = await loginAgent(app);
    const b = await loginAgent(app);
    const wrong = await a.post(`${A}/auth/change-password`, { currentPassword: 'xato-parol-123', newPassword: 'Yangi-parol-12345' });
    expect(wrong.status).toBe(400);
    const weak = await a.post(`${A}/auth/change-password`, { currentPassword: ADMIN_PASSWORD, newPassword: 'qisqa' });
    expect(weak.status).toBe(400);

    await a.post(`${A}/auth/change-password`, { currentPassword: ADMIN_PASSWORD, newPassword: 'Yangi-parol-12345' }).expect(204);
    expect((await b.get(`${A}/auth/me`)).status).toBe(401);
    expect((await a.get(`${A}/auth/me`)).status).toBe(200);

    const oldLogin = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: 'Yangi-parol-12345' });
    expect(newLogin.status).toBe(200);

    // keyingi testlar uchun asl parolni tiklaymiz
    await a.post(`${A}/auth/change-password`, { currentPassword: 'Yangi-parol-12345', newPassword: ADMIN_PASSWORD }).expect(204);
  });

  it('login endpointida rate limiting ishlaydi', async () => {
    const limited = makeApp({ loginRateMax: 3, loginRateWindowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      const r = await request(limited).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: 'noto-gri-parol-1' });
      expect(r.status).toBe(401);
    }
    const blocked = await request(limited).post(`${A}/auth/login`).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('muvaffaqiyatsiz urinishlar audit jurnaliga yoziladi, parol esa yozilmaydi', async () => {
    const logs = await prisma.auditLog.findMany({ where: { action: 'LOGIN_FAILED' } });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain('noto-gri-parol');
  });
});
