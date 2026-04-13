import { expect, test, type Page } from '@playwright/test';

async function gotoFirstMarket(page: Page) {
  await page.goto('/');
  const href = await page.locator('main a[href^="/market/"]').first().getAttribute('href');
  if (!href) {
    throw new Error('Expected at least one market link on the home page.');
  }
  await page.goto(href);
}

test('market detail uses take-a-position CTA for new traders', async ({ page }) => {
  await gotoFirstMarket(page);

  await expect(page.getByRole('link', { name: 'Take a position' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trade this market' })).toHaveCount(0);
});

test('market detail keeps trading units in Cashu token terms', async ({ page }) => {
  await gotoFirstMarket(page);

  await expect(page.getByText(/sats/i)).toHaveCount(0);
  await expect(page.getByText(/tokens/i).first()).toBeVisible();
});
