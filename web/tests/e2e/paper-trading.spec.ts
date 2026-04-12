import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const PAPER_FAUCET_SINGLE_TOPUP_LIMIT_MINOR = 10_000;

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
  await page.goto('/wallet');
  await ensureLoggedIn(page, secretKey);
}

async function fundPaperWallet(page: Page, secretKey: string, amountMinor: number) {
  await page.goto('/wallet');
  await ensureLoggedIn(page, secretKey);
  await expect(page.getByRole('heading', { name: 'Paper wallet' })).toBeVisible();

  let remainingMinor = amountMinor;

  while (remainingMinor > 0) {
    const chunkMinor = Math.min(remainingMinor, PAPER_FAUCET_SINGLE_TOPUP_LIMIT_MINOR);
    await page.getByRole('spinbutton', { name: 'Paper amount' }).fill(String(chunkMinor));
    await page.getByRole('button', { name: 'Add funds' }).click();
    await expect(page.getByText(`Added ${formatUsdMinor(chunkMinor)} to your paper wallet.`)).toBeVisible();
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
  await expect(
    page.getByText('Market is pending. Fund your paper wallet, then seed the market from this page.')
  ).toBeVisible();
  await expect(pendingMarketRow(page, market.title)).toContainText('Pending');

  const privateMarketResponse = await fetch(`${BASE_URL}/market/${market.slug}`);
  expect(privateMarketResponse.status).toBe(404);

  await fundPaperWallet(page, creatorSecret, 10_000);

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

test('funded users can create a market, buy the other side, and withdraw part of the position', async ({
  page
}) => {
  const market = uniqueMarket('Public paper market');
  const creatorSecret = secretKeyFor(`public:${market.title}`);

  await loginWithPrivateKey(page, creatorSecret);
  await fundPaperWallet(page, creatorSecret, 15_000);
  await createPublicMarket(page, creatorSecret, market, 10_000);

  const tradePanel = page.locator('.trade-panel');
  await expect(tradePanel.getByText('Available')).toBeVisible();

  await tradePanel.getByRole('button', { name: /NO/ }).click();
  await tradePanel.locator('input[type="number"]').first().fill('2500');
  await tradePanel.getByRole('button', { name: 'Buy NO' }).click();
  await expect(tradePanel.getByText(`Bought NO on ${market.slug}.`)).toBeVisible();

  await page.evaluate(() => {
    const receiptKey = Object.keys(localStorage).find((key) => key.includes('cascade_trade_receipts'));
    if (!receiptKey) return;
    const raw = localStorage.getItem(receiptKey);
    if (!raw) return;

    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    const rewritten = records.map((record) => {
      if (record.action !== 'buy') return record;

      return {
        ...record,
        id: `missing-request-${Date.now()}`,
        tradeId: undefined
      };
    });

    localStorage.setItem(receiptKey, JSON.stringify(rewritten));
  });

  await page.reload();
  await ensureLoggedIn(page, creatorSecret);
  await expect(page.getByText(`Recovered buy on ${market.slug}.`)).toBeVisible();

  await tradePanel.locator('input[type="number"]').nth(1).fill('10');
  await tradePanel.getByRole('button', { name: 'Withdraw NO' }).click();
  await expect(tradePanel.getByText(`Withdrew NO on ${market.slug}.`)).toBeVisible();

  await page.goto('/wallet');
  await ensureLoggedIn(page, creatorSecret);
  await expect(page.getByRole('heading', { name: 'Paper wallet' })).toBeVisible();
  await expect(page.locator('.position-row').filter({ hasText: market.title }).first()).toBeVisible();
});

test('signet wallet can fund through the Lightning top-up flow', async ({ page }) => {
  const secret = secretKeyFor(`lightning-wallet:${Date.now()}`);

  await loginWithPrivateKey(page, secret);
  await page.goto('/wallet');
  await ensureLoggedIn(page, secret);
  await expect(page.getByRole('heading', { name: 'Paper wallet' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Lightning amount' }).fill('2500');
  await page.getByRole('button', { name: 'Create Lightning invoice' }).click();
  await expect(page.getByText(`Created a Lightning top-up for ${formatUsdMinor(2500)}.`)).toBeVisible();
  await page.evaluate(() => {
    const pendingKey = Object.keys(localStorage).find((key) => key.includes('cascade_pending_topups'));
    if (!pendingKey) return;
    const raw = localStorage.getItem(pendingKey);
    if (!raw) return;

    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    const rewritten = records.map((record) => {
      if (!record.requestId || !record.topupId) return record;
      const nextRecord = { ...record };
      delete nextRecord.topupId;
      return nextRecord;
    });

    localStorage.setItem(pendingKey, JSON.stringify(rewritten));
  });

  await page.reload();
  await ensureLoggedIn(page, secret);
  await expect(
    page.getByText(`Recovered pending Lightning top-up for ${formatUsdMinor(2500)}.`)
  ).toBeVisible();
  await page.getByRole('button', { name: 'Complete locally for signet' }).click();
  await expect(
    page.getByText(`Completed the signet Lightning top-up for ${formatUsdMinor(2500)}.`)
  ).toBeVisible();

  await page.goto('/wallet');
  await ensureLoggedIn(page, secret);
  const walletPanels = page.locator('.wallet-grid .wallet-panel');
  await expect(walletPanels.first()).toContainText('Available');
  await expect(walletPanels.first()).toContainText('$25.00');
  await expect(page.locator('.history-row').filter({ hasText: 'lightning · complete' }).first()).toBeVisible();
});
