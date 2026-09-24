import { expect, test } from '@playwright/test';

test.describe('language and text size', () => {
  test('switching to Malayalam changes the html lang and navigation text', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('group', { name: 'Language' }).getByRole('link', { name: 'മലയാളം' }).click();
    await expect(page).toHaveURL(/\/ml$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ml');
    await expect(page.getByTestId('demo-banner').or(page.getByTestId('latest-result-card')).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'ഫലങ്ങൾ' }).first()).toBeVisible();
    // Cookie persists the choice so the bare root redirects to /ml next time.
    await page.goto('/');
    await expect(page).toHaveURL(/\/ml$/);
  });

  test('text size control changes html[data-text-size] and persists across reloads', async ({ page }) => {
    await page.goto('/en');
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-text-size', /.+/);
    const group = page.getByRole('group', { name: 'Text size' });
    await group.getByRole('button', { name: 'Extra large' }).click();
    await expect(html).toHaveAttribute('data-text-size', 'xlarge');
    await expect(group.getByRole('button', { name: 'Extra large' })).toHaveAttribute('aria-pressed', 'true');
    const fontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(fontSize).toBe('22px');
    await page.reload();
    await expect(html).toHaveAttribute('data-text-size', 'xlarge');
    await group.getByRole('button', { name: 'Standard' }).click();
    await expect(html).not.toHaveAttribute('data-text-size', /.+/);
  });
});
