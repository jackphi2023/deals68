import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.D68_BASE_URL || 'https://beta-reference-deals68.netlify.app';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['list'],
    ['./tests/reporters/deals68-reporter.ts'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 12_000,
    navigationTimeout: 25_000
  },
  projects: [
    { name: 'chromium-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } },
    { name: 'chromium-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1000 } } },
    { name: 'mobile-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 900 } } }
  ],
  webServer: process.env.D68_USE_LOCAL_SERVER === '1'
    ? { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 120_000 }
    : undefined
});
