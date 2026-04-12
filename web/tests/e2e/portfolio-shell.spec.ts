import { expect, test } from '@playwright/test';

test('portfolio is the canonical proof-custody surface', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/portfolio$/);

  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();
  await expect(
    page.getByText(/Portfolio proofs are stored in this browser in both signet and mainnet\./)
  ).toBeVisible();
});

test('portfolio disables funding when the backend edition mismatches the frontend edition', async ({
  page
}) => {
  test.skip(
    process.env.PLAYWRIGHT_EXPECTS_EDITION_MISMATCH !== 'true',
    'edition-mismatch coverage only runs against the dedicated mainnet->signet harness'
  );

  await page.goto('/portfolio');

  await expect(page.getByText(/pointed at a signet mint/i)).toBeVisible();
});
