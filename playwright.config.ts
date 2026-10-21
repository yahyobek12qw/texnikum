import { defineConfig, devices } from '@playwright/test';

export const E2E_PORT = 4100;

// E2E testlar production build (node server/dist/server.js) ustida, alohida PostgreSQL bazasida ishlaydi.
// Baza, migratsiya, seed, administrator va server global-setup.ts da ishga tushiriladi. Oldin `npm run build` kerak.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'uz-UZ',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 850 } }, testIgnore: /mobile\.spec\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], channel: 'msedge' },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
