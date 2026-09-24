import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

// Seeded synthetic fixture identifiers (apps/api/src/fixtures/demo-fixtures.ts).
const NL_039 = 'd0000001-0000-4000-8000-000000000039'; // complete
const NL_040 = 'd0000001-0000-4000-8000-000000000040'; // not published
const NL_037 = 'd0000001-0000-4000-8000-000000000037'; // suspended
const TH_038 = 'd0000002-0000-4000-8000-000000000038'; // partial
const SB_01 = 'd0000003-0000-4000-8000-000000000001'; // rule revoked
const SB_02 = 'd0000003-0000-4000-8000-000000000002'; // cancelled

async function openCheck(page: Page, drawId: string, locale = 'en') {
  await page.goto(`/${locale}/check?draw=${drawId}`);
  await expect(page.getByTestId('ticket-check-form')).toBeVisible();
}

/**
 * Enters a ticket. Every seeded draw has a known rule, so once the draw detail has
 * loaded the series control is a <select>; waiting for it avoids racing the fetch.
 */
async function enterTicket(page: Page, series: string | null, number: string) {
  if (series !== null) {
    const select = page.getByTestId('series-select');
    await expect(select).toBeVisible();
    const options = (await select.locator('option').allTextContents()).map((o) => o.trim());
    if (options.includes(series)) await select.selectOption(series);
    else await select.selectOption({ index: 0 });
  }
  await page.getByTestId('number-input').fill(number);
}

async function submitAndWait(page: Page) {
  await page.getByTestId('check-submit').click();
  const outcome = page.getByTestId('check-outcome');
  await expect(outcome).toBeVisible();
  await expect(outcome).not.toHaveAttribute('data-outcome', 'checking');
  return outcome;
}

async function runCheck(page: Page, drawId: string, series: string | null, number: string) {
  await openCheck(page, drawId);
  await enterTicket(page, series, number);
  return submitAndWait(page);
}

test.describe('ticket checking', () => {
  test('a first-prize ticket matches with the recorded amount', async ({ page }) => {
    const outcome = await runCheck(page, NL_039, 'AA', '001234');
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await expect(outcome.getByTestId('check-headline')).toContainText('Match found in the published result');
    await expect(outcome.getByTestId('check-match')).toContainText('First prize');
    await expect(outcome.getByTestId('check-match')).toContainText('₹1,00,000');
    await expect(outcome.getByTestId('check-reminder')).toContainText('does not confirm a valid ticket');
    await expect(outcome).toContainText('NL-039');
    await expect(outcome).toContainText('24 September 2026');
    expect(page.url()).not.toContain('001234');
  });

  test('the same number in another allowed series matches the consolation category, never both', async ({ page }) => {
    const outcome = await runCheck(page, NL_039, 'AB', '001234');
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await expect(outcome.getByTestId('check-match')).toContainText('Consolation prize');
    await expect(outcome.getByTestId('check-match')).not.toContainText('First prize');
  });

  test('a suffix match resolves to the last-four-digits category', async ({ page }) => {
    const outcome = await runCheck(page, NL_039, 'AB', '991234');
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await expect(outcome.getByTestId('check-match')).toContainText('Last four digits');
  });

  test('a non-matching ticket against a complete result is a definitive no-match', async ({ page }) => {
    const outcome = await runCheck(page, NL_039, 'AB', '994321');
    await expect(outcome).toHaveAttribute('data-outcome', 'NO_MATCH');
    await expect(outcome.getByTestId('check-headline')).toContainText('No match found in the complete published result');
    await expect(outcome.getByTestId('check-unresolved')).toContainText('None');
    await expect(outcome.getByTestId('check-match')).toHaveCount(0);
  });

  test('an invalid series is rejected inline with no verdict', async ({ page }) => {
    await openCheck(page, NL_039);
    // The select only offers allowed series; force an unknown value the way a tampered form would.
    await page.getByLabel('Ticket number', { exact: true }).fill('001234');
    await page.getByLabel('Series', { exact: true }).evaluate((el) => {
      const select = el as HTMLSelectElement;
      const option = document.createElement('option');
      option.value = 'ZZ';
      option.textContent = 'ZZ';
      select.append(option);
      select.value = 'ZZ';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.getByTestId('check-submit').click();
    await expect(page.getByTestId('check-error-summary')).toContainText('series is not used by the selected draw');
    await expect(page.getByTestId('check-outcome')).toHaveCount(0);
  });

  test('a short number is rejected for length and never padded', async ({ page }) => {
    await openCheck(page, NL_039);
    await enterTicket(page, 'AA', '1234');
    await page.getByTestId('check-submit').click();
    const summary = page.getByTestId('check-error-summary');
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('has 6 digits');
    await expect(page.getByTestId('check-outcome')).toHaveCount(0);
    await expect(page.getByLabel('Ticket number', { exact: true })).toHaveValue('1234');
  });

  test('a match inside a partial result is provisional, with the missing categories listed', async ({ page }) => {
    const outcome = await runCheck(page, TH_038, 'BB', '000077');
    await expect(outcome).toHaveAttribute('data-outcome', 'PARTIAL_MATCH');
    await expect(outcome.getByTestId('check-headline')).toContainText('Provisional match');
    await expect(outcome.getByTestId('check-match')).toContainText('Cannot be confirmed');
    await expect(outcome.getByTestId('check-unresolved')).toContainText('Second prize');
    await expect(outcome.getByTestId('check-unresolved')).toContainText('Last three digits');
    const text = (await page.locator('main').innerText()).toLowerCase();
    expect(text).not.toContain('no prize');
    expect(text).not.toContain('no match found');
  });

  test('no raw match inside a partial result never produces a losing conclusion', async ({ page }) => {
    const outcome = await runCheck(page, TH_038, 'BB', '999999');
    await expect(outcome).toHaveAttribute('data-outcome', 'RESULT_INCOMPLETE');
    await expect(outcome.getByTestId('check-headline')).toContainText('not complete');
    const text = (await page.locator('main').innerText()).toLowerCase();
    expect(text).not.toContain('no prize');
    expect(text).not.toContain('no match found');
    await expect(outcome.getByTestId('check-unresolved')).toContainText('Second prize');
  });

  test('an unpublished draw reports "Result not published"', async ({ page }) => {
    const outcome = await runCheck(page, NL_040, 'AA', '001234');
    await expect(outcome).toHaveAttribute('data-outcome', 'RESULT_NOT_PUBLISHED');
    await expect(outcome.getByTestId('check-headline')).toContainText('Result not published');
  });

  test('a suspended draw reports "temporarily unavailable" without a verdict', async ({ page }) => {
    const outcome = await runCheck(page, NL_037, 'AA', '555000');
    await expect(outcome).toHaveAttribute('data-outcome', 'RESULT_SUSPENDED');
    await expect(outcome.getByTestId('check-headline')).toContainText('temporarily unavailable');
    await expect(outcome.getByTestId('check-match')).toHaveCount(0);
  });

  test('a draw whose rules were revoked reports unsupported checking', async ({ page }) => {
    const outcome = await runCheck(page, SB_01, 'SB', '0123456');
    await expect(outcome).toHaveAttribute('data-outcome', 'RULES_UNSUPPORTED');
    await expect(outcome.getByTestId('check-headline')).toContainText('not available for this draw');
    await expect(outcome.getByTestId('check-match')).toHaveCount(0);
  });

  test('a cancelled draw reports cancellation', async ({ page }) => {
    // No approved rule is attached to this draw, so the form offers a free-text series field.
    await openCheck(page, SB_02);
    await page.getByTestId('series-input').fill('sa');
    await page.getByTestId('number-input').fill('0000000');
    const outcome = await submitAndWait(page);
    await expect(outcome).toHaveAttribute('data-outcome', 'DRAW_CANCELLED');
    await expect(outcome.getByTestId('check-headline')).toContainText('cancelled');
  });

  test('editing the ticket after a result clears the old outcome', async ({ page }) => {
    const outcome = await runCheck(page, NL_039, 'AA', '001234');
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await page.getByLabel('Ticket number', { exact: true }).fill('001235');
    await expect(page.getByTestId('check-outcome')).toHaveAttribute('data-outcome', 'cleared');
    await expect(page.getByTestId('check-match')).toHaveCount(0);
  });

  test('a check can be completed with the keyboard only', async ({ page }) => {
    await openCheck(page, NL_039);
    const series = page.getByLabel('Series', { exact: true });
    await series.focus();
    await series.selectOption('AA');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Ticket number', { exact: true })).toBeFocused();
    await page.keyboard.type('001234');
    await page.keyboard.press('Enter');
    const outcome = page.getByTestId('check-outcome');
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await expect(page.getByTestId('check-outcome-region')).toBeFocused();
  });

  test('the Malayalam check page renders the form and an outcome', async ({ page }) => {
    await page.goto(`/ml/check?draw=${NL_039}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ml');
    await expect(page.getByTestId('ticket-check-form')).toContainText('ടിക്കറ്റ്');
    await page.locator('select').last().selectOption('AA');
    await page.locator('input[inputmode="numeric"]').fill('001234');
    await page.getByTestId('check-submit').click();
    await expect(page.getByTestId('check-outcome')).toHaveAttribute('data-outcome', 'MATCH');
    await expect(page.getByTestId('check-headline')).toContainText('പൊരുത്തം');
    await expectNoHorizontalOverflow(page);
  });

  test('choosing a lottery and draw from scratch works without a preselected draw', async ({ page }) => {
    await page.goto('/en/check');
    await page.getByLabel('Lottery', { exact: true }).selectOption({ label: 'Nila Weekly (Sample)' });
    const draw = page.getByLabel('Draw', { exact: true });
    await expect(draw).toBeEnabled();
    const nl039 = await draw.locator('option', { hasText: 'NL-039' }).getAttribute('value');
    expect(nl039).toBeTruthy();
    await draw.selectOption(nl039 as string);
    await expect(page.getByLabel('Series', { exact: true })).toBeVisible();
    await enterTicket(page, 'AA', '001234');
    const outcome = await submitAndWait(page);
    await expect(outcome).toHaveAttribute('data-outcome', 'MATCH');
    await expectNoHorizontalOverflow(page);
  });

  test('the result page links to checking for that draw', async ({ page }) => {
    await page.goto(`/en/results/${NL_039}`);
    await page.getByTestId('check-this-draw').click();
    await expect(page).toHaveURL(new RegExp(`/en/check\\?draw=${NL_039}`));
    await expect(page.getByTestId('ticket-check-form')).toBeVisible();
  });
});
