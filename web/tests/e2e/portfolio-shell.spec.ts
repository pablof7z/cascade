import { expect, test } from '@playwright/test';

test('portfolio is the canonical proof-custody surface', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/portfolio$/);

  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();
  await expect(
    page.getByText(/Portfolio proofs are stored in this browser in both signet and mainnet\./)
  ).toBeVisible();
});
