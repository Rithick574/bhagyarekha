import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

// Seeded synthetic fixtures (apps/api/src/fixtures/demo-fixtures.ts). Earlier admin tests may add NL-E2E-* draws.
const NILA = 'a0000001-0000-4000-8000-000000000001';

function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/** The list renders a table at ≥1024px and cards below; only one is visible. */
function rows(page: Page) {
  return page.getByTestId(isDesktop(page) ? 'history-row' : 'history-card');
}
function searchRows(page: Page) {
  return page.getByTestId(isDesktop(page) ? 'history-search-row' : 'history-search-card');
}

async function analyse(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, summary).toEqual([]);
}

test.describe('history list', () => {
  test('the default list shows every recorded draw, newest first, including NL-039', async ({ page }) => {
    await page.goto('/en/history');
    await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
    await expect(page.getByTestId('history-list')).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThanOrEqual(11);
    await expect(rows(page).filter({ hasText: 'NL-039' })).toHaveCount(1);
    // Leading zeros are rendered verbatim.
    await expect(rows(page).filter({ hasText: 'NL-039' }).getByTestId('ticket-number')).toContainText('001234');
    await expectNoHorizontalOverflow(page);
  });

  test('the lottery filter narrows the list and reports unverified archive coverage', async ({ page }) => {
    await page.goto('/en/history');
    await page.getByLabel('Lottery', { exact: true }).selectOption(NILA);
    await page.getByTestId('history-apply').click();
    await expect(page).toHaveURL(new RegExp(`lottery=${NILA}`));
    // Auto-retrying assertions first: the filtered page streams in after the URL changes.
    await expect(page.getByTestId('history-coverage-notice')).toContainText('Archive coverage for this period is not verified as complete.');
    await expect(rows(page).filter({ hasText: 'NL-036' })).toHaveCount(1);
    const all = rows(page);
    const count = await all.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) await expect(all.nth(i)).toContainText('Nila Weekly (Sample)');
  });

  test('a one-day date filter shows both draws held on 17 September 2026', async ({ page }) => {
    await page.goto('/en/history');
    await page.getByLabel('From date', { exact: true }).fill('2026-09-17');
    await page.getByLabel('To date', { exact: true }).fill('2026-09-17');
    await page.getByTestId('history-apply').click();
    await expect(page).toHaveURL(/from=2026-09-17/);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).filter({ hasText: 'NL-038' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'SB-2026-01' })).toHaveCount(1);
    await expect(page.getByTestId('history-count')).toContainText('2 draws recorded');
  });

  test('the draw code filter is exact and case-insensitive', async ({ page }) => {
    await page.goto('/en/history?code=th-037');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('TH-037');
    await expect(rows(page).first()).toContainText('Corrected');
    // Filters are preserved as URL state.
    await expect(page.getByLabel('Draw code', { exact: true })).toHaveValue('th-037');
  });

  test('a range with no recorded draws shows the archive-gap sentence, not a verdict', async ({ page }) => {
    await page.goto('/en/history?from=2020-01-01&to=2020-01-31');
    await expect(page.getByTestId('history-empty')).toContainText('No recorded draws match these filters. A gap in this archive does not mean no draw took place.');
    await expect(page.getByTestId('history-list')).toHaveCount(0);
  });

  test('invalid URL values are ignored with a notice rather than guessed', async ({ page }) => {
    await page.goto('/en/history?lottery=not-a-uuid&from=2026-02-30');
    await expect(page.getByTestId('history-ignored')).toContainText('Lottery, From date');
    await expect(page.getByTestId('history-list')).toBeVisible();
    await page.goto('/en/history?from=2026-09-30&to=2026-09-01');
    await expect(page.getByTestId('history-from-after-to')).toBeVisible();
  });

  test('filters are reachable by keyboard and submit with Enter', async ({ page }) => {
    await page.goto('/en/history');
    const code = page.getByLabel('Draw code', { exact: true });
    await code.focus();
    await expect(code).toBeFocused();
    await page.keyboard.type('TH-037');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/code=TH-037/);
    await expect(rows(page)).toHaveCount(1);
    await page.getByTestId('history-reset').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/en\/history$/);
  });
});

test.describe('history number search', () => {
  test('a full-number search lists every published category carrying that number and keeps it out of the URL', async ({ page }) => {
    await page.goto(`/en/history?lottery=${NILA}`);
    await page.getByTestId('history-search-type-full').check();
    await page.getByTestId('history-search-number').fill('001234');
    await page.getByTestId('history-search-submit').click();
    const status = page.getByTestId('history-search-status');
    await expect(status).toContainText('2 matching entries');
    await expect(searchRows(page)).toHaveCount(2);
    await expect(searchRows(page).filter({ hasText: 'First prize' })).toHaveCount(1);
    await expect(searchRows(page).filter({ hasText: 'Consolation prize' })).toHaveCount(1);
    for (let i = 0; i < 2; i += 1) {
      await expect(searchRows(page).nth(i)).toContainText('NL-039');
      await expect(searchRows(page).nth(i).getByTestId('ticket-number')).toContainText('001234');
    }
    await expect(page.getByTestId('history-search-unsearchable')).toContainText(/Only draws with a current published result are searched\. \d+ draws in this range could not be searched/);
    expect(page.url()).not.toContain('001234');
    expect(page.url()).not.toContain('number=');
    await expectNoHorizontalOverflow(page);
  });

  test('an ending-digits search finds the suffix category entry verbatim', async ({ page }) => {
    await page.goto(`/en/history?lottery=${NILA}`);
    await page.getByTestId('history-search-type-suffix').check();
    await page.getByTestId('history-search-number').fill('0042');
    await page.getByTestId('history-search-submit').click();
    await expect(page.getByTestId('history-search-status')).toContainText('1 matching entry');
    await expect(searchRows(page)).toHaveCount(1);
    await expect(searchRows(page).first()).toContainText('Last four digits');
    await expect(searchRows(page).first()).toContainText('NL-039');
    await expect(searchRows(page).first().getByTestId('ticket-number')).toHaveText(/0042/);
    expect(page.url()).not.toContain('0042');
  });

  test('a number with no published match never reads as a losing verdict', async ({ page }) => {
    await page.goto('/en/history');
    await page.getByTestId('history-search-number').fill('999999999999');
    await page.getByTestId('history-search-submit').click();
    const status = page.getByTestId('history-search-status');
    await expect(status).toContainText('No published entry in the searched draws matches these digits');
    await expect(page.getByTestId('history-search')).not.toContainText(/did not win|no prize/i);
    await expect(page.getByTestId('history-search-unsearchable')).toBeVisible();
  });

  test('client-side validation rejects non-digits and over-long ranges without a request', async ({ page }) => {
    await page.goto('/en/history');
    let requests = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/history/search')) requests += 1;
    });
    await page.getByTestId('history-search-number').fill('12a4');
    await page.getByTestId('history-search-submit').click();
    await expect(page.getByText('Enter 1 to 12 digits only.')).toBeVisible();
    await page.getByTestId('history-search-number').fill('1234');
    await page.getByLabel('From date (optional)').fill('2024-01-01');
    await page.getByLabel('To date (optional)').fill('2026-09-24');
    await page.getByTestId('history-search-submit').click();
    await expect(page.getByText('The date range may not exceed 366 days.')).toBeVisible();
    expect(requests).toBe(0);
  });

  test('history page has no serious or critical axe violations before and after a search', async ({ page }) => {
    await page.goto(`/en/history?lottery=${NILA}`);
    await analyse(page);
    await page.getByTestId('history-search-number').fill('001234');
    await page.getByTestId('history-search-submit').click();
    await expect(page.getByTestId('history-search-status')).toContainText('matching');
    await analyse(page);
  });

  test('Malayalam history page renders and has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/ml/history');
    await expect(page.getByTestId('history-list')).toBeVisible();
    await analyse(page);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('history mobile layout', () => {
  for (const width of [360, 390]) {
    test(`no horizontal overflow at ${width}px, with search results`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile project only');
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/en/history');
      await expectNoHorizontalOverflow(page);
      await page.getByTestId('history-search-number').fill('001234');
      await page.getByTestId('history-search-submit').click();
      await expect(page.getByTestId('history-search-status')).toContainText('matching');
      await expectNoHorizontalOverflow(page);
    });
  }
});
