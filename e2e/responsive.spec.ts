import { expect, test } from '@playwright/test';
import { adminLogin } from './helpers';

// Talab qilingan ekranlar: mobil 320–430, planshet ~768, noutbuk 1024–1440, katta monitor 1440+
const WIDTHS = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
const PUBLIC_PATHS = ['/uz', '/ru/about', '/en/news', '/uz/documents', '/uz/contacts', '/uz/transparency', '/uz/search?q=test'];

for (const width of WIDTHS) {
  test(`responsive ${width}px: ommaviy sahifalarda gorizontal scroll yo‘q`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PUBLIC_PATHS) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(1);
    }
    if (width === 375 || width === 1440) {
      await page.goto('/uz');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `test-results/screens/home-${width}.png`, fullPage: true });
    }
  });
}

for (const width of [320, 768, 1440]) {
  test(`responsive ${width}px: admin panel sahifalari sig‘adi`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await adminLogin(page);
    for (const path of ['/admin', '/admin/pages', '/admin/news', '/admin/documents', '/admin/media', '/admin/navigation', '/admin/settings', '/admin/audit', '/admin/pages/new']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      // jadvallar o'z konteyneri ichida scroll bo'ladi, sahifa esa kengaymasligi kerak
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(1);
    }
    if (width === 1440) {
      await page.goto('/admin/pages/new');
      await expect(page.getByRole('heading', { name: 'Yangi sahifa', level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/screens/admin-page-editor.png' });
      await page.goto('/admin');
      await expect(page.getByRole('region', { name: 'Statistika' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/screens/admin-dashboard.png' });
    }
  });
}
