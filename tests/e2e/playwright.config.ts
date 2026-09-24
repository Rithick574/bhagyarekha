import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Root .env supplies DATABASE_URL / DATA_MODE for the API webServer. Missing file is fine in CI.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  /* no .env: rely on the environment */
}

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const API = process.env.E2E_API_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  webServer: [
    {
      command: 'pnpm --filter @bhagyarekha/api start',
      url: `${API}/api/v1/health/live`,
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: resolve(import.meta.dirname, '../..'),
      // The suite fires many ticket checks in parallel from one address. Production stays at 30/min.
      env: { ...process.env, RATE_LIMIT_PER_MINUTE: '100000', RATE_LIMIT_CHECK_PER_MINUTE: '100000' },
    },
    {
      command: 'pnpm --filter @bhagyarekha/web start',
      url: `${WEB}/en`,
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: resolve(import.meta.dirname, '../..'),
      // `next start` requires production. A shell or .env NODE_ENV must not leak into this process.
      env: { ...process.env, NODE_ENV: 'production' },
    },
  ],
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
