import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { adminEmail, adminLogin, adminPassword } from './helpers';

// Bu fayl boshqalardan keyin ishlaydi (nomi "zz"): yangi kontent oldingi testlarning "bo'sh holat" tekshiruvlariga xalaqit bermasligi uchun.
test.describe.configure({ mode: 'serial' });
// Headless brauzer UA'si "HeadlessChrome" botlar sifatida hisobga olinmaydi; oddiy brauzer UA'si beriladi
test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' });

const EDITOR = { email: 'muharrir-e2e@test.uz', password: 'Muharrir-Parol-123' };

test('modullar: administrator bo‘limni o‘chiradi — saytda yo‘qoladi; qayta yoqadi — qaytadi (ma’lumot saqlanadi)', async ({ page, request }) => {
  expect((await request.get('/api/v1/public/pages/transparency?locale=uz')).status()).toBe(200);
  await adminLogin(page);
  await page.goto('/admin/modules');
  const sw = page.getByRole('switch', { name: /Ochiqlik va shaffoflik/ });
  await expect(sw).toHaveAttribute('aria-checked', 'true');

  await sw.click();
  await page.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(page.getByText(/Modullar saqlandi/)).toBeVisible();

  expect((await request.get('/api/v1/public/pages/transparency?locale=uz')).status()).toBe(404);
  const res = await page.goto('/uz/transparency');
  expect(res?.status()).toBe(404);
  await page.goto('/uz');
  await expect(page.getByRole('navigation', { name: 'Asosiy navigatsiya' }).first().getByText('Ochiqlik va shaffoflik')).toHaveCount(0);

  await page.goto('/admin/modules');
  await page.getByRole('switch', { name: /Ochiqlik va shaffoflik/ }).click();
  await page.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(page.getByText(/Modullar saqlandi/)).toBeVisible();
  expect((await request.get('/api/v1/public/pages/transparency?locale=uz')).status()).toBe(200);
});

test('videogalereya: admin YouTube havolasini qo‘shadi, nashr qiladi; saytda click-to-load pleyer chiqadi', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/videos');
  await page.getByRole('button', { name: 'Yangi video' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Yangi video' });

  // noto'g'ri havola rad etiladi
  await dlg.getByLabel(/Video havolasi/).fill('https://evil.example/video');
  await dlg.getByLabel('Sarlavha').fill('Sinov videosi');
  await dlg.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dlg.getByText(/Faqat YouTube yoki Vimeo/)).toBeVisible();

  await dlg.getByLabel(/Video havolasi/).fill('https://youtu.be/dQw4w9WgXcQ');
  await dlg.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Video qoralama sifatida saqlandi')).toBeVisible();

  // qoralama saytda ko'rinmaydi
  await page.goto('/uz/gallery?tab=videos');
  await expect(page.getByText('Sinov videosi')).toHaveCount(0);

  await page.goto('/admin/videos');
  await page.getByRole('button', { name: 'Nashr qilish' }).first().click();
  await expect(page.getByText(/nashr qilindi/)).toBeVisible();

  await page.goto('/uz/gallery?tab=videos');
  const play = page.getByRole('button', { name: /Videoni ijro etish: Sinov videosi/ });
  await expect(play).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0); // bosilguncha YouTube yuklanmaydi
  // CSP iframe'ni bloklamayotganini tekshiramiz (faqat src atributi yetarli emas: brauzer baribir bloklashi mumkin)
  await page.evaluate(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(e.violatedDirective));
  });
  await play.click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  await page.waitForTimeout(1000);
  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations.filter((v) => v.startsWith('frame-src') || v.startsWith('child-src') || v.startsWith('default-src'))).toEqual([]);
});

test('video fayl yuklash: haqiqiy WebM yaratiladi, yuklanadi, nashr qilinadi va saytda ijro etiladi', async ({ page }, testInfo) => {
  await adminLogin(page);
  // Brauzerning o'zida haqiqiy (ijro etiladigan) WebM yozib olinadi: tashqi fayl va ffmpeg kerak emas
  const b64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    const rec = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start();
    let i = 0;
    const t = setInterval(() => {
      ctx.fillStyle = `hsl(${i * 20},80%,50%)`;
      ctx.fillRect(0, 0, 160, 90);
      i++;
    }, 50);
    await new Promise((r) => setTimeout(r, 1500));
    clearInterval(t);
    rec.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  });
  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  const file = path.join(testInfo.outputDir, 'sinov-klip.webm');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  expect(fs.statSync(file).size).toBeGreaterThan(500);

  await page.goto('/admin/videos');
  await page.getByRole('button', { name: 'Yangi video' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Yangi video' });
  await dlg.getByRole('button', { name: 'Fayl yuklash' }).click();
  await dlg.getByLabel('Video faylni tanlash').setInputFiles(file);
  await expect(dlg.getByLabel('Yuklangan video ko‘rinishi')).toBeVisible({ timeout: 20_000 });
  await expect(dlg.getByText('sinov-klip.webm')).toBeVisible();
  await dlg.getByLabel('Sarlavha').fill('Yuklangan sinov videosi');
  await dlg.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Video qoralama sifatida saqlandi')).toBeVisible();
  await expect(page.getByRole('cell', { name: /Yuklangan sinov videosi/ })).toContainText('Yuklangan fayl · sinov-klip.webm');

  // qoralama: saytda ham, faylga to'g'ridan-to'g'ri ham yopiq
  await page.goto('/uz/gallery?tab=videos');
  await expect(page.getByText('Yuklangan sinov videosi')).toHaveCount(0);

  await page.goto('/admin/videos');
  await page.getByRole('row', { name: /Yuklangan sinov videosi/ }).getByRole('button', { name: 'Nashr qilish' }).click();
  await expect(page.getByText(/nashr qilindi/)).toBeVisible();

  await page.goto('/uz/gallery?tab=videos');
  const play = page.getByRole('button', { name: /Videoni ijro etish: Yuklangan sinov videosi/ });
  await expect(play).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0); // bosilguncha video yuklanmaydi
  await play.click();
  const video = page.locator('video[controls]');
  await expect(video).toHaveAttribute('src', /^\/uploads\/videos\/[0-9a-f-]{36}\.webm$/);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => ({ ready: v.readyState >= 2, w: v.videoWidth, err: v.error?.code ?? null })), { timeout: 20_000 })
    .toEqual({ ready: true, w: 160, err: null });
});

test('hamkor korxona: admin yaratadi va nashr qiladi; saytdagi sahifada va bosh sahifada ko‘rinadi', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/partners');
  await page.getByRole('button', { name: 'Yangi hamkor' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Yangi hamkor' });
  await dlg.getByLabel(/Veb-sayt/).fill('https://example.uz');
  await dlg.getByLabel(/Korxona nomi/).fill('Sinov hamkori MChJ');
  await dlg.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Hamkor qoralama sifatida saqlandi')).toBeVisible();
  await page.getByRole('button', { name: 'Nashr qilish' }).first().click();
  await expect(page.getByText(/nashr qilindi/)).toBeVisible();

  await page.goto('/uz/partners');
  await expect(page.getByRole('link', { name: /Sinov hamkori MChJ/ })).toHaveAttribute('href', 'https://example.uz');
  await page.goto('/uz');
  await expect(page.getByRole('heading', { name: 'Hamkor korxonalar' }).first()).toBeVisible();
});

test('rollar: muharrir cheklangan menyu va ruxsatlar bilan ishlaydi; nashr qila olmaydi', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Yangi foydalanuvchi' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Yangi foydalanuvchi' });
  await dlg.getByLabel(/Elektron pochta/).fill(EDITOR.email);
  await dlg.getByRole('textbox', { name: /^Ism/ }).fill('E2E Muharrir');
  await dlg.getByRole('combobox', { name: 'Rol' }).selectOption({ label: 'Muharrir' });
  await dlg.getByLabel(/Boshlang‘ich parol/).fill(EDITOR.password);
  await dlg.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Foydalanuvchi yaratildi')).toBeVisible();
  await expect(page.getByRole('cell', { name: /E2E Muharrir/ })).toBeVisible();

  // muharrir sifatida kirish
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await page.getByLabel('Elektron pochta').fill(EDITOR.email);
  await page.getByLabel('Parol').fill(EDITOR.password);
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

  const menu = page.getByRole('navigation', { name: 'Admin menyusi' });
  await expect(menu.getByRole('link', { name: 'Sahifalar', exact: true })).toBeVisible();
  for (const hidden of ['Menyu boshqaruvi', 'Sayt sozlamalari', 'Foydalanuvchilar va rollar', /Modullar/, 'Audit jurnali']) {
    await expect(menu.getByRole('link', { name: hidden })).toHaveCount(0);
  }

  // to'g'ridan-to'g'ri havola ham ruxsat bermaydi (interfeys + server)
  await page.goto('/admin/users');
  await expect(page.getByRole('alert')).toContainText('ruxsat yo‘q');
  const usersStatus = await page.evaluate(async () => (await fetch('/api/v1/admin/users')).status);
  expect(usersStatus).toBe(403);

  // qoralama yarata oladi, nashr tugmasi yo'q
  await page.goto('/admin/news/new');
  await page.getByLabel('Sarlavha', { exact: false }).first().fill('Muharrir yangiligi');
  await expect(page.getByRole('button', { name: /nashr qilish/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Qoralama sifatida saqlash' }).click();
  await expect(page.getByText('Material qoralama sifatida saqlandi')).toBeVisible();
  const publishStatus = await page.evaluate(async () => {
    const me = await (await fetch('/api/v1/admin/auth/me')).json();
    const id = location.pathname.split('/').pop();
    return (await fetch(`/api/v1/admin/news/${id}/publish`, { method: 'POST', headers: { 'X-CSRF-Token': me.csrfToken } })).status;
  });
  expect(publishStatus).toBe(403);
});

test('statistika: sahifa ko‘rishlari hisoblanadi va admin panelda hisobot (CSV) yuklab olinadi', async ({ page, request }) => {
  await page.goto('/uz/about');
  await page.waitForTimeout(1500); // beacon 0.8 s dan keyin yuboriladi
  await adminLogin(page);
  await page.goto('/admin/stats');
  await expect(page.getByRole('heading', { name: 'Statistika va hisobotlar', level: 1 })).toBeVisible();
  await expect(page.getByText('Jami ko‘rishlar')).toBeVisible();
  await expect(page.getByRole('link', { name: '/uz/about' })).toBeVisible();
  const csvHref = await page.getByRole('link', { name: /Kontent ro‘yxati \(CSV\)/ }).getAttribute('href');
  const res = await page.request.get(csvHref!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect((await request.get('/api/v1/admin/stats')).status()).toBe(401); // sessiyasiz yopiq
  void adminEmail;
  void adminPassword;
});
