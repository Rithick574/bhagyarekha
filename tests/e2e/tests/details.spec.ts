import { expect, test } from '@playwright/test';
import { fetchDraws } from './helpers';

test.describe('result details states', () => {
  test('a suspended draw shows "Temporarily unavailable" and no ticket numbers', async ({ page, request }) => {
    const draws = await fetchDraws(request);
    const suspended = draws.find((d) => d.publicationStatus === 'SUSPENDED');
    test.skip(!suspended, 'fixtures contain no suspended draw');
    await page.goto(`/en/results/${suspended!.id}`);
    await expect(page.getByTestId('draw-identity')).toContainText('Temporarily unavailable');
    await expect(page.getByTestId('result-state-notice')).toContainText('withheld');
    await expect(page.getByTestId('ticket-number')).toHaveCount(0);
    await expect(page.locator('[data-testid^="category-"]')).toHaveCount(0);
  });

  test('a partial result shows the incomplete notice and category states', async ({ page, request }) => {
    const draws = await fetchDraws(request);
    const partial = draws.find((d) => d.publicationStatus === 'PARTIAL');
    test.skip(!partial, 'fixtures contain no partial draw');
    await page.goto(`/en/results/${partial!.id}`);
    await expect(page.getByTestId('partial-notice')).toContainText('not complete');
    await expect(page.getByTestId('partial-notice')).toContainText('Do not treat a missing match as');
    await expect(page.getByText(/Missing|Partial/).first()).toBeVisible();
  });

  test('a corrected result is labelled as corrected', async ({ page, request }) => {
    const draws = await fetchDraws(request);
    const corrected = draws.find((d) => d.currentRevision?.isCorrection);
    test.skip(!corrected, 'fixtures contain no corrected draw');
    await page.goto(`/en/results/${corrected!.id}`);
    await expect(page.getByTestId('corrected-notice')).toBeVisible();
    await expect(page.getByTestId('draw-identity')).toContainText('Corrected');
  });

  test('an unknown draw id renders a not-found state, not a result', async ({ page }) => {
    await page.goto('/en/results/00000000-0000-4000-8000-000000000000');
    await expect(page.getByTestId('empty-state')).toContainText('Draw not found');
    await expect(page.getByTestId('ticket-number')).toHaveCount(0);
  });

  test('an unpublished draw renders "Result not published"', async ({ page, request }) => {
    const draws = await fetchDraws(request);
    const pending = draws.find((d) => d.publicationStatus === 'NOT_PUBLISHED');
    test.skip(!pending, 'fixtures contain no unpublished draw');
    await page.goto(`/en/results/${pending!.id}`);
    await expect(page.getByTestId('result-state-notice')).toContainText('Result not published');
    await expect(page.getByTestId('ticket-number')).toHaveCount(0);
  });
});
