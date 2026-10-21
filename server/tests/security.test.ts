import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';
import { makeApp } from './helpers.js';

describe('xavfsizlik sozlamalari', () => {
  it('xavfsizlik headerlari qo‘yiladi, X-Powered-By yo‘q', async () => {
    const res = await request(makeApp()).get('/api/v1/public/settings?locale=uz');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('CSP: iframe faqat YouTube/Vimeo pleyerlari uchun ruxsat etilgan (videogalereya ishlashi uchun)', async () => {
    const res = await request(makeApp()).get('/api/v1/public/settings?locale=uz');
    const csp = String(res.headers['content-security-policy']);
    const frameSrc = csp.split(';').find((d) => d.startsWith('frame-src'));
    expect(frameSrc).toBe('frame-src https://www.youtube-nocookie.com https://player.vimeo.com');
  });

  it('admin API javoblari keshlanmaydi', async () => {
    const res = await request(makeApp()).get('/api/v1/admin/auth/me');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('CORS: ruxsat etilmagan origin uchun Access-Control-Allow-Origin qaytmaydi', async () => {
    const app = makeApp({ corsOrigins: ['https://portal.example.uz'] });
    const bad = await request(app).get('/api/v1/public/settings').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await request(app).get('/api/v1/public/settings').set('Origin', 'https://portal.example.uz');
    expect(ok.headers['access-control-allow-origin']).toBe('https://portal.example.uz');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
  });

  it('umumiy API rate limit ishlaydi', async () => {
    const app = makeApp({ apiRateMax: 3 });
    for (let i = 0; i < 3; i++) expect((await request(app).get('/api/v1/public/settings')).status).toBe(200);
    const blocked = await request(app).get('/api/v1/public/settings');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('HTTPS majburiy bo‘lsa, HTTP so‘rovlar https manziliga yo‘naltiriladi', async () => {
    const app = makeApp({ forceHttps: true, trustProxy: 1 });
    const http = await request(app).get('/api/v1/public/settings').set('Host', 'portal.example.uz');
    expect(http.status).toBe(308);
    expect(http.headers.location).toBe('https://portal.example.uz/api/v1/public/settings');
    const https = await request(app).get('/api/v1/public/settings').set('X-Forwarded-Proto', 'https');
    expect(https.status).toBe(200);
    // health-check yo'naltirilmaydi
    expect((await request(app).get('/healthz')).status).toBe(200);
  });

  it('production rejimida HTTPS va Secure cookie majburiy', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://x' };
    expect(() => loadConfig({ ...base, PUBLIC_URL: 'http://portal.example.uz', COOKIE_SECURE: 'true' })).toThrow(/https/);
    expect(() => loadConfig({ ...base, PUBLIC_URL: 'https://portal.example.uz', COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(loadConfig({ ...base, PUBLIC_URL: 'https://portal.example.uz', COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('Swagger hujjati dev’da ochiq, productionda sukut bo‘yicha o‘chiq', async () => {
    expect(loadConfig({ NODE_ENV: 'development', DATABASE_URL: 'x' }).enableApiDocs).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'x', PUBLIC_URL: 'https://a.uz', COOKIE_SECURE: 'true' }).enableApiDocs).toBe(false);
    const res = await request(makeApp({ enableApiDocs: true })).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/admin/pages']).toBeDefined();
    expect(res.body.paths['/public/news/{slug}']).toBeDefined();
    expect(res.body.paths['/admin/pages'].post.requestBody.content['application/json'].schema).toBeDefined();
  });
});
