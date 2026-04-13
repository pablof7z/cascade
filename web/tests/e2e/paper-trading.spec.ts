import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const SIGNET_TOPUP_SINGLE_LIMIT_MINOR = 10_000;

function formatUsdMinor(amountMinor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueMarket(prefix: string): { title: string; slug: string } {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const title = `${prefix} ${suffix}`;
  return { title, slug: slugify(title) };
}

function secretKeyFor(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

async function waitForUserMenu(page: Page) {
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function ensureLoggedIn(page: Page, secretKey: string) {
  const userMenu = page.getByRole('button', { name: 'Open account menu' });
  if (await userMenu.isVisible().catch(() => false)) {
    return;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await userMenu.isVisible().catch(() => false)) {
      return;
    }

    await page.waitForTimeout(500);
  }

  const loginButton = page.getByRole('button', { name: 'Log in' });
  try {
    await loginButton.click();
  } catch (error) {
    if (await userMenu.isVisible().catch(() => false)) {
      return;
    }
    throw error;
  }
  const loginDialog = page.getByRole('dialog', { name: 'Log in' });
  await loginDialog.getByRole('tab', { name: 'Secret key' }).click();
  await loginDialog
    .getByRole('textbox', { name: /Account key|Secret key/i })
    .fill(secretKey);
  await loginDialog.getByRole('button', { name: 'Continue with key' }).click();
  await waitForUserMenu(page);
}

async function loginWithPrivateKey(page: Page, secretKey: string) {
  await page.goto('/portfolio');
  await ensureLoggedIn(page, secretKey);
}

async function fundPortfolio(page: Page, secretKey: string, amountMinor: number) {
  await page.goto('/portfolio');
  await ensureLoggedIn(page, secretKey);
  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();

  let remainingMinor = amountMinor;
  let fundedMinor = 0;
  const localProofsPanel = page.locator('.wallet-grid .wallet-panel').first();

  while (remainingMinor > 0) {
    const chunkMinor = Math.min(remainingMinor, SIGNET_TOPUP_SINGLE_LIMIT_MINOR);
    await page.getByRole('spinbutton', { name: 'Funding amount' }).fill(String(chunkMinor));
    await page.getByRole('button', { name: 'Create Lightning invoice' }).click();
    await expect(
      page.locator('.history-row').filter({ hasText: `lightning · invoice_pending` }).first()
    ).toBeVisible();
    fundedMinor += chunkMinor;
    await expect
      .poll(
        async () =>
          (await localProofsPanel.textContent())?.includes(formatUsdMinor(fundedMinor)) ?? false,
        { timeout: 45_000 }
      )
      .toBe(true);
    remainingMinor -= chunkMinor;
  }
}

async function completeBuilderDraft(
  page: Page,
  secretKey: string,
  market: { title: string; slug: string },
  seedMinor: number
) {
  await page.goto('/builder');
  await ensureLoggedIn(page, secretKey);

  await page.getByPlaceholder('Market title').fill(market.title);
  await page
    .getByPlaceholder('What is this market tracking, and why should someone care?')
    .fill(`Created by Playwright for ${market.title}.`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page
    .getByPlaceholder('Lay out the logic, the evidence, and the path you expect reality to take.')
    .fill(`This market exists to verify the signet paper-trading flow for ${market.title}.`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('spinbutton', { name: 'Seed spend' }).fill(String(seedMinor));
}

async function createPublicMarket(
  page: Page,
  secretKey: string,
  market: { title: string; slug: string },
  seedMinor: number
) {
  await completeBuilderDraft(page, secretKey, market, seedMinor);
  await page.getByRole('button', { name: 'Create Market' }).click();
  await page.waitForURL(new RegExp(`/market/${market.slug}$`));
  await expect(page.getByRole('heading', { name: market.title })).toBeVisible();
}

function pendingMarketRow(page: Page, title: string): Locator {
  return page.locator('.builder-selected-row').filter({ hasText: title });
}

test('pending markets stay private until the first mint trade, then become public after seeding', async ({
  page
}) => {
  const market = uniqueMarket('Pending paper market');
  const creatorSecret = secretKeyFor(`pending:${market.title}`);

  await loginWithPrivateKey(page, creatorSecret);
  await completeBuilderDraft(page, creatorSecret, market, 10_000);
  await page.getByRole('button', { name: 'Create Market' }).click();

  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByText(/Market is pending\. Fund your signet portfolio/)).toBeVisible();
  await expect(pendingMarketRow(page, market.title)).toContainText('Pending');

  const privateMarketResponse = await fetch(`${BASE_URL}/market/${market.slug}`);
  expect(privateMarketResponse.status).toBe(404);

  await fundPortfolio(page, creatorSecret, 10_000);

  await page.goto('/builder');
  await ensureLoggedIn(page, creatorSecret);
  const row = pendingMarketRow(page, market.title);
  await expect(row).toContainText('Pending');
  await row.getByRole('button', { name: 'Seed now' }).click();

  const builderStatus = page.getByText('Market seeded and now public.');
  const builderRow = pendingMarketRow(page, market.title);
  const marketHeading = page.getByRole('heading', { name: market.title });

  await Promise.race([
    expect(page).toHaveURL(new RegExp(`/market/${market.slug}$`)),
    expect(builderStatus).toBeVisible()
  ]);

  const onMarketPage =
    (await page.url()).endsWith(`/market/${market.slug}`) ||
    (await marketHeading.isVisible().catch(() => false));

  if (onMarketPage) {
    await expect(marketHeading).toBeVisible();
    return;
  }

  await expect(builderStatus).toBeVisible();
  await expect(builderRow).toContainText('Public');

  await expect
    .poll(
      async () => {
        const response = await fetch(`${BASE_URL}/market/${market.slug}`);
        return response.status;
      },
      {
        timeout: 30_000
      }
    )
    .toBe(200);

  const marketPage = await page.context().newPage();
  await marketPage.goto(`${BASE_URL}/market/${market.slug}`, { waitUntil: 'domcontentloaded' });
  await expect(marketPage.getByRole('heading', { name: market.title })).toBeVisible();
  await marketPage.close();
});

test('funded portfolio users can create a market, buy the other side, and withdraw part of the position', async ({
  page
}) => {
  const market = uniqueMarket('Public paper market');
  const creatorSecret = secretKeyFor(`public:${market.title}`);

  await loginWithPrivateKey(page, creatorSecret);
  await fundPortfolio(page, creatorSecret, 15_000);
  await createPublicMarket(page, creatorSecret, market, 10_000);

  const tradePanel = page.locator('.trade-panel');
  await expect(tradePanel.getByText('Available')).toBeVisible();

  await tradePanel.getByRole('button', { name: /^SHORT / }).click();
  await expect(tradePanel.getByRole('button', { name: 'Mint SHORT' })).toBeVisible();
  await tradePanel.locator('input[type="number"]').first().fill('2500');
  await tradePanel.getByRole('button', { name: 'Mint SHORT' }).click();
  await expect(tradePanel.getByText(`Bought NO on ${market.slug}.`)).toBeVisible();

  const rewroteBuyReceipt = await page.evaluate(() => {
    const receiptKey = Object.keys(localStorage).find((key) => key.includes('cascade_trade_receipts'));
    if (!receiptKey) return false;
    const raw = localStorage.getItem(receiptKey);
    if (!raw) return false;

    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    let rewrittenAny = false;
    const rewritten = records.map((record) => {
      if (record.action !== 'buy') return record;
      rewrittenAny = true;

      return {
        ...record,
        id: `missing-request-${Date.now()}`,
        tradeId: undefined
      };
    });

    localStorage.setItem(receiptKey, JSON.stringify(rewritten));
    return rewrittenAny;
  });

  await page.reload();
  await ensureLoggedIn(page, creatorSecret);
  if (rewroteBuyReceipt) {
    await expect(page.getByText(`Recovered buy on ${market.slug}.`)).toBeVisible();
  } else {
    await expect(tradePanel.getByText('Available')).toBeVisible();
  }

  await tradePanel.getByRole('button', { name: /SHORT/ }).click();
  await tradePanel.locator('input[type="number"]').nth(1).fill('10');
  const withdrawButton = tradePanel.getByRole('button', { name: /^Withdraw / });
  await expect(withdrawButton).toBeEnabled();
  await withdrawButton.click();
  await expect(tradePanel.getByText(/Withdrew (YES|NO) on/)).toContainText(market.slug);

  await page.goto('/portfolio');
  await ensureLoggedIn(page, creatorSecret);
  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();
  const tradedPositionRow = page.locator('.position-row').filter({ hasText: market.title }).first();
  await expect(tradedPositionRow).toBeVisible();
  await expect(tradedPositionRow.getByText('Mark only')).toHaveCount(0);

  const marketDetailPattern = `**/api/product/markets/slug/${market.slug}`;
  await page.route(marketDetailPattern, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'market_detail_unavailable' })
    });
  });

  await page.reload();
  await ensureLoggedIn(page, creatorSecret);
  const unavailablePriceRow = page
    .locator('.position-row')
    .filter({ hasText: market.title })
    .filter({ hasText: 'SHORT' })
    .first();
  await expect(unavailablePriceRow).toBeVisible();
  await expect(unavailablePriceRow.getByText('Price unavailable')).toBeVisible();
  await expect(unavailablePriceRow.getByText('Mark only')).toBeVisible();
  await page.unroute(marketDetailPattern);

  const injectedLocalPosition = await page.evaluate(({ slug }) => {
    const usdKey = Object.keys(localStorage).find(
      (key) => key.startsWith('cascade:proof-wallet:') && key.endsWith(':usd')
    );
    if (!usdKey) return false;

    localStorage.setItem(
      usdKey.replace(/:usd$/, `:LONG_${slug}`),
      JSON.stringify({
        version: 1,
        mintUrl: usdKey.slice('cascade:proof-wallet:'.length, -':usd'.length),
        unit: `LONG_${slug}`,
        proofs: [
          { id: 'local-test', amount: 60_000, secret: `proof-${slug}-1`, C: `c-${slug}-1` },
          { id: 'local-test', amount: 40_000, secret: `proof-${slug}-2`, C: `c-${slug}-2` }
        ],
        updatedAt: Date.now()
      })
    );

    return true;
  }, { slug: market.slug });

  expect(injectedLocalPosition).toBe(true);

  await page.reload();
  await ensureLoggedIn(page, creatorSecret);
  await expect(
    page.getByText(
      'Derived from local market-proof holdings, the browser-local trade book, and current public market prices.'
    )
  ).toBeVisible();

  const migratedLocalPosition = await page.evaluate(({ slug }) => {
    const upperKey = Object.keys(localStorage).find((key) => key.endsWith(`:LONG_${slug}`));
    const lowerKey = Object.keys(localStorage).find((key) => key.endsWith(`:long_${slug}`));
    const lowerRaw = lowerKey ? localStorage.getItem(lowerKey) : null;
    const lowerWallet = lowerRaw
      ? (JSON.parse(lowerRaw) as {
          proofs?: Array<{ secret?: string; amount?: number }>;
        })
      : null;

    return {
      hasUpperKey: Boolean(upperKey),
      hasLowerKey: Boolean(lowerKey),
      containsInjectedProofs: Boolean(
        lowerWallet?.proofs?.some((proof) => proof.secret === `proof-${slug}-1`) &&
          lowerWallet?.proofs?.some((proof) => proof.secret === `proof-${slug}-2`)
      ),
      totalAmount: lowerWallet?.proofs?.reduce((sum, proof) => sum + (proof.amount ?? 0), 0) ?? 0
    };
  }, { slug: market.slug });

  expect(migratedLocalPosition.hasUpperKey).toBe(false);
  expect(migratedLocalPosition.hasLowerKey).toBe(true);
  expect(migratedLocalPosition.containsInjectedProofs).toBe(true);
  expect(migratedLocalPosition.totalAmount).toBeGreaterThanOrEqual(100_000);

  const localPositionRow = page
    .locator('.position-row')
    .filter({ hasText: market.title })
    .filter({ hasText: 'LONG' })
    .first();
  await expect(localPositionRow).toBeVisible();
  await expect(localPositionRow.getByText('Mark only')).toBeVisible();
});

test('portfolio can export and import local USD proofs', async ({ page }) => {
  const secret = secretKeyFor(`portfolio-export:${Date.now()}`);

  await loginWithPrivateKey(page, secret);
  await fundPortfolio(page, secret, 10_000);

  await page.goto('/portfolio');
  await ensureLoggedIn(page, secret);
  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare token' }).click();

  const exportedToken = page.getByRole('textbox', { name: 'Exported token' });
  await expect(exportedToken).toHaveValue(/cashu/i);
  const tokenValue = await exportedToken.inputValue();

  await page.evaluate(() => {
    const usdKey = Object.keys(localStorage).find(
      (key) => key.startsWith('cascade:proof-wallet:') && key.endsWith(':usd')
    );
    if (usdKey) {
      localStorage.removeItem(usdKey);
    }
  });

  await page.reload();
  await ensureLoggedIn(page, secret);
  const walletPanels = page.locator('.wallet-grid .wallet-panel');
  await expect(walletPanels.first()).toContainText('$0.00');

  await page.getByRole('textbox', { name: 'Import token' }).fill(tokenValue);
  await page.getByRole('button', { name: 'Import token' }).click();
  await expect(page.getByText(`Imported ${formatUsdMinor(10_000)} into this browser.`)).toBeVisible();
  await expect(walletPanels.first()).toContainText('$100.00');
});

test('signet portfolio can fund through the Lightning top-up flow', async ({ page }) => {
  const secret = secretKeyFor(`lightning-wallet:${Date.now()}`);

  await loginWithPrivateKey(page, secret);
  await page.goto('/portfolio');
  await ensureLoggedIn(page, secret);
  await expect(page.getByRole('heading', { name: 'Browser-local proof portfolio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Lightning invoice' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Funding amount' }).fill('2500');
  await page.getByRole('button', { name: 'Create Lightning invoice' }).click();
  await expect(
    page.locator('.history-row').filter({ hasText: `lightning · invoice_pending` }).first()
  ).toBeVisible();
  const localProofsPanel = page.locator('.wallet-grid .wallet-panel').first();
  await expect
    .poll(
      async () =>
        (await localProofsPanel.textContent())?.includes(formatUsdMinor(2500)) ?? false,
      { timeout: 45_000 }
    )
    .toBe(true);

  await page.goto('/portfolio');
  await ensureLoggedIn(page, secret);
  const walletPanels = page.locator('.wallet-grid .wallet-panel');
  await expect(walletPanels.first()).toContainText('Local Proofs');
  await expect(walletPanels.first()).toContainText('$25.00');
  await expect(page.locator('.history-row').filter({ hasText: 'lightning · complete' }).first()).toBeVisible();
  await expect(page.getByText('No pending top-ups.')).toBeVisible();
});
