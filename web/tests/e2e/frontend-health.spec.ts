import { expect, test, type Page } from '@playwright/test';

async function gotoFirstMarket(page: Page) {
  await page.goto('/');
  const hrefs = (await page
    .locator('main a[href^="/market/"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).filter(Boolean))) as string[];

  if (!hrefs.length) {
    throw new Error('Expected at least one market link on the home page.');
  }

  for (const href of hrefs) {
    await page.goto(href);
    if (await page.getByRole('heading', { name: 'Page not found.' }).count()) {
      continue;
    }
    return;
  }

  throw new Error('Expected at least one market link to resolve to a live market page.');
}

test('market detail uses take-a-position CTA for new traders', async ({ page }) => {
  await gotoFirstMarket(page);

  await expect(page.getByRole('link', { name: 'Take a position' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trade this market' })).toHaveCount(0);
});

test('market detail keeps trading units in USD product terms', async ({ page }) => {
  await gotoFirstMarket(page);

  await expect(page.getByText(/sats/i)).toHaveCount(0);
  await expect(page.getByText(/tokens/i)).toHaveCount(0);
  await expect(page.getByText(/\$\d[\d,]*\.\d{2}/).first()).toBeVisible();
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

test('market builder hides mint routing details from the public form', async ({ page }) => {
  await page.goto('/builder');

  await page.getByPlaceholder('Market title').fill('Will mint routing stay hidden?');
  await page
    .getByPlaceholder('What is this market tracking, and why should someone care?')
    .fill('This check makes sure market creators are not asked for mint infrastructure details.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page
    .getByPlaceholder('Lay out the logic, the evidence, and the path you expect reality to take.')
    .fill('The market builder should focus on the claim and the case, not mint wiring.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Mint URL')).toHaveCount(0);
  await expect(page.getByText('Mint Pubkey')).toHaveCount(0);
  await expect(page.getByPlaceholder('https://mint.example.com')).toHaveCount(0);
  await expect(page.getByPlaceholder('Optional')).toHaveCount(0);
});
