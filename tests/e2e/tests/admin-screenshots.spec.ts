import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Admin screenshots + accessibility checks (screenshots project). Requires the
 * publisher account described in admin.spec.ts.
 */
const OUT = resolve(import.meta.dirname, '../screenshots');
const NILA_LOTTERY_ID = 'a0000001-0000-4000-8000-000000000001';

async function login(page: Page) {
  await page.goto('/en/admin/login');
  await page.getByTestId('login-email').fill('publisher@example.test');
  await page.getByTestId('login-password').fill('correct-horse-battery-staple');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('admin-shell')).toBeVisible();
}

async function axeClean(page: Page, label: string) {
  // Client-side navigation updates <title> asynchronously; axe's document-title rule needs it present.
  await expect(page).toHaveTitle(/BhagyaRekha/);
  await page.mouse.move(0, 0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${label} must have no serious/critical axe violations`).toEqual([]);
}

async function shoot(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(OUT, `admin-${name}-${width}.png`), fullPage: true });
}

test.describe('admin screenshots and accessibility', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  test('login page', async ({ page }) => {
    await page.goto('/en/admin/login');
    await expect(page.getByTestId('admin-login-form')).toBeVisible();
    await axeClean(page, 'admin login');
    for (const w of [1280, 390]) await shoot(page, 'login', w);
  });

  test('dashboard, import preview with errors, and a revision page', async ({ page }) => {
    await login(page);
    await axeClean(page, 'admin dashboard');
    for (const w of [1280, 390]) await shoot(page, 'dashboard', w);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/admin/imports');
    await page.getByTestId('import-lottery').selectOption(NILA_LOTTERY_ID);
    const drawSelect = page.getByTestId('import-draw');
    await expect(drawSelect.locator('option', { hasText: 'NL-040' })).toHaveCount(1);
    await drawSelect.selectOption((await drawSelect.locator('option', { hasText: 'NL-040' }).getAttribute('value')) ?? '');
    await expect(page.getByTestId('import-rule')).toHaveValue('1');
    await page.getByTestId('cat-amount-FIRST').fill('1,00,000');
    await page.getByTestId('source-kind').selectOption('MANUAL_TRANSCRIPTION');
    await page.getByTestId('source-title').fill('Screenshot fixture — invalid rows on purpose');
    await page.getByTestId('import-text').fill(
      JSON.stringify([
        { categoryCode: 'FIRST', series: 'AA', number: '12345' },
        { categoryCode: 'LAST4', series: '', number: '0042' },
        { categoryCode: 'LAST4', series: '', number: '0042' },
        { categoryCode: 'NOPE', series: '', number: '0001' },
      ]),
    );
    await page.getByTestId('import-submit').click();
    const preview = page.getByTestId('import-preview');
    await expect(preview).toHaveAttribute('data-status', 'VALIDATION_FAILED');
    await axeClean(page, 'admin import preview');
    for (const w of [1280, 390]) await shoot(page, 'import-preview-errors', w);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/admin/revisions');
    await expect(page.getByTestId('revisions-table')).toBeVisible();
    await page.getByTestId('revisions-table').getByRole('link').first().click();
    await expect(page.getByTestId('revision-header')).toBeVisible();
    await expect(page.getByTestId('audit-list').or(page.getByText('No audit events recorded.'))).toBeVisible();
    await axeClean(page, 'admin revision detail');
    for (const w of [1280, 390]) await shoot(page, 'revision', w);
  });
});
