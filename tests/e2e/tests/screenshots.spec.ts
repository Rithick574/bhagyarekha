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
      if (width === 390) {
        await page.goto('/ml');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: resolve(OUT, `home-ml-${width}.png`), fullPage: true });
      }
    });
  }
});
