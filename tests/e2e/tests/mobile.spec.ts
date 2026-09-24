import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

test.describe('mobile layout', () => {
  test('bottom navigation shows four labelled items and does not hide content', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile project only');
    await page.goto('/en');
    const nav = page.getByRole('navigation', { name: 'Quick navigation' });
    await expect(nav).toBeVisible();
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(4);
    for (const label of ['Results', 'Check', 'History', 'Stats']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
    for (let i = 0; i < 4; i += 1) {
      const box = await links.nth(i).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    }
    // Language switcher is visible on mobile too.
    await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
    // Footer content must be reachable above the fixed nav.
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    const footerBox = await page.getByRole('contentinfo').boundingBox();
    const navBox = await nav.boundingBox();
    expect((footerBox?.y ?? 0) + (footerBox?.height ?? 0)).toBeLessThanOrEqual((navBox?.y ?? 0) + 1);
    await expectNoHorizontalOverflow(page);
  });

  for (const [width, locale] of [
    [360, 'en'],
    [390, 'en'],
    [360, 'ml'],
    [390, 'ml'],
  ] as const) {
    test(`no horizontal overflow at ${width}px (${locale}) on home and details`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile project only');
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${locale}`);
      await expectNoHorizontalOverflow(page);
      await page.getByTestId('view-all-prizes').click();
      await expect(page.getByTestId('draw-identity')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('desktop layout', () => {
  for (const width of [1024, 1280, 1440]) {
    for (const locale of ['en', 'ml'] as const) {
      test(`no horizontal overflow at ${width}px (${locale}) on home and check`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop widths only');
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}`);
        await expectNoHorizontalOverflow(page);
        await page.goto(`/${locale}/check?draw=d0000001-0000-4000-8000-000000000039`);
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});
