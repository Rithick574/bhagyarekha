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
  test('check page has no serious or critical violations before and after an outcome', async ({ page }) => {
    await page.goto('/en/check?draw=d0000001-0000-4000-8000-000000000039');
    await analyse(page);
    await page.getByLabel('Series', { exact: true }).selectOption('AA');
    await page.getByLabel('Ticket number', { exact: true }).fill('001234');
    await page.getByTestId('check-submit').click();
    await expect(page.getByTestId('check-outcome')).toHaveAttribute('data-outcome', 'MATCH');
    await analyse(page);
    // Incomplete-result outcome too.
    await page.goto('/en/check?draw=d0000002-0000-4000-8000-000000000038');
    await page.getByLabel('Series', { exact: true }).selectOption('BB');
    await page.getByLabel('Ticket number', { exact: true }).fill('999999');
    await page.getByTestId('check-submit').click();
    await expect(page.getByTestId('check-outcome')).toHaveAttribute('data-outcome', 'RESULT_INCOMPLETE');
    await analyse(page);
  });
  test('Malayalam home has no serious or critical violations', async ({ page }) => {
    await page.goto('/ml');
    await analyse(page);
  });
});
