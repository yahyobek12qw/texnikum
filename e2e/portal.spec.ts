import { expect, test } from '@playwright/test';
import { PDF, adminLogin, typeInEditor } from './helpers';

test.describe.configure({ mode: 'serial' });

test('ommaviy sayt uch tilda ochiladi, bo‘sh holatlar halol ko‘rsatiladi, til almashadi', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(uz|ru|en)$/);

  await page.goto('/uz');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uz');
  await expect(page.getByRole('heading', { name: 'Uchko‘prik 1-sonli texnikumi', level: 1 })).toBeVisible();
  await expect(page.getByText('Hozircha yangiliklar nashr qilinmagan.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Asosiy navigatsiya' }).first()).toContainText('Texnikum haqida');

  // Til almashtirish: sahifaning ruscha versiyasiga o'tadi, kontent ham o'zgaradi
  await page.goto('/uz/about');
  await expect(page.getByRole('heading', { name: 'Texnikum haqida', level: 1 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Til' }).getByRole('link', { name: 'Русский' }).click();
  await expect(page).toHaveURL(/\/ru\/about$/);
  await expect(page.getByRole('heading', { name: 'О техникуме', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('navigation', { name: 'Язык' }).getByRole('link', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'About the college', level: 1 })).toBeVisible();

  // Mavjud bo'lmagan sahifa: 404 sahifa va HTTP 404
  const res = await page.goto('/uz/yoq-sahifa');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeVisible();
});

test('SEO: server har bir sahifaga title, description, canonical va hreflang qo‘shadi; sitemap va robots', async ({ request }) => {
  const html = await (await request.get('/uz/about')).text();
  expect(html).toContain('<html lang="uz">');
  expect(html).toMatch(/<title>Texnikum haqida/);
  expect(html).toContain('<link rel="canonical" href="http://localhost:4100/uz/about">');
  expect(html).toContain('hreflang="ru" href="http://localhost:4100/ru/about"');
  expect(html).toContain('hreflang="x-default"');

  const sm = await (await request.get('/sitemap.xml')).text();
  expect(sm).toContain('http://localhost:4100/en/about');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /admin');
  const admin = await (await request.get('/admin')).text();
  expect(admin).toContain('noindex');
});

test('admin: noto‘g‘ri parol rad etiladi, to‘g‘ri parol bilan kiradi, himoyalangan sahifa loginga yo‘naltiradi', async ({ page }) => {
  await page.goto('/admin/pages');
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel('Elektron pochta').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Parol').fill('noto-g-ri-parol-1');
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page.getByRole('alert')).toContainText('noto‘g‘ri');

  await adminLogin(page);
  await expect(page.getByRole('region', { name: 'Statistika' })).toBeVisible();
});

test('admin: yangilik yaratish → qoralama ommaviy ko‘rinmaydi → nashr → uch tilda ko‘rinadi', async ({ page, request }) => {
  await adminLogin(page);

  await page.goto('/admin/news/new');
  await page.getByLabel('Sarlavha', { exact: false }).first().fill('Birinchi sinov yangiligi');
  await expect(page.getByLabel('Slug (URL)')).toHaveValue('birinchi-sinov-yangiligi');
  await page.getByLabel('Qisqa tavsif').first().fill('Bu sinov uchun qisqa tavsif');
  await typeInEditor(page, 'Asosiy matn (uz)', 'Sinov yangiligining asosiy matni.');

  // Ruscha tarjima
  await page.getByRole('tab', { name: /Русский/ }).click();
  await page.getByLabel('Sarlavha').first().fill('Первая тестовая новость');
  await page.getByLabel('Slug (URL)').fill('pervaya-novost');
  await page.getByLabel('Qisqa tavsif').first().fill('Краткое описание');
  await typeInEditor(page, 'Asosiy matn (ru)', 'Текст тестовой новости.');

  // Avval qoralama sifatida saqlaymiz
  await page.getByRole('button', { name: 'Qoralama sifatida saqlash' }).click();
  await expect(page.getByText('Material qoralama sifatida saqlandi')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/news\/[a-z0-9]+$/);

  const draft = await request.get('/api/v1/public/news/birinchi-sinov-yangiligi?locale=uz');
  expect(draft.status()).toBe(404);
  const draftPage = await request.get('/uz/news/birinchi-sinov-yangiligi');
  expect(draftPage.status()).toBe(404);

  // Nashr qilish
  await page.getByRole('button', { name: 'Saqlash va hozir nashr qilish' }).click();
  await expect(page.getByText('Material saqlandi va nashr qilindi')).toBeVisible();

  // Ommaviy sayt: o'zbekcha
  await page.goto('/uz/news');
  await expect(page.getByRole('link', { name: 'Birinchi sinov yangiligi' })).toBeVisible();
  await page.getByRole('link', { name: 'Birinchi sinov yangiligi' }).click();
  await expect(page.getByRole('heading', { name: 'Birinchi sinov yangiligi', level: 1 })).toBeVisible();
  await expect(page.getByText('Sinov yangiligining asosiy matni.')).toBeVisible();

  // Til almashtirish: ruscha slug, ruscha matn
  await page.getByRole('navigation', { name: 'Til' }).getByRole('link', { name: 'Русский' }).click();
  await expect(page).toHaveURL(/\/ru\/news\/pervaya-novost$/);
  await expect(page.getByRole('heading', { name: 'Первая тестовая новость', level: 1 })).toBeVisible();
  await expect(page.getByText('Текст тестовой новости.')).toBeVisible();

  // Inglizcha tarjima yo'q: asl til haqida ogohlantirish bilan o'zbekcha matn
  await page.getByRole('navigation', { name: 'Язык' }).getByRole('link', { name: 'English' }).click();
  await expect(page.getByText(/Original language: O‘zbekcha/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Birinchi sinov yangiligi', level: 1 })).toBeVisible();

  // Qidiruv haqiqiy natija beradi
  await page.goto('/ru/search?q=тестовая');
  await expect(page.getByRole('link', { name: 'Первая тестовая новость' })).toBeVisible();

  // Nashrdan qaytarilsa, yana yashirinadi
  await page.goto('/admin/news');
  await page.getByRole('button', { name: 'Nashrdan qaytarish' }).first().click();
  await expect(page.getByText('nashrdan qaytarildi')).toBeVisible();
  expect((await request.get('/uz/news/birinchi-sinov-yangiligi')).status()).toBe(404);
});

test('admin: sahifa qoralama/nashr, menyu, rich-text XSS tozalanishi', async ({ page, request }) => {
  await adminLogin(page);
  await page.goto('/admin/pages/new');
  await page.getByLabel('Sarlavha', { exact: false }).first().fill('Sinov sahifasi');
  await typeInEditor(page, 'Sahifa matni (uz)', 'Sahifa matni shu yerda.');
  await page.getByRole('button', { name: 'Saqlash va nashr qilish' }).click();
  await expect(page.getByText('Sahifa saqlandi va nashr qilindi')).toBeVisible();

  const res = await request.get('/uz/sinov-sahifasi');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<title>Sinov sahifasi');

  // Menyuga qo'shish
  await page.goto('/admin/navigation');
  await page.getByRole('button', { name: 'Band qo‘shish', exact: true }).click();
  const itemDialog = page.getByRole('dialog', { name: 'Menyu bandi' });
  await itemDialog.getByRole('combobox', { name: /^Sahifa/ }).selectOption({ label: 'Sinov sahifasi' });
  await itemDialog.getByLabel('O‘zbekcha').fill('Sinov bandi');
  await itemDialog.getByRole('button', { name: 'Qo‘llash' }).click();
  await page.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(page.getByText('Menyu saqlandi va saytda yangilandi')).toBeVisible();
  await page.goto('/uz');
  await expect(page.getByRole('navigation', { name: 'Asosiy navigatsiya' }).first().getByRole('link', { name: 'Sinov bandi' })).toBeVisible();

  // XSS: API orqali xavfli HTML yuborilsa, saqlanmaydi
  const csrf = await page.evaluate(async () => (await (await fetch('/api/v1/admin/auth/me')).json()).csrfToken as string);
  const created = await page.evaluate(async (token) => {
    const r = await fetch('/api/v1/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ template: 'DEFAULT', sortOrder: 0, translations: { uz: { title: 'XSS', slug: 'xss-test', content: '<img src=x onerror=alert(1)><script>alert(2)</script><p>ok</p>' } } }),
    });
    return r.json();
  }, csrf);
  expect(created.translations.uz.content).not.toMatch(/onerror|<script/);
  expect(created.translations.uz.content).toContain('<p>ok</p>');
});

test('admin: hujjat yuklash, nashr qilish, ommaviy sahifadan yuklab olish; noto‘g‘ri fayl rad etiladi', async ({ page, request }) => {
  await adminLogin(page);
  await page.goto('/admin/documents');
  await page.getByRole('button', { name: 'Yangi hujjat' }).first().click();

  // Fayl tanlash oynasi: noto'g'ri fayl rad etiladi
  await page.getByRole('button', { name: 'Tanlash' }).click();
  await page.locator('#picker-upload').setInputFiles({ name: 'zararli.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ\x90\x00 bu pdf emas') });
  await expect(page.getByText(/Fayl yuklanmadi/)).toBeVisible();

  await page.locator('#picker-upload').setInputFiles({ name: 'nizom.pdf', mimeType: 'application/pdf', buffer: PDF });
  await expect(page.getByText('Fayl yuklandi')).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Yangi hujjat' });
  await dialog.getByLabel('Nomi').fill('Texnikum nizomi (sinov)');
  await dialog.getByLabel('Raqami / rekvizitlar').fill('12-son');
  await dialog.getByRole('button', { name: 'Saqlash va nashr qilish' }).click();
  await expect(page.getByText('Hujjat yaratildi va nashr qilindi')).toBeVisible();

  await page.goto('/uz/documents');
  await expect(page.getByRole('heading', { name: 'Texnikum nizomi (sinov)' })).toBeVisible();
  const href = await page.getByRole('link', { name: /Yuklab olish/ }).first().getAttribute('href');
  const dl = await request.get(href!);
  expect(dl.status()).toBe(200);
  expect(dl.headers()['content-disposition']).toContain('nizom.pdf');
  expect((await dl.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('admin: sessiya logoutdan keyin yopiladi', async ({ page }) => {
  await adminLogin(page);
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin/pages');
  await expect(page).toHaveURL(/\/admin\/login/);
});
