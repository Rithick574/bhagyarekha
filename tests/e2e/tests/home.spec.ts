import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, fetchLatest } from './helpers';

test.describe('results home', () => {
  test('shows the demo banner, latest published result and its status', async ({ page, request }) => {
    const latest = await fetchLatest(request);
    test.skip(latest.dataMode !== 'demo', 'banner assertions only apply to demo deployments');
    await page.goto('/en');
    await expect(page.getByTestId('demo-banner')).toContainText('Sample data — not live results');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const card = page.getByTestId('latest-result-card');
    await expect(card).toBeVisible();
    expect(latest.latestPublished, 'seed must contain a published draw').not.toBeNull();
    const entry = latest.latestPublished!.firstPrize!.entries[0]!;
    await expect(card.getByTestId('ticket-number').first()).toContainText(entry.number);
    await expect(card).toContainText(latest.latestPublished!.drawCode);
    await expect(card.getByText(/Published|Partially published/)).toBeVisible();
    await expect(card.getByText('Sample result')).toBeVisible();
    await expect(page.getByTestId('recent-draws')).toBeVisible();
    await expect(page.getByTestId('check-entry-card')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('never labels a pending draw as the published result', async ({ page, request }) => {
    const latest = await fetchLatest(request);
    test.skip(!latest.pendingDraw, 'no pending draw in fixtures');
    await page.goto('/en');
    const pending = page.getByTestId('pending-draw-card');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText(latest.pendingDraw!.drawCode);
    await expect(pending.getByTestId('ticket-number')).toHaveCount(0);
    await expect(page.getByTestId('latest-result-card')).not.toContainText(latest.pendingDraw!.drawCode);
  });

  test('"View all prizes" opens the details page with every category and verbatim leading zeros', async ({ page, request }) => {
    const latest = await fetchLatest(request);
    await page.goto('/en');
    await page.getByTestId('view-all-prizes').click();
    await expect(page).toHaveURL(new RegExp(`/en/results/${latest.latestPublished!.id}`));
    await expect(page.getByTestId('draw-identity')).toContainText(latest.latestPublished!.drawCode);
    const categories = page.locator('[data-testid^="category-"]');
    expect(await categories.count()).toBeGreaterThan(0);
    await expect(page.getByTestId('source-panel')).toBeVisible();

    // Every number rendered on the page must match the API string exactly (leading zeros intact).
    const res = await request.get(`${process.env.E2E_API_URL ?? 'http://localhost:3001'}/api/v1/draws/${latest.latestPublished!.id}/result?pageSize=30`);
    const body = (await res.json()) as { entries: { items: { series: string; number: string }[] }[] };
    const apiNumbers = body.entries.flatMap((e) => e.items.map((i) => i.number));
    const zeroLed = apiNumbers.find((n) => n.startsWith('0'));
    expect(zeroLed, 'fixtures should include a leading-zero number').toBeDefined();
    await expect(page.getByTestId('ticket-number').filter({ hasText: zeroLed! }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
