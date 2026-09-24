import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from '@playwright/test';
import { fetchLatest } from './helpers';

const OUT = resolve(import.meta.dirname, '../screenshots');
const WIDTHS = [360, 390, 768, 1280, 1440];

test.describe('responsive screenshots', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const width of WIDTHS) {
    test(`home and details at ${width}px`, async ({ page, request }) => {
      const latest = await fetchLatest(request);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/en');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(OUT, `home-${width}.png`), fullPage: true });
      await page.goto(`/en/results/${latest.latestPublished!.id}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(OUT, `details-${width}.png`), fullPage: true });
      if (width === 390 || width === 1280) {
        await page.goto('/en/check?draw=d0000001-0000-4000-8000-000000000039');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: resolve(OUT, `check-empty-${width}.png`), fullPage: true });
        await page.getByLabel('Series', { exact: true }).selectOption('AA');
        await page.getByLabel('Ticket number', { exact: true }).fill('001234');
        await page.getByTestId('check-submit').click();
        await page.getByTestId('check-outcome').filter({ has: page.locator('[data-outcome="MATCH"]') }).or(page.locator('[data-testid="check-outcome"][data-outcome="MATCH"]')).first().waitFor();
        await page.screenshot({ path: resolve(OUT, `check-match-${width}.png`), fullPage: true });
        await page.goto('/en/check?draw=d0000002-0000-4000-8000-000000000038');
        await page.waitForLoadState('networkidle');
        await page.getByLabel('Series', { exact: true }).selectOption('BB');
        await page.getByLabel('Ticket number', { exact: true }).fill('999999');
        await page.getByTestId('check-submit').click();
        await page.locator('[data-testid="check-outcome"][data-outcome="RESULT_INCOMPLETE"]').waitFor();
        await page.screenshot({ path: resolve(OUT, `check-incomplete-${width}.png`), fullPage: true });
      }
      if (width === 390) {
        await page.goto('/ml');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: resolve(OUT, `home-ml-${width}.png`), fullPage: true });
      }
    });
  }
});
