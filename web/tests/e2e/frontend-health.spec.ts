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

test('portfolio signed-out state uses friendly connection copy', async ({ page }) => {
  await page.goto('/portfolio');

  const mainText = await page.locator('main').innerText();
  expect(mainText).toContain('Connect to view your portfolio');
  expect(mainText).not.toContain('Debug:');
  expect(mainText).not.toMatch(/[0-9a-f]{32,}/i);
});

test('market detail leads with a trading section before the editorial case', async ({ page }) => {
  await gotoFirstMarket(page);

  const headings = await page.locator('main h2, main h3').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? '')
  );
  const tradeIndex = headings.indexOf('Take a position');
  const caseIndex = headings.indexOf('Market case');

  expect(tradeIndex).toBeGreaterThan(-1);
  expect(caseIndex).toBeGreaterThan(-1);
  expect(tradeIndex).toBeLessThan(caseIndex);
});

test('home page labels volume-ranked markets as Most Active', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Most Active' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trending' })).toHaveCount(0);
});
