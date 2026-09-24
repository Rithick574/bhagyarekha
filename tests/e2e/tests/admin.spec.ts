import { expect, test, type Page } from '@playwright/test';

/**
 * Admin operations (Stage 3). Runs in the desktop project only against the seeded demo
 * API. Two operators must exist in the API's database:
 *   publisher@example.test / correct-horse-battery-staple  (PUBLISHER)
 *   editor@example.test    / correct-horse-battery-staple  (EDITOR)
 * Every created record uses a unique draw code so reruns never collide.
 */
const PASSWORD = 'correct-horse-battery-staple';
const PUBLISHER = 'publisher@example.test';
const EDITOR = 'editor@example.test';
const NILA_LOTTERY_ID = 'a0000001-0000-4000-8000-000000000001';

test.skip(({ isMobile }) => isMobile === true, 'admin flows are desktop-only in e2e');

async function login(page: Page, email: string) {
  await page.goto('/en/admin/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('admin-shell')).toBeVisible();
  await expect(page.getByTestId('admin-user-email')).toContainText(email);
}

/** Selects the <option> whose visible text contains `text` (Playwright's selectOption has no regex label form). */
async function selectOptionContaining(page: Page, testId: string, text: string) {
  const select = page.getByTestId(testId);
  await expect(select.locator('option', { hasText: text })).toHaveCount(1);
  const value = await select.locator('option', { hasText: text }).getAttribute('value');
  await select.selectOption(value ?? '');
}

/** Ticket numbers render as separate series/number spans; match on the rendered component. */
const ticketWith = (page: Page, number: string) => page.getByTestId('ticket-number').filter({ hasText: number });

async function logoutAndExpectLogin(page: Page) {
  await page.getByTestId('admin-logout').click();
  await expect(page.getByTestId('admin-login-form')).toBeVisible();
  const session = await page.request.get('/api/v1/auth/session');
  expect(session.status()).toBe(401);
}

test.describe('admin access control', () => {
  test('an unauthenticated visit to /admin redirects to the login page', async ({ page }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
    await expect(page.getByTestId('admin-login-form')).toBeVisible();
    // Admin pages are never indexable.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('a wrong password shows a generic error and no session is created', async ({ page }) => {
    await page.goto('/en/admin/login');
    await page.getByTestId('login-email').fill(PUBLISHER);
    await page.getByTestId('login-password').fill('definitely-not-the-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('admin-login-error')).toContainText('incorrect');
    expect((await page.request.get('/api/v1/auth/session')).status()).toBe(401);
  });

  test('publisher login shows the sample-data badge, the user and role; logout ends the session', async ({ page }) => {
    await login(page, PUBLISHER);
    await expect(page.getByTestId('admin-datamode')).toContainText('SAMPLE DATA');
    await expect(page.getByTestId('admin-user-role')).toContainText('Publisher');
    await expect(page.getByTestId('dash-draws-table')).toBeVisible();
    await logoutAndExpectLogin(page);
  });

  test('an editor sees no publisher-only actions and the API refuses a publisher action', async ({ page }) => {
    await login(page, EDITOR);
    await expect(page.getByTestId('admin-user-role')).toContainText('Editor');
    await page.goto('/en/admin/lotteries');
    await expect(page.getByTestId('publisher-only')).toBeVisible();
    await expect(page.getByTestId('add-lottery-form')).toHaveCount(0);
    // Hiding the form is not authorization: the server must refuse as well.
    const status = await page.evaluate(async () => {
      const session = await fetch('/api/v1/auth/session', { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
      const res = await fetch('/api/v1/admin/lotteries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ code: 'E2E_FORBIDDEN', slug: 'e2e-forbidden', name: { en: 'x', ml: 'x' }, active: true }),
      });
      return res.status;
    });
    expect(status).toBe(403);
    await logoutAndExpectLogin(page);
  });
});

test.describe('publisher happy path: draw → import → review → publish → suspend → correct', () => {
  test.describe.configure({ mode: 'serial' });
  const drawCode = `NL-E2E-${Date.now().toString(36).toUpperCase()}`;
  let drawId = '';

  test('create a draw', async ({ page }) => {
    await login(page, PUBLISHER);
    await page.goto('/en/admin/draws');
    await page.getByTestId('new-draw-lottery').selectOption(NILA_LOTTERY_ID);
    await page.getByTestId('new-draw-code').fill(drawCode);
    // Dated before every seeded draw so publishing it never changes which draw the public home page calls "latest".
    await page.getByTestId('new-draw-scheduled').fill('2026-08-27');
    await page.getByTestId('new-draw-submit').click();
    await expect(page.getByTestId('admin-success')).toContainText('Draw created');
    const row = page.getByTestId(`draw-row-${drawCode}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('27 August 2026');
    const href = await row.getByRole('link', { name: 'Public result page' }).getAttribute('href');
    drawId = href?.split('/').pop() ?? '';
    expect(drawId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('a bad import fails validation with row errors and no draft can be created', async ({ page }) => {
    await login(page, PUBLISHER);
    await page.goto('/en/admin/imports');
    await page.getByTestId('import-lottery').selectOption(NILA_LOTTERY_ID);
    await selectOptionContaining(page, 'import-draw', drawCode);
    await expect(page.getByTestId('import-rule')).toHaveValue('1');
    await page.getByTestId('cat-amount-FIRST').fill('1,00,000');
    await page.getByTestId('cat-amount-CONSOLATION').fill('5000');
    await page.getByTestId('cat-amount-LAST4').fill('1000');
    await page.getByTestId('source-kind').selectOption('MANUAL_TRANSCRIPTION');
    await page.getByTestId('source-title').fill('E2E synthetic transcription (bad file)');
    await page.getByTestId('import-format').selectOption('json');
    await page.getByTestId('import-text').fill(
      JSON.stringify([
        { categoryCode: 'FIRST', series: 'AC', number: '000321' },
        { categoryCode: 'CONSOLATION', series: 'AC', number: '000321' },
        { categoryCode: 'LAST4', series: '', number: '0321' },
        { categoryCode: 'LAST4', series: '', number: '0321' },
        { categoryCode: 'LAST4', series: '', number: '77777' },
      ]),
    );
    await page.getByTestId('import-submit').click();
    const preview = page.getByTestId('import-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('data-status', 'VALIDATION_FAILED');
    await expect(preview.getByTestId('preview-error-table')).toBeVisible();
    expect(Number(await preview.getByTestId('preview-errors').textContent())).toBeGreaterThanOrEqual(2);
    await expect(preview.getByTestId('create-draft')).toBeDisabled();
  });

  test('a valid import previews, becomes a draft, is reviewed and published; the public page shows it', async ({ page }) => {
    await login(page, PUBLISHER);
    await page.goto('/en/admin/imports');
    await page.getByTestId('import-lottery').selectOption(NILA_LOTTERY_ID);
    await selectOptionContaining(page, 'import-draw', drawCode);
    await expect(page.getByTestId('import-rule')).toHaveValue('1');
    await page.getByTestId('cat-amount-FIRST').fill('1,00,000');
    await page.getByTestId('cat-amount-CONSOLATION').fill('5000');
    await page.getByTestId('cat-amount-LAST4').fill('1000');
    await page.getByTestId('source-kind').selectOption('MANUAL_TRANSCRIPTION');
    await page.getByTestId('source-title').fill('E2E synthetic transcription');
    await page.getByTestId('import-format').selectOption('json');
    await page.getByTestId('import-text').fill(
      JSON.stringify([
        { categoryCode: 'FIRST', series: 'AC', number: '000321' },
        { categoryCode: 'CONSOLATION', series: 'AC', number: '000321' },
        { categoryCode: 'LAST4', series: '', number: '0321' },
        { categoryCode: 'LAST4', series: '', number: '7777' },
      ]),
    );
    await page.getByTestId('import-submit').click();
    const preview = page.getByTestId('import-preview');
    await expect(preview).toHaveAttribute('data-status', 'PREVIEW_READY');
    await expect(preview.getByTestId('preview-total')).toHaveText('4');
    await expect(preview.getByTestId('preview-rows-table')).toContainText('000321');
    await preview.getByTestId('create-draft').click();

    await expect(page).toHaveURL(/\/en\/admin\/revisions\/[0-9a-f-]{36}$/);
    const header = page.getByTestId('revision-header');
    await expect(header).toHaveAttribute('data-state', 'DRAFT');
    await expect(page.getByTestId('rev-cat-FIRST')).toContainText('1');
    await expect(page.getByTestId('rev-entries-table')).toContainText('000321');

    // Review (self-review confirmation is required because the publisher authored the draft).
    await page.getByTestId('rev-review').click();
    await page.getByTestId('self-review').check();
    await page.getByTestId('review-confirm').click();
    await expect(page.getByTestId('revision-success')).toContainText('reviewed');
    await expect(header).toHaveAttribute('data-state', 'READY');

    // Publish.
    await page.getByTestId('rev-publish').click();
    await expect(page.getByTestId('publish-dialog')).toContainText('first published revision');
    await page.getByTestId('publish-confirm').click();
    await expect(page.getByTestId('revision-success')).toContainText('Published');
    await expect(header).toHaveAttribute('data-state', 'PUBLISHED');
    await expect(page.getByTestId('audit-list')).toContainText(/publish/i);

    // Public page reflects the publication.
    await page.goto(`/en/results/${drawId}`);
    await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
    await expect(ticketWith(page, '000321').first()).toBeVisible();
    await expect(ticketWith(page, '000321').first()).toContainText('AC');
  });

  test('suspend hides the result publicly; resume restores it', async ({ page }) => {
    await login(page, PUBLISHER);
    await page.goto('/en/admin/draws');
    await page.getByTestId(`suspend-${drawCode}`).click();
    await page.getByTestId('draw-dialog-reason').fill('E2E synthetic discrepancy under review');
    await page.getByTestId('draw-dialog-confirm').click();
    await expect(page.getByTestId('admin-success')).toContainText('suspended');

    await page.goto(`/en/results/${drawId}`);
    await expect(page.getByText('Temporarily unavailable').first()).toBeVisible();
    await expect(ticketWith(page, '000321')).toHaveCount(0);

    await page.goto('/en/admin/draws');
    await page.getByTestId(`resume-${drawCode}`).click();
    await page.getByTestId('draw-dialog-reason').fill('E2E synthetic discrepancy resolved');
    await page.getByTestId('draw-dialog-confirm').click();
    await expect(page.getByTestId('admin-success')).toContainText('restored');
    await page.goto(`/en/results/${drawId}`);
    await expect(ticketWith(page, '000321').first()).toBeVisible();
  });

  test('a correction replaces the first prize and is labelled Corrected publicly', async ({ page }) => {
    await login(page, PUBLISHER);
    await page.goto('/en/admin/draws');
    await page.getByTestId(`correction-${drawCode}`).click();
    await page.getByTestId('draw-dialog-reason').fill('E2E synthetic correction: transposed digits');
    await page.getByTestId('draw-dialog').getByTestId('source-kind').selectOption('MANUAL_TRANSCRIPTION');
    await page.getByTestId('draw-dialog').getByTestId('source-title').fill('E2E corrected transcription');
    await page.getByTestId('draw-dialog-confirm').click();

    await expect(page).toHaveURL(/\/en\/admin\/revisions\/[0-9a-f-]{36}$/);
    const header = page.getByTestId('revision-header');
    await expect(header).toHaveAttribute('data-state', 'DRAFT');
    await expect(header).toContainText('Correction');

    await page.getByTestId('rev-edit').click();
    await page.getByTestId('replace-FIRST').fill('AC 000322');
    await page.getByTestId('replace-CONSOLATION').fill('AC 000322');
    await page.getByTestId('rev-edit-save').click();
    await expect(page.getByTestId('revision-success')).toContainText('Draft updated');
    await page.getByTestId('entries-category').selectOption('FIRST');
    await expect(page.getByTestId('rev-entries-table')).toContainText('000322');

    await page.getByTestId('rev-review').click();
    await page.getByTestId('self-review').check();
    await page.getByTestId('review-confirm').click();
    await expect(header).toHaveAttribute('data-state', 'READY');
    await page.getByTestId('rev-publish').click();
    await expect(page.getByTestId('publish-dialog')).toContainText('Will supersede current revision');
    await page.getByTestId('publish-confirm').click();
    await expect(header).toHaveAttribute('data-state', 'PUBLISHED');

    await page.goto(`/en/results/${drawId}`);
    await expect(ticketWith(page, '000322').first()).toBeVisible();
    await expect(page.getByText('Corrected', { exact: true }).first()).toBeVisible();
    await expect(ticketWith(page, '000321')).toHaveCount(0);
  });
});
