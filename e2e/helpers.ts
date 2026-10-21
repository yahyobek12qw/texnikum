import { expect, type Page } from '@playwright/test';

export const adminEmail = () => process.env.E2E_ADMIN_EMAIL!;
export const adminPassword = () => process.env.E2E_ADMIN_PASSWORD!;

export async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Elektron pochta').fill(adminEmail());
  await page.getByLabel('Parol').fill(adminPassword());
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
}

/** Tiptap muharririga matn kiritadi (aria-label bo'yicha topiladi). */
export async function typeInEditor(page: Page, labelStartsWith: string, text: string) {
  const editor = page.locator(`[role="textbox"][aria-label^="${labelStartsWith}"]`);
  await editor.click();
  await page.keyboard.type(text);
}

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
