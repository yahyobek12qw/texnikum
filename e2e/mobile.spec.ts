import { expect, test, type Page } from '@playwright/test';
import { adminLogin } from './helpers';

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'gorizontal scroll bo‘lmasligi kerak').toBeLessThanOrEqual(1);
}

test('mobil: bosh sahifa va ichki sahifalarda gorizontal scroll yo‘q, menyu ochiladi', async ({ page }) => {
  await page.goto('/uz');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole('button', { name: 'Menyu' }).click();
  const nav = page.locator('#mobile-nav');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Texnikum haqida' }).click();
  await expect(page).toHaveURL(/\/uz\/about$/);
  await noHorizontalScroll(page);

  for (const path of ['/uz/news', '/uz/documents', '/uz/contacts', '/ru', '/en/transparency']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await noHorizontalScroll(page);
  }
});

test('mobil: admin kirish va boshqaruv sahifalari sig‘adi', async ({ page }) => {
  await page.goto('/admin/login');
  await noHorizontalScroll(page);
  await adminLogin(page);
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Menyuni ochish' }).click();
  await page.getByRole('dialog', { name: 'Admin menyusi' }).getByRole('link', { name: 'Sahifalar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sahifalar', level: 1 })).toBeVisible();
  await noHorizontalScroll(page);
});
