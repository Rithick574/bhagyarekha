import { expect, test } from '@playwright/test';

test.describe('keyboard navigation', () => {
  test('Tab reaches the skip link first, then Enter jumps to main content', async ({ page }) => {
    await page.goto('/en');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    const activeId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(['main', '']).toContain(activeId);
  });

  test('the primary action is reachable and activatable with the keyboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop header nav only');
    await page.goto('/en');
    const brand = page.getByRole('link', { name: 'BhagyaRekha home' });
    await brand.focus();
    await expect(brand).toBeFocused();
    // Tab through the header; every stop must have a visible focus outline.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        return getComputedStyle(el).outlineStyle;
      });
      expect(outline).not.toBe('none');
    }
    const cta = page.getByTestId('view-all-prizes');
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/en\/results\//);
  });
});
