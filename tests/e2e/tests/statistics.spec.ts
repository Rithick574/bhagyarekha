import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

const NILA = 'a0000001-0000-4000-8000-000000000001';
const SEPTEMBER = `/en/statistics?lottery=${NILA}&from=2026-09-01&to=2026-09-30`;
const NON_PREDICTIVE = 'These are descriptive counts of past published results. They are not probabilities for any future draw and not a recommendation to buy any number.';

async function analyse(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, summary).toEqual([]);
}

async function exclusionCount(page: Page, reason: string): Promise<number> {
  const text = (await page.getByTestId(`exclusion-count-${reason}`).innerText()).replace(/[^\d]/g, '');
  return Number.parseInt(text, 10);
}

test.describe('statistics', () => {
  test('September 2026 for Nila: scope first, exclusions, the non-predictive notice, tables with captions, notes', async ({ page }) => {
    await page.goto(SEPTEMBER);
    await expect(page.getByRole('heading', { level: 1, name: 'Statistics' })).toBeVisible();

    // (a) Scope before any chart.
    const scope = page.getByTestId('stats-scope');
    await expect(scope).toContainText('Nila Weekly (Sample)');
    await expect(scope).toContainText('1 September 2026 to 30 September 2026');
    await expect(page.getByTestId('stats-observation-unit')).toContainText('one first-prize entry');
    const observations = Number.parseInt((await page.getByTestId('stats-observation-count').innerText()).replace(/[^\d]/g, ''), 10);
    expect(observations).toBeGreaterThanOrEqual(3);
    expect(await exclusionCount(page, 'SUSPENDED')).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('exclusion-SUSPENDED')).toContainText('Result withheld (suspended)');
    await expect(page.getByTestId('stats-coverage')).toContainText('This archive is not verified as a complete calendar of draws; missing draws are not counted.');
    await expect(scope).toContainText('Dataset version');
    await expect(scope).toContainText('IST');

    // (b) The notice is present and appears before the metric sections.
    const notice = page.getByTestId('stats-non-predictive');
    await expect(notice).toContainText(NON_PREDICTIVE);
    const noticeBox = await notice.boundingBox();
    const positionsBox = await page.getByTestId('stats-positions').boundingBox();
    expect(noticeBox!.y).toBeLessThan(positionsBox!.y);

    // (c) Every metric section has an accessible table with a caption, and charts are hidden duplicates.
    for (const id of ['stats-positions', 'stats-last-two', 'stats-last-three', 'stats-parity', 'stats-digit-sum']) {
      const section = page.getByTestId(id);
      await expect(section.locator('table caption').first()).toHaveText(/.+/);
      expect(await section.locator('th[scope="col"]').count()).toBeGreaterThan(0);
    }
    const positions = page.getByTestId('stats-positions');
    await expect(positions.locator('tbody tr')).toHaveCount(6);
    await expect(positions.locator('thead th')).toHaveCount(11);
    expect(await page.locator('[aria-hidden="true"] svg').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('stats-tiles').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('stats-tile-duplicate-digits')).toContainText(/\d+ of \d+/);

    // (d) Notes verbatim.
    const notes = page.getByTestId('stats-notes').getByRole('listitem');
    expect(await notes.count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('stats-notes')).toContainText('How to read this');
    await expect(page.getByTestId('stats-notes')).toContainText('not probabilities for any future draw');
    await expectNoHorizontalOverflow(page);
  });

  test('a range that includes the unpublished NL-040 counts it under exclusions', async ({ page }) => {
    await page.goto(`/en/statistics?lottery=${NILA}&from=2026-09-01&to=2026-10-31`);
    expect(await exclusionCount(page, 'NOT_PUBLISHED')).toBeGreaterThanOrEqual(1);
    expect(await exclusionCount(page, 'SUSPENDED')).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('exclusion-NOT_PUBLISHED')).toContainText('No published result');
  });

  test('an empty period says so and shows no percentages anywhere', async ({ page }) => {
    await page.goto(`/en/statistics?lottery=${NILA}&from=2020-01-01&to=2020-01-31`);
    await expect(page.getByTestId('stats-empty')).toContainText('No eligible verified observations in this range.');
    await expect(page.getByTestId('stats-non-predictive')).toBeVisible();
    await expect(page.getByTestId('stats-notes')).toBeVisible();
    await expect(page.getByTestId('stats-positions')).toHaveCount(0);
    const mainText = await page.getByRole('main').innerText();
    expect(mainText).not.toContain('%');
  });

  test('defaults to the first active lottery and a 366-day window ending today (IST)', async ({ page }) => {
    await page.goto('/en/statistics');
    await expect(page.getByTestId('stats-scope')).toBeVisible();
    const from = await page.getByLabel('From date', { exact: true }).inputValue();
    const to = await page.getByLabel('To date', { exact: true }).inputValue();
    const days = Math.round((Date.UTC(...toParts(to)) - Date.UTC(...toParts(from))) / 86_400_000) + 1;
    expect(days).toBe(366);
    const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    expect(to).toBe(todayIst);
  });

  test('an impossible range gets a plain-language notice, never a raw error', async ({ page }) => {
    await page.goto(`/en/statistics?lottery=${NILA}&from=2026-09-30&to=2026-09-01`);
    await expect(page.getByTestId('stats-invalid-range')).toContainText('at most 366 days');
    await page.goto(`/en/statistics?lottery=${NILA}&from=2024-01-01&to=2026-09-01`);
    await expect(page.getByTestId('stats-invalid-range')).toBeVisible();
    await expect(page.getByTestId('stats-scope')).toHaveCount(0);
  });

  test('the filter form is keyboard-operable and submits with Enter', async ({ page }) => {
    await page.goto(SEPTEMBER);
    const to = page.getByLabel('To date', { exact: true });
    await to.focus();
    await expect(to).toBeFocused();
    await to.fill('2026-10-31');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/to=2026-10-31/);
    await expect(page.getByTestId('stats-scope')).toContainText('31 October 2026');
  });

  test('statistics has no serious or critical axe violations (with data and empty)', async ({ page }) => {
    await page.goto(SEPTEMBER);
    await analyse(page);
    await page.goto(`/en/statistics?lottery=${NILA}&from=2020-01-01&to=2020-01-31`);
    await analyse(page);
    await page.goto(`/ml/statistics?lottery=${NILA}&from=2026-09-01&to=2026-09-30`);
    await expect(page.getByTestId('stats-scope')).toBeVisible();
    await analyse(page);
  });
});

test.describe('statistics mobile layout', () => {
  for (const [width, locale] of [
    [360, 'en'],
    [390, 'en'],
    [360, 'ml'],
  ] as const) {
    test(`no horizontal overflow at ${width}px (${locale})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile project only');
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${locale}/statistics?lottery=${NILA}&from=2026-09-01&to=2026-09-30`);
      await expect(page.getByTestId('stats-scope')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

function toParts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y!, m! - 1, d!];
}
