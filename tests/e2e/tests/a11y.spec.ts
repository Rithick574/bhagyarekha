import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { fetchLatest } from './helpers';

async function analyse(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, summary).toEqual([]);
}

test.describe('automated accessibility (axe)', () => {
  test('home has no serious or critical violations', async ({ page }) => {
    await page.goto('/en');
    await analyse(page);
  });
  test('details has no serious or critical violations', async ({ page, request }) => {
    const latest = await fetchLatest(request);
    await page.goto(`/en/results/${latest.latestPublished!.id}`);
    await analyse(page);
  });
  test('help has no serious or critical violations', async ({ page }) => {
    await page.goto('/en/help');
    await analyse(page);
  });
  test('Malayalam home has no serious or critical violations', async ({ page }) => {
    await page.goto('/ml');
    await analyse(page);
  });
});
