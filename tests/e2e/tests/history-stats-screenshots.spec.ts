import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const OUT = resolve(import.meta.dirname, '../screenshots');
const NILA = 'a0000001-0000-4000-8000-000000000001';

test.describe('history and statistics screenshots', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const width of [390, 1280]) {
    test(`history and statistics at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/en/history?lottery=${NILA}`);
      await page.getByTestId('history-search-number').fill('001234');
      await page.getByTestId('history-search-submit').click();
      await expect(page.getByTestId('history-search-status')).toContainText('matching');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(OUT, `history-${width}.png`), fullPage: true });

      await page.goto(`/en/statistics?lottery=${NILA}&from=2026-09-01&to=2026-10-31`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(OUT, `statistics-${width}.png`), fullPage: true });
    });
  }
});
