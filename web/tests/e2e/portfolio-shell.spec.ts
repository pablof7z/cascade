import { expect, test } from '@playwright/test';

test('portfolio is the canonical proof-custody surface', async ({ page }) => {
  const response = await page.goto('/wallet');

  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/wallet$/);
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
