/**
 * M9 Browser Smoke Tests — Signet Paper-Trading Flow
 *
 * These tests verify the end-to-end signet paper-trading flow:
 *   1. Live/Practice edition toggle (via cookie)
 *   2. Login + fund the practice portfolio
 *   3. Create a market
 *   4. Place trades (buy LONG, buy SHORT)
 *   5. Withdraw a position
 *   6. Portfolio reflects changes
 *
 * Prerequisites:
 *   - Server running at PLAYWRIGHT_BASE_URL (default http://127.0.0.1:4173)
 *   - Signet mint reachable at PUBLIC_CASCADE_SIGNET_MINT_URL
 *
 * Known issue: The EditionSwitch sets the edition cookie with the `Secure`
 * flag in production builds, so browsers won't send it over plain HTTP.
 * Both the toggle click and ?edition= URL parameter are broken for this
 * reason (see active "Live/Practice Toggle Bug" conversation). All tests
 * work around this by setting the cookie directly before navigation.
 */

import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const SIGNET_TOPUP_SINGLE_LIMIT_MINOR = 10_000;

/* ── helpers ────────────────────────────────────────────────────────── */

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

/* ── edition cookie ────────────────────────────────────────────────── */

async function setSignetCookie(page: Page) {
  // Workaround for Secure-flag bug: the production build sets Secure on the
  // cascade_edition cookie, so browsers won't send it over plain HTTP.
  await page.context().addCookies([
    {
      name: 'cascade_edition',
      value: 'signet',
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Lax'
    }
  ]);
}

/* ── auth helpers ────────────────────────────────────────────────────── */

async function waitForUserMenu(page: Page) {
  await expect
    .poll(
      async () =>
        await page
          .getByRole('button', { name: 'Open account menu' })
          .isVisible()
          .catch(() => false),
      { timeout: 20_000 }
    )
    .toBe(true);
}

async function waitForPersistedSession(page: Page) {
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const raw = localStorage.getItem('ndk-sveltekit-template:sessions');
          if (!raw) return false;

          try {
            const parsed = JSON.parse(raw) as { activePubkey?: unknown };
            return typeof parsed.activePubkey === 'string' && parsed.activePubkey.length > 0;
          } catch {
            return false;
          }
        }),
      { timeout: 20_000 }
    )
    .toBe(true);
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

  const returnUrl = page.url();
  await page.goto('/join');
  await page.waitForTimeout(2500);
  if (await userMenu.isVisible().catch(() => false)) {
    if (page.url() !== returnUrl) {
      await page.goto(returnUrl);
    }
    return;
  }

  await page.getByRole('tab', { name: /Recovery key|Account key/ }).click();
  const accountKeyInput = page.getByPlaceholder(/Paste your (recovery|account) key/i);
  await expect(accountKeyInput).toBeVisible();
  await accountKeyInput.fill(secretKey);
  const continueWithKey = page.getByRole('button', { name: /Continue with (recovery key|key)/i });
  await expect(continueWithKey).toBeEnabled();
  await continueWithKey.click();

  await waitForPersistedSession(page);
  if (page.url() !== returnUrl) {
    await page.goto(returnUrl);
  }
  await waitForUserMenu(page);
}

async function loginWithPrivateKey(page: Page, secretKey: string) {
  await setSignetCookie(page);
  await page.goto('/portfolio');
  await ensureLoggedIn(page, secretKey);
}

/* ── portfolio funding ─────────────────────────────────────────────── */

async function fundPortfolio(page: Page, secretKey: string, amountMinor: number) {
  await page.goto('/portfolio');
  await ensureLoggedIn(page, secretKey);
  await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible();

  let remainingMinor = amountMinor;
  let fundedMinor = 0;
  const localProofsPanel = page.locator('.wallet-grid .wallet-panel').first();

  while (remainingMinor > 0) {
    const chunkMinor = Math.min(remainingMinor, SIGNET_TOPUP_SINGLE_LIMIT_MINOR);
    await page.getByRole('spinbutton', { name: 'Amount' }).fill(String(chunkMinor));
    await page.getByRole('button', { name: /Add funds with Lightning|Create Lightning invoice/ }).click();
    await expect(
      page
        .locator('.history-row')
        .filter({ hasText: /Lightning · Waiting for payment|lightning · invoice_pending/ })
        .first()
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

/* ── market creation ────────────────────────────────────────────────── */

async function completeBuilderDraft(
  page: Page,
  secretKey: string,
  market: { title: string; slug: string },
  seedMinor: number
) {
  await page.goto('/builder');
  await ensureLoggedIn(page, secretKey);

  // Step 1: Claim
  await page.getByPlaceholder('Market title').fill(market.title);
  await page
    .getByPlaceholder('What is this market tracking, and why should someone care?')
    .fill(`Created by M9 smoke test for ${market.title}.`);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: Case
  await page
    .getByPlaceholder('Lay out the logic, the evidence, and the path you expect reality to take.')
    .fill(`This market exists to verify the signet paper-trading flow for ${market.title}.`);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: Links — just continue
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: Review — fill initial funding (only visible in signet/Practice mode)
  await page.getByLabel('Initial funding').fill(String(seedMinor));
}

async function waitForMarketRoute(page: Page, slug: string, timeoutMs: number): Promise<boolean> {
  const destination = `/market/${slug}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await page.request.get(destination);
      if (response.ok()) return true;
    } catch {}

    await page.waitForTimeout(3000);
  }

  return false;
}

async function createPublicMarket(
  page: Page,
  secretKey: string,
  market: { title: string; slug: string },
  seedMinor: number
) {
  await completeBuilderDraft(page, secretKey, market, seedMinor);
  await page.getByRole('button', { name: 'Create Market' }).click();

  // In signet mode, the builder auto-seeds if the portfolio has enough funds,
  // then polls /market/{slug} until the relay has the trade, and navigates.
  // Wait for either: auto-navigation to the market page, or a "Pending" status.
  const marketUrl = `/market/${market.slug}`;
  try {
    await page.waitForURL(new RegExp(`${marketUrl}$`), { timeout: 90_000 });
  } catch {
    // If auto-navigation didn't happen, the market may be in "Pending" state
    // (portfolio didn't have enough funds). Try to seed manually.
    const seedButton = page.getByRole('button', { name: 'Seed now' });
    if (await seedButton.isVisible().catch(() => false)) {
      await seedButton.click();
    }

    // Poll until the market is available on the relay
    const marketReady = await waitForMarketRoute(page, market.slug, 60_000);
    if (!marketReady) {
      throw new Error(`Market /market/${market.slug} never became available on relays`);
    }

    await page.goto(marketUrl);
  }

  await expect(page.getByRole('heading', { name: market.title })).toBeVisible({ timeout: 30_000 });
}

/* ── shared state across serial tests ──────────────────────────────── */

const market = uniqueMarket('M9 Smoke market');
const creatorSecret = secretKeyFor(`m9-smoke:${market.title}`);
let sharedPage: Page;

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Edition toggle: Live ↔ Practice
 * ═══════════════════════════════════════════════════════════════════════ */

test('switches between Live and Practice editions via cookie', async ({ page }) => {
  // BUG: The EditionSwitch sets the edition cookie with the `Secure` flag
  // in production builds, so browsers won't send it over plain HTTP.
  // Both the toggle click and ?edition= URL parameter are broken for this
  // reason. See the active "Live/Practice Toggle Bug" conversation.
  //
  // This test verifies that the *server* correctly reads the edition cookie
  // by setting it directly (without Secure flag) and checking the rendered
  // state.

  // 1. Set signet cookie BEFORE any navigation, then load the page
  await setSignetCookie(page);
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'Practice' })).toBeChecked({ timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Live' })).not.toBeChecked();

  // 2. Set mainnet cookie and reload
  await page.context().addCookies([
    {
      name: 'cascade_edition',
      value: 'mainnet',
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Lax'
    }
  ]);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Live' })).toBeChecked({ timeout: 10_000 });
  await expect(page.getByRole('radio', { name: 'Practice' })).not.toBeChecked();
});

/* ═══════════════════════════════════════════════════════════════════════
 * Tests 2-6: share a single browser page so localStorage (cashu funds)
 * persists across the fund → create → trade → withdraw → portfolio flow.
 * ═══════════════════════════════════════════════════════════════════════ */

test.describe('funded smoke flow', () => {
  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  /* ═════════════════════════════════════════════════════════════════════
   * 2. Login + fund the portfolio (signet)
   * ═════════════════════════════════════════════════════════════════════ */

  test('logs in and funds the practice portfolio', async () => {
    await loginWithPrivateKey(sharedPage, creatorSecret);
    await fundPortfolio(sharedPage, creatorSecret, 25_000);
    // Verify balance on portfolio page
    await sharedPage.goto('/portfolio');
    await ensureLoggedIn(sharedPage, creatorSecret);
    const walletPanel = sharedPage.locator('.wallet-grid .wallet-panel').first();
    await expect(walletPanel).toContainText('$250.00');
  });

  /* ═════════════════════════════════════════════════════════════════════
   * 3. Create a market
   * ═════════════════════════════════════════════════════════════════════ */

  test('creates a market on signet', async () => {
    await loginWithPrivateKey(sharedPage, creatorSecret);
    await createPublicMarket(sharedPage, creatorSecret, market, 10_000);
  });

  /* ═════════════════════════════════════════════════════════════════════
   * 4. Place trades: buy LONG, buy SHORT
   * ═════════════════════════════════════════════════════════════════════ */

  test('buys LONG and SHORT positions on the market', async () => {
    await loginWithPrivateKey(sharedPage, creatorSecret);
    await sharedPage.goto(`/market/${market.slug}`);
    await ensureLoggedIn(sharedPage, creatorSecret);
    await expect(sharedPage.getByRole('heading', { name: market.title })).toBeVisible({ timeout: 30_000 });

    const tradePanel = sharedPage.locator('.trade-panel');
    await expect(tradePanel.getByText('Available')).toBeVisible();

    // Buy SHORT
    await tradePanel.getByRole('button', { name: /^SHORT / }).click();
    await expect(tradePanel.getByRole('button', { name: 'Mint SHORT' })).toBeVisible();
    await tradePanel.locator('input[type="number"]').first().fill('2500');
    await tradePanel.getByRole('button', { name: 'Mint SHORT' }).click();
    await expect(tradePanel.getByText(`Bought SHORT on ${market.slug}.`)).toBeVisible({ timeout: 30_000 });

    // Switch back to mint mode (auto-switched to exit after buy) then buy LONG
    await tradePanel.getByRole('button', { name: 'Mint LONG/SHORT' }).click();
    await tradePanel.getByRole('button', { name: /^LONG / }).click();
    await expect(tradePanel.getByRole('button', { name: 'Mint LONG' })).toBeVisible();
    await tradePanel.locator('input[type="number"]').first().fill('2500');
    await tradePanel.getByRole('button', { name: 'Mint LONG' }).click();
    await expect(tradePanel.getByText(`Bought LONG on ${market.slug}.`)).toBeVisible({ timeout: 30_000 });
  });

  /* ═════════════════════════════════════════════════════════════════════
   * 5. Withdraw a position
   * ═════════════════════════════════════════════════════════════════════ */

  test('withdraws (sells) part of a SHORT position', async () => {
    await loginWithPrivateKey(sharedPage, creatorSecret);
    await sharedPage.goto(`/market/${market.slug}`);
    await ensureLoggedIn(sharedPage, creatorSecret);
    await expect(sharedPage.getByRole('heading', { name: market.title })).toBeVisible({ timeout: 30_000 });

    const tradePanel = sharedPage.locator('.trade-panel');
    await expect(tradePanel.getByText('Available')).toBeVisible();

    // Select SHORT side in mint mode so exit mode shows the SHORT position
    await tradePanel.getByRole('button', { name: /^SHORT / }).click();
    // Switch to exit mode
    await tradePanel.getByRole('button', { name: 'Exit position' }).click();
    // Fill exit quantity and submit
    await tradePanel.locator('input[type="number"]').first().fill('1000');
    const sellButton = tradePanel.getByRole('button', { name: 'Exit SHORT position' });
    await expect(sellButton).toBeEnabled();
    await sellButton.click();
    await expect(tradePanel.getByText(/Sold SHORT on/)).toContainText(market.slug);
  });

  /* ═════════════════════════════════════════════════════════════════════
   * 6. Portfolio reflects changes
   * ═════════════════════════════════════════════════════════════════════ */

  test('portfolio page shows the traded position', async () => {
    await loginWithPrivateKey(sharedPage, creatorSecret);
    await sharedPage.goto('/portfolio');
    await ensureLoggedIn(sharedPage, creatorSecret);
    await expect(sharedPage.getByRole('heading', { name: 'Your portfolio' })).toBeVisible();

    const positionRow = sharedPage.locator('.position-row').filter({ hasText: market.title }).first();
    await expect(positionRow).toBeVisible({ timeout: 15_000 });
    // Position should have a real value (not "Mark only")
    await expect(positionRow.getByText('Mark only')).toHaveCount(0);
  });
});