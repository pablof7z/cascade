<script lang="ts">
  import { browser } from '$app/environment';
  import PaperWalletPage from '$lib/components/cascade/PaperWalletPage.svelte';
  import { isPaperEdition } from '$lib/cascade/config';
  import { DEFAULT_RELAYS } from '$lib/ndk/config';
  import { ensureClientNdk, ndk } from '$lib/ndk/client';
  import { getMintUrl, normalizeMintUrl, shortMintLabel } from '$lib/wallet/mint';
  import {
    addTransaction,
    getTransactions,
    updateTransaction,
    type WalletTransaction
  } from '$lib/wallet/history';
  import {
    detectInputType,
    estimateMeltFee,
    extractAmountFromBolt11,
    resolveLightningAddress,
    type WalletInputType
  } from '$lib/wallet/lightning';
  import MintHealthIndicator from '$lib/components/wallet/MintHealthIndicator.svelte';
  import QRCode from '$lib/components/wallet/QRCode.svelte';
  import CopyButton from '$lib/components/wallet/CopyButton.svelte';
  import InvoiceExpiry from '$lib/components/wallet/InvoiceExpiry.svelte';
  import { getBolt11ExpiresAt } from '@nostr-dev-kit/wallet';

  type Tab = 'deposit' | 'withdraw' | 'receive' | 'history';
  type DepositStatus = 'creating' | 'waiting' | 'completed' | 'failed' | 'expired';
  type DepositView = {
    amount: number;
    quoteId: string | null;
    invoice: string | null;
    expiry: number | null;
    status: DepositStatus;
    error: string | null;
  };
  type MintInfoResponse = {
    nuts?: Record<string, { methods?: Array<{ unit?: string }> }>;
  };

  const paperEdition = isPaperEdition();

	  const currentUser = $derived(ndk.$currentUser);
	  const wallet = $derived(ndk.$wallet);

	  let activeTab = $state<Tab>('deposit');
	  let authResolved = $state(false);
	  let mintHealthy = $state(false);
	  let walletReady = $state(false);
	  let autoConfiguringWallet = $state(false);
	  let walletSetupError = $state<string | null>(null);
	  let mintCapabilities = $state<{ deposit: boolean; withdraw: boolean } | null>(null);

  let depositAmount = $state('');
  let depositAmountError = $state<string | null>(null);
  let depositError = $state<string | null>(null);
  let isCreatingDeposit = $state(false);
  let showDepositConfirmation = $state(false);
  let confirmedAmount = $state(0);
  let currentDeposit = $state<DepositView | null>(null);
  let activeDepositHandle = $state<{
    quoteId?: string;
    start: (pollTime?: number) => Promise<string>;
    on: (event: 'success' | 'error', handler: (value: unknown) => void) => void;
  } | null>(null);

  let withdrawInput = $state('');
  let withdrawAmount = $state<number | null>(null);
  let withdrawType = $state<WalletInputType>('invalid');
  let estimatedFee = $state<number | null>(null);
  let isResolvingAddress = $state(false);
  let showWithdrawConfirmation = $state(false);
  let withdrawStatus = $state<'idle' | 'processing' | 'complete' | 'failed'>('idle');
  let withdrawError = $state<string | null>(null);
  let withdrawPreimage = $state<string | null>(null);

  let receiveTokenInput = $state('');
	  let receiveError = $state<string | null>(null);
	  let receiveSuccess = $state(false);
	  let isReceiving = $state(false);

	  let history = $state<WalletTransaction[]>([]);
	  let historyFilter = $state<'all' | 'deposits' | 'withdrawals'>('all');

	  const walletSignedIn = $derived(Boolean(currentUser));
	  const balance = $derived(wallet?.balance ?? 0);
	  const currentMint = $derived(
	    normalizeMintUrl((wallet?.mints[0] as string | undefined) || getMintUrl())
	  );
	  const displayedBalance = $derived(walletSignedIn ? balance : 0);
	  const showAuthGate = $derived(authResolved && !currentUser);
	  const depositSupported = $derived(mintCapabilities?.deposit ?? false);
	  const withdrawSupported = $derived(mintCapabilities?.withdraw ?? false);
	  const canCreateDeposit = $derived(
	    walletSignedIn &&
	      mintHealthy &&
	      depositSupported &&
	      !isCreatingDeposit &&
	      Boolean(String(depositAmount ?? '').trim())
	  );
	  const canContinueWithdrawal = $derived(
	    walletSignedIn &&
	      mintHealthy &&
	      withdrawSupported &&
	      !isResolvingAddress &&
	      withdrawAmount !== null &&
	      withdrawAmount > 0 &&
	      withdrawType !== 'invalid' &&
	      withdrawType !== 'lnurl' &&
	      withdrawAmount + (estimatedFee ?? 0) <= balance
	  );
	  const canReceiveTokens = $derived(
	    walletSignedIn &&
	      mintHealthy &&
	      !isReceiving &&
	      Boolean(receiveTokenInput.trim())
	  );

  const filteredHistory = $derived.by(() => {
    if (historyFilter === 'all') return history;
    if (historyFilter === 'deposits') {
      return history.filter((entry) => entry.type === 'deposit' || entry.type === 'receive');
    }
    return history.filter((entry) => entry.type === 'withdrawal');
  });

	  $effect(() => {
	    if (!browser) return;
	    history = getTransactions();
	  });

	  $effect(() => {
	    if (!browser) return;
	    if (currentUser !== undefined) {
	      authResolved = true;
	    }
	  });

	  $effect(() => {
	    if (!browser || !currentMint) return;

	    let cancelled = false;
	    mintCapabilities = null;

	    void fetchMintCapabilities(currentMint)
	      .then((capabilities) => {
	        if (!cancelled) {
	          mintCapabilities = capabilities;
	        }
	      })
	      .catch(() => {
	        if (!cancelled) {
	          mintCapabilities = { deposit: false, withdraw: false };
	        }
	      });

	    return () => {
	      cancelled = true;
	    };
	  });

	  $effect(() => {
	    if (!currentUser || !wallet) {
	      walletReady = false;
	      return;
    }

	    if (!wallet.needsOnboarding && wallet.mints.length > 0) {
	      walletReady = true;
	      void wallet.refreshBalance();
	    }
	  });

	  $effect(() => {
	    if (!browser || !authResolved || !currentUser || !wallet) return;
	    if (walletReady || autoConfiguringWallet) return;
	    if (!wallet.needsOnboarding && wallet.mints.length > 0) return;

	    autoConfiguringWallet = true;
	    walletSetupError = null;

	    void ensureWalletConfigured()
	      .catch((error) => {
	        walletSetupError = getErrorMessage(error, 'Failed to initialize wallet.');
	      })
	      .finally(() => {
	        autoConfiguringWallet = false;
	      });
	  });

	  async function ensureWalletConfigured() {
	    await ensureClientNdk();
	    if (!currentUser) throw new Error('Sign in to use your wallet.');
	    if (!wallet) throw new Error('Wallet store unavailable.');

	    const currentMints = wallet.mints.map((mint) => normalizeMintUrl(String(mint)));
	    const needsMintMigration =
	      currentMints.length !== wallet.mints.length ||
	      currentMints.some((mint, index) => mint !== String(wallet.mints[index]));
	    const targetMints = currentMints.length > 0 ? currentMints : [getMintUrl()];

	    if (wallet.needsOnboarding || wallet.mints.length === 0 || needsMintMigration) {
	      await wallet.save({
	        mints: targetMints,
	        relays: DEFAULT_RELAYS
	      });
		    }

	    walletReady = true;
	    walletSetupError = null;
	    await wallet.refreshBalance();
	    return wallet;
	  }

  function refreshHistory() {
    if (!browser) return;
    history = getTransactions();
  }

  function formatSats(amount: number): string {
    return amount.toLocaleString();
  }

	  function formatDate(timestamp: number): string {
	    return new Date(timestamp * 1000).toLocaleString('en-US', {
	      month: 'short',
	      day: 'numeric',
	      hour: '2-digit',
	      minute: '2-digit'
	    });
	  }

	  function getErrorMessage(error: unknown, fallback: string): string {
	    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
	      return error.message;
	    }

	    if (typeof error === 'string' && error.trim()) return error;
	    return fallback;
	  }

  function supportsLightningMethod(
    info: MintInfoResponse,
    nutNumber: 4 | 5,
    units: string[] = ['sat', 'sats']
  ): boolean {
    const methods = info.nuts?.[String(nutNumber)]?.methods;
    if (!Array.isArray(methods) || methods.length === 0) return false;

    return methods.some((method) => {
      const unit = method?.unit?.toLowerCase();
      return Boolean(unit && units.includes(unit));
    });
  }

  async function fetchMintCapabilities(
    mintUrl: string
  ): Promise<{ deposit: boolean; withdraw: boolean }> {
    const response = await fetch(`${mintUrl}/v1/info`);
    if (!response.ok) {
      throw new Error('Failed to load mint capabilities.');
    }

    const info = (await response.json()) as MintInfoResponse;
    return {
      deposit: supportsLightningMethod(info, 4),
      withdraw: supportsLightningMethod(info, 5)
    };
  }

  function formatWalletOperationError(message: string, operation: 'deposit' | 'withdraw'): string {
    const lower = message.toLowerCase();

    if (lower.includes('unit unsupported')) {
      return operation === 'deposit'
        ? 'This mint does not currently support direct Lightning deposits.'
        : 'This mint does not currently support direct Lightning withdrawals.';
    }

    return message;
  }

  function validateDepositAmount() {
    const amount = Number.parseInt(depositAmount, 10);
    depositAmountError = null;

    if (Number.isNaN(amount) || amount <= 0) {
      depositAmountError = 'Please enter a valid amount.';
      return null;
    }
    if (amount < 1000) {
      depositAmountError = 'Minimum deposit is 1,000 sats.';
      return null;
    }
    if (amount > 1_000_000) {
      depositAmountError = 'Maximum deposit is 1,000,000 sats.';
      return null;
    }

    return amount;
  }

  function beginDeposit() {
    if (!depositSupported) {
      depositError = 'This mint does not currently support direct Lightning deposits.';
      return;
    }

    const amount = validateDepositAmount();
    if (!amount) return;
    confirmedAmount = amount;
    showDepositConfirmation = true;
  }

	  async function confirmDeposit() {
	    showDepositConfirmation = false;
	    isCreatingDeposit = true;
	    depositError = null;

	    try {
	      const walletStore = await ensureWalletConfigured();
	      const amount = confirmedAmount;
	      const depositHandle = walletStore.deposit(amount, currentMint);
	      if (!depositHandle) {
	        throw new Error('Failed to create a deposit.');
	      }

	      activeDepositHandle = depositHandle;
	      currentDeposit = {
	        amount,
	        quoteId: null,
	        invoice: null,
	        expiry: null,
	        status: 'creating',
        error: null
      };

	      depositHandle.on('success', async () => {
	        currentDeposit = currentDeposit
	          ? { ...currentDeposit, status: 'completed', error: null }
	          : null;
	        addTransaction({
	          type: 'deposit',
	          amount,
	          status: 'complete'
	        });
        refreshHistory();
        await walletStore.refreshBalance();
      });

	      depositHandle.on('error', (error) => {
	        const message = formatWalletOperationError(
	          getErrorMessage(error, 'Deposit failed.'),
	          'deposit'
	        );
	        currentDeposit = currentDeposit
	          ? {
	              ...currentDeposit,
	              status: message.toLowerCase().includes('expired') ? 'expired' : 'failed',
              error: message
            }
          : null;
        depositError = message;
      });

      const invoice = await depositHandle.start();
	      currentDeposit = {
	        amount,
	        quoteId: depositHandle.quoteId ?? null,
	        invoice,
	        expiry: getBolt11ExpiresAt(invoice) ?? null,
        status: 'waiting',
        error: null
	      };
      depositAmount = '';
    } catch (error) {
      depositError = formatWalletOperationError(
        error instanceof Error ? error.message : 'Failed to create a deposit.',
        'deposit'
      );
      currentDeposit = {
        amount: confirmedAmount,
        quoteId: null,
        invoice: null,
        expiry: null,
        status: 'failed',
        error: depositError
      };
    } finally {
      isCreatingDeposit = false;
    }
  }

  function clearDeposit() {
    activeDepositHandle = null;
    currentDeposit = null;
    depositError = null;
  }

  function setPresetAmount(amount: number) {
    depositAmount = String(amount);
    depositAmountError = null;
  }

	  async function configureWallet() {
	    walletSetupError = null;
	    try {
	      await ensureWalletConfigured();
	    } catch (error) {
	      walletSetupError =
	        error instanceof Error ? error.message : 'Failed to initialize wallet.';
	    }
	  }

  function handleWithdrawInputChange(value: string) {
    withdrawInput = value;
    withdrawError = null;
    withdrawType = detectInputType(value);

    if (withdrawType === 'bolt11') {
      const amount = extractAmountFromBolt11(value);
      if (amount !== null) {
        withdrawAmount = amount;
        void estimateMeltFee(amount).then((result) => {
          estimatedFee = result.fee;
        });
      } else {
        withdrawAmount = null;
        estimatedFee = null;
      }
    } else if (withdrawType !== 'lightning_address') {
      estimatedFee = null;
      if (withdrawType !== 'invalid') withdrawAmount = null;
    }

    if (withdrawType === 'lnurl' && value.trim()) {
      withdrawError = 'LNURL addresses are not supported. Use a bolt11 invoice or Lightning address.';
    } else if (withdrawType === 'invalid' && value.trim()) {
      withdrawError = 'Invalid Lightning address or invoice.';
    }
  }

  function handleWithdrawAmountChange(value: string) {
    const amount = Number.parseInt(value, 10);
    withdrawAmount = Number.isFinite(amount) && amount > 0 ? amount : null;
    withdrawError = null;
    if (withdrawAmount) {
      void estimateMeltFee(withdrawAmount).then((result) => {
        estimatedFee = result.fee;
      });
    }
  }

  function validateWithdraw() {
    if (withdrawAmount === null || withdrawAmount <= 0) {
      withdrawError = 'Please enter a valid amount.';
      return false;
    }
    if (withdrawType === 'invalid' || withdrawType === 'lnurl') {
      withdrawError = 'Enter a valid Lightning address or invoice.';
      return false;
    }
    if (withdrawAmount + (estimatedFee ?? 0) > balance) {
      withdrawError = `Insufficient balance. Total needed: ${(withdrawAmount + (estimatedFee ?? 0)).toLocaleString()} sats.`;
      return false;
    }
    return true;
  }

  function beginWithdraw() {
    withdrawError = null;
    if (!withdrawSupported) {
      withdrawError = 'This mint does not currently support direct Lightning withdrawals.';
      return;
    }

    if (!validateWithdraw()) return;
    showWithdrawConfirmation = true;
  }

  async function confirmWithdraw() {
    if (!withdrawAmount) return;

    showWithdrawConfirmation = false;
    withdrawStatus = 'processing';
    withdrawError = null;
    withdrawPreimage = null;

    const tx = addTransaction({
      type: 'withdrawal',
      amount: withdrawAmount,
      fee: estimatedFee ?? 0,
      destination:
        withdrawType === 'bolt11' ? `${withdrawInput.slice(0, 32)}...` : withdrawInput.trim(),
      status: 'pending'
    });
    refreshHistory();

    try {
      const walletStore = await ensureWalletConfigured();
      let invoice = withdrawInput.trim();

      if (withdrawType === 'lightning_address') {
        isResolvingAddress = true;
        try {
          invoice = await resolveLightningAddress(withdrawInput.trim(), withdrawAmount * 1000);
        } finally {
          isResolvingAddress = false;
        }
      }

      const result = await walletStore.lnPay({ pr: invoice });
      if (!result?.preimage) {
        throw new Error('Withdrawal did not return a payment confirmation.');
      }

      withdrawStatus = 'complete';
      withdrawPreimage = result.preimage;
      updateTransaction(tx.id, { status: 'complete' });
      refreshHistory();
      await walletStore.refreshBalance();
    } catch (error) {
      withdrawStatus = 'failed';
      withdrawError = formatWalletOperationError(
        error instanceof Error ? error.message : 'Withdrawal failed.',
        'withdraw'
      );
      updateTransaction(tx.id, { status: 'failed' });
      refreshHistory();
    } finally {
      isResolvingAddress = false;
    }
  }

  function resetWithdraw() {
    withdrawInput = '';
    withdrawAmount = null;
    withdrawType = 'invalid';
    estimatedFee = null;
    withdrawStatus = 'idle';
    withdrawError = null;
    withdrawPreimage = null;
    showWithdrawConfirmation = false;
  }

  async function handleReceiveToken() {
    if (!receiveTokenInput.trim()) {
      receiveError = 'Paste a token first.';
      return;
    }

    isReceiving = true;
    receiveError = null;
    receiveSuccess = false;

    try {
      const walletStore = await ensureWalletConfigured();
      await walletStore.receiveToken(receiveTokenInput.trim());
      addTransaction({
        type: 'receive',
        amount: 0,
        status: 'complete',
        destination: 'Incoming token'
      });
      refreshHistory();
      receiveTokenInput = '';
      receiveSuccess = true;
      await walletStore.refreshBalance();
    } catch (error) {
      receiveError = error instanceof Error ? error.message : 'Failed to receive token.';
    } finally {
      isReceiving = false;
    }
  }
</script>

<svelte:head>
  <title>Wallet — Cascade</title>
</svelte:head>

{#if paperEdition}
  <PaperWalletPage />
{:else if showAuthGate}
  <section class="wallet-shell">
    <div class="wallet-header">
      <h1>Wallet</h1>
      <p>Manage your sats and tokens.</p>
    </div>

    <div class="wallet-card wallet-gate">
      <strong>Wallet access requires a signed-in session.</strong>
      <p>Once you sign in, this route becomes the single place for deposit, withdrawal, receive, and history.</p>
      <div class="button-row">
        <a class="button-primary" href="/join">Join Cascade</a>
        <a class="button-secondary" href="/">Browse Markets</a>
      </div>
    </div>
  </section>
{:else}
  <section class="wallet-shell">
    <div class="wallet-header">
      <h1>Wallet</h1>
      <p>Manage your sats and tokens.</p>
    </div>

    <div class="wallet-balance-card">
      <div class="wallet-balance-top">
        <div>
          <p class="wallet-balance-label">Balance</p>
          <strong>{formatSats(displayedBalance)} <small>sats</small></strong>
        </div>
        <button class="button-ghost" onclick={() => wallet?.refreshBalance()} type="button">Refresh</button>
      </div>
      <div class="wallet-balance-foot">
        <MintHealthIndicator bind:mintHealthy mintUrl={currentMint} />
        <small>{shortMintLabel(currentMint)}</small>
      </div>
      {#if walletSetupError}
        <p class="wallet-error wallet-balance-error">{walletSetupError}</p>
      {/if}
    </div>

    <nav class="wallet-tabs" aria-label="Wallet sections">
      <button class:active={activeTab === 'deposit'} onclick={() => (activeTab = 'deposit')} type="button">Deposit</button>
      <button class:active={activeTab === 'withdraw'} onclick={() => (activeTab = 'withdraw')} type="button">Send</button>
      <button class:active={activeTab === 'receive'} onclick={() => (activeTab = 'receive')} type="button">Receive</button>
      <button class:active={activeTab === 'history'} onclick={() => (activeTab = 'history')} type="button">History</button>
    </nav>

    {#if activeTab === 'deposit'}
      <section class="wallet-card">
        {#if showDepositConfirmation}
          <div class="wallet-confirm">
            <h2>Confirm deposit</h2>
            <p>Review the details before creating your Lightning invoice.</p>

            <div class="wallet-definition-list">
              <div>
                <span>Amount</span>
                <strong>{formatSats(confirmedAmount)} sats</strong>
              </div>
              <div>
                <span>Mint</span>
                <strong>{shortMintLabel(currentMint)}</strong>
              </div>
            </div>

            <div class="button-row">
              <button class="button-secondary" onclick={() => (showDepositConfirmation = false)} type="button">Cancel</button>
              <button class="button-primary" onclick={confirmDeposit} type="button">Confirm deposit</button>
            </div>
          </div>
        {:else if currentDeposit}
          <div class="wallet-invoice">
            <div class="wallet-panel-head">
              <h2>Lightning Invoice</h2>
              <span class="wallet-status-label">{currentDeposit.status}</span>
            </div>

            <p class="wallet-muted">{formatSats(currentDeposit.amount)} sats</p>

            {#if currentDeposit.expiry && currentDeposit.status === 'waiting'}
              <InvoiceExpiry expiresAt={currentDeposit.expiry} />
            {/if}

            {#if currentDeposit.invoice && currentDeposit.status === 'waiting'}
              <div class="wallet-qr-wrap">
                <QRCode size={192} value={currentDeposit.invoice} />
              </div>

              <div class="wallet-invoice-text">
                <div class="wallet-inline-head">
                  <span>Invoice</span>
                  <CopyButton label="Copy invoice" text={currentDeposit.invoice} />
                </div>
                <code>{currentDeposit.invoice}</code>
              </div>
            {/if}

            {#if currentDeposit.status === 'completed'}
              <p class="wallet-success">
                Payment received. {formatSats(currentDeposit.amount)} sats were added to your wallet.
              </p>
            {/if}

            {#if currentDeposit.error}
              <p class="wallet-error">{currentDeposit.error}</p>
            {/if}

            <div class="button-row">
              <button class="button-secondary" onclick={clearDeposit} type="button">
                {currentDeposit.status === 'waiting' ? 'Hide invoice' : 'Done'}
              </button>
            </div>
          </div>
        {:else}
          <div class="wallet-pane-head">
            <h2>Deposit sats</h2>
            <p>Create a Lightning invoice to deposit sats into your wallet.</p>
          </div>

          {#if mintCapabilities && !depositSupported}
            <p class="wallet-note">
              {shortMintLabel(currentMint)} is online, but it does not currently advertise standard
              Lightning deposit methods. Use the Receive tab to add ecash tokens directly.
            </p>
          {/if}

          <label class="wallet-field">
            <span>Amount (sats)</span>
            <input bind:value={depositAmount} max="1000000" min="1000" placeholder="Enter amount" type="number" />
            {#if depositAmountError}
              <small class="wallet-error">{depositAmountError}</small>
            {:else}
              <small>Min 1,000 · Max 1,000,000 sats</small>
            {/if}
          </label>

          <div class="wallet-preset-row">
            {#each [1000, 5000, 10000, 50000, 100000] as preset}
              <button class="wallet-preset" onclick={() => setPresetAmount(preset)} type="button">
                {preset >= 1000 ? `${preset / 1000}k` : preset}
              </button>
            {/each}
          </div>

          {#if depositError}
            <p class="wallet-error">{depositError}</p>
          {/if}

          <button
            class="button-primary wallet-submit"
            disabled={!canCreateDeposit}
            onclick={beginDeposit}
            type="button"
          >
            {isCreatingDeposit ? 'Creating invoice...' : 'Create invoice'}
          </button>
        {/if}
      </section>
    {/if}

    {#if activeTab === 'withdraw'}
      <section class="wallet-card">
        {#if showWithdrawConfirmation && withdrawAmount !== null && estimatedFee !== null}
          <div class="wallet-confirm">
            <h2>Confirm withdrawal</h2>
            <div class="wallet-definition-list">
              <div>
                <span>Amount</span>
                <strong>{formatSats(withdrawAmount)} sats</strong>
              </div>
              <div>
                <span>Network fee</span>
                <strong>~{formatSats(estimatedFee)} sats</strong>
              </div>
              <div>
                <span>Total deducted</span>
                <strong>{formatSats(withdrawAmount + estimatedFee)} sats</strong>
              </div>
            </div>
            <div class="button-row">
              <button class="button-secondary" onclick={() => (showWithdrawConfirmation = false)} type="button">Cancel</button>
              <button class="button-primary" onclick={confirmWithdraw} type="button">Confirm withdrawal</button>
            </div>
          </div>
        {:else if withdrawStatus === 'processing' || withdrawStatus === 'complete' || withdrawStatus === 'failed'}
          <div class="wallet-status-block">
            {#if withdrawStatus === 'processing'}
              <p class="wallet-muted">{isResolvingAddress ? 'Resolving Lightning address...' : 'Processing withdrawal...'}</p>
            {/if}
            {#if withdrawStatus === 'complete'}
              <p class="wallet-success">Withdrawn {withdrawAmount ? formatSats(withdrawAmount) : '0'} sats.</p>
              {#if estimatedFee !== null}
                <p class="wallet-muted">Estimated fee: ~{formatSats(estimatedFee)} sats</p>
              {/if}
              {#if withdrawPreimage}
                <code>{withdrawPreimage.slice(0, 12)}...{withdrawPreimage.slice(-12)}</code>
              {/if}
            {/if}
            {#if withdrawStatus === 'failed'}
              <p class="wallet-error">{withdrawError || 'Withdrawal failed.'}</p>
            {/if}
            <div class="button-row">
              <button class="button-secondary" onclick={resetWithdraw} type="button">New withdrawal</button>
            </div>
          </div>
        {:else}
          <div class="wallet-pane-head">
            <h2>Withdraw via Lightning</h2>
          </div>

          {#if mintCapabilities && !withdrawSupported}
            <p class="wallet-note">
              {shortMintLabel(currentMint)} is online, but it does not currently advertise standard
              Lightning withdrawal methods.
            </p>
          {/if}

          <label class="wallet-field">
            <span>Lightning Address or Invoice</span>
            <div class="wallet-input-wrap">
              <textarea
                oninput={(event) => handleWithdrawInputChange((event.currentTarget as HTMLTextAreaElement).value)}
                placeholder="lntb... or user@domain.com"
                rows="3"
                value={withdrawInput}
              ></textarea>
              {#if withdrawInput.trim()}
                <span class:invalid={withdrawType === 'invalid'} class="wallet-type-badge">
                  {withdrawType === 'bolt11'
                    ? 'Invoice'
                    : withdrawType === 'lightning_address'
                      ? 'Address'
                      : withdrawType === 'lnurl'
                        ? 'LNURL'
                        : 'Invalid'}
                </span>
              {/if}
            </div>
          </label>

          <label class="wallet-field">
            <span>Amount (sats)</span>
            <input
              disabled={withdrawType === 'bolt11'}
              oninput={(event) => handleWithdrawAmountChange((event.currentTarget as HTMLInputElement).value)}
              placeholder="Enter amount"
              type="number"
              value={withdrawAmount ?? ''}
            />
            <small>Available: {formatSats(balance)} sats</small>
          </label>

          {#if estimatedFee !== null && withdrawAmount !== null}
            <div class="wallet-fee-note">
              <p>Network fee: ~{formatSats(estimatedFee)} sats</p>
              <p>Total: {formatSats(withdrawAmount)} + {formatSats(estimatedFee)} = {formatSats(withdrawAmount + estimatedFee)} sats</p>
            </div>
          {/if}

          {#if withdrawError}
            <p class="wallet-error">{withdrawError}</p>
          {/if}

          {#if withdrawAmount !== null && estimatedFee !== null && withdrawAmount + estimatedFee > balance}
            <p class="wallet-error">
              Insufficient balance. Total needed: {formatSats(withdrawAmount + estimatedFee)} sats.
            </p>
          {/if}

          <button
            class="button-primary wallet-submit"
            disabled={!canContinueWithdrawal}
            onclick={beginWithdraw}
            type="button"
          >
            Continue
          </button>
        {/if}
      </section>
    {/if}

    {#if activeTab === 'receive'}
      <section class="wallet-card">
        <div class="wallet-pane-head">
          <h2>Receive tokens</h2>
          <p>Paste a token to add it to your wallet.</p>
        </div>

        <label class="wallet-field">
          <span>Token</span>
          <textarea bind:value={receiveTokenInput} placeholder="Paste your token here" rows="4"></textarea>
        </label>

        {#if receiveError}
          <p class="wallet-error">{receiveError}</p>
        {/if}

        {#if receiveSuccess}
          <p class="wallet-success">Token received successfully.</p>
        {/if}

        <button
          class="button-primary wallet-submit"
          disabled={!canReceiveTokens}
          onclick={handleReceiveToken}
          type="button"
        >
          {isReceiving ? 'Receiving...' : 'Receive tokens'}
        </button>
      </section>
    {/if}

    {#if activeTab === 'history'}
      <section class="wallet-card">
        <div class="wallet-filter-tabs">
          <button class:active={historyFilter === 'all'} onclick={() => (historyFilter = 'all')} type="button">All</button>
          <button class:active={historyFilter === 'deposits'} onclick={() => (historyFilter = 'deposits')} type="button">Deposits</button>
          <button class:active={historyFilter === 'withdrawals'} onclick={() => (historyFilter = 'withdrawals')} type="button">Withdrawals</button>
        </div>

        {#if filteredHistory.length === 0}
          <div class="wallet-empty-state">
            <strong>No transactions yet.</strong>
          </div>
        {:else}
          <div class="wallet-history-list">
            {#each filteredHistory as tx (tx.id)}
              <div class="wallet-history-row">
                <div>
                  <div class="wallet-history-main">
                    <strong class:positive={tx.type === 'deposit' || tx.type === 'receive'} class:negative={tx.type === 'withdrawal'}>
                      {tx.type === 'deposit' || tx.type === 'receive' ? '+' : '-'}{formatSats(tx.amount)}
                    </strong>
                    <span
                      class="wallet-history-status"
                      class:complete={tx.status === 'complete'}
                      class:failed={tx.status === 'failed'}
                    >
                      {tx.status}
                    </span>
                    <small>{tx.type}</small>
                  </div>
                  {#if tx.destination}
                    <p>{tx.destination}</p>
                  {/if}
                </div>
                <span>{formatDate(tx.timestamp)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </section>
{/if}

	<style>
	  .wallet-shell {
	    width: min(calc(100% - 2.5rem), 39rem);
	    margin: 0 auto;
	    padding: 2.5rem 0 4rem;
	    display: grid;
	    gap: 1.75rem;
	  }

	  .wallet-header h1 {
	    font-size: 2rem;
	    letter-spacing: -0.03em;
	  }

	  .wallet-header p,
	  .wallet-pane-head p,
	  .wallet-muted,
	  .wallet-note,
	  .wallet-field small,
	  .wallet-history-row p,
	  .wallet-balance-foot small,
	  .wallet-gate p {
	    color: var(--text-muted);
	  }

	  .wallet-header p {
	    margin-top: 0.5rem;
	    line-height: 1.6;
	  }

	  .wallet-balance-card,
	  .wallet-card {
	    border: 1px solid var(--border-subtle);
	    background: var(--surface);
	    padding: 1.5rem;
	    border-radius: 0.125rem;
	  }

	  .wallet-balance-card {
	    display: grid;
	    gap: 0.9rem;
	  }

	  .wallet-balance-label,
	  .wallet-field span,
	  .wallet-definition-list span,
	  .wallet-inline-head span {
	    color: var(--text);
	    font-size: 0.9rem;
	    font-weight: 500;
	  }

	  .wallet-balance-card strong {
	    display: block;
	    margin-top: 0.25rem;
	    color: var(--text-strong);
	    font-family: var(--font-mono);
	    font-size: 1.9rem;
	  }

	  .wallet-balance-card strong small {
	    color: var(--text-muted);
	    font-size: 1.15rem;
	  }

	  .wallet-balance-top,
	  .wallet-balance-foot,
	  .wallet-inline-head,
	  .wallet-history-main {
	    display: flex;
	    align-items: center;
	    justify-content: space-between;
	    gap: 1rem;
	  }

	  .wallet-tabs,
	  .wallet-filter-tabs {
	    display: flex;
	    gap: 0.1rem;
	    border-bottom: 1px solid var(--border-subtle);
	    overflow-x: auto;
	  }

	  .wallet-tabs button,
	  .wallet-filter-tabs button {
	    margin-bottom: -1px;
	    padding: 0.75rem 1rem;
	    border: 0;
	    border-bottom: 2px solid transparent;
	    background: transparent;
	    color: var(--text-faint);
	    font-size: 0.92rem;
	    font-weight: 500;
	    cursor: pointer;
	    white-space: nowrap;
	  }

  .wallet-tabs button.active,
  .wallet-filter-tabs button.active {
    border-bottom-color: var(--text-strong);
    color: var(--text-strong);
  }

  .wallet-pane-head,
  .wallet-confirm,
  .wallet-status-block,
  .wallet-invoice {
    display: grid;
    gap: 1rem;
  }

  .wallet-pane-head h2 {
    font-size: 1.15rem;
  }

  .wallet-field {
    display: grid;
    gap: 0.5rem;
  }

	  .wallet-field input,
	  .wallet-field textarea {
	    width: 100%;
	    box-sizing: border-box;
	    border: 1px solid var(--border);
	    background: var(--bg);
	    color: var(--text-strong);
	    padding: 0.85rem 0.95rem;
	    border-radius: 0.125rem;
	  }

	  .wallet-field textarea {
	    resize: vertical;
	    min-height: 5.5rem;
	  }

	  .wallet-preset-row {
	    display: flex;
	    flex-wrap: wrap;
    gap: 0.5rem;
  }

	  .wallet-preset {
	    border: 1px solid var(--border);
	    background: transparent;
	    color: var(--text);
	    padding: 0.5rem 0.8rem;
	    font-size: 0.78rem;
	    cursor: pointer;
	  }

	  .wallet-definition-list,
	  .wallet-history-list {
	    display: grid;
	  }

	  .wallet-definition-list div,
	  .wallet-history-row {
	    display: flex;
    align-items: flex-start;
    justify-content: space-between;
	    gap: 1rem;
	    padding: 0.9rem 0;
	    border-bottom: 1px solid var(--border-subtle);
	  }

	  .wallet-definition-list div:first-child,
	  .wallet-history-row:first-child {
	    border-top: 1px solid var(--border-subtle);
	  }

	  .wallet-definition-list strong,
	  .wallet-history-main strong,
	  .wallet-gate strong,
	  .wallet-empty-state strong {
	    color: var(--text-strong);
	  }

	  .wallet-status-label,
	  .wallet-history-status {
	    display: inline-flex;
	    align-items: center;
	    justify-content: center;
	    min-height: 1.5rem;
	    padding: 0 0.45rem;
	    background: var(--surface-hover);
	    color: var(--text);
	    font-size: 0.72rem;
	  }

	  .wallet-panel-head {
	    display: flex;
	    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .wallet-qr-wrap {
    width: fit-content;
    margin: 0 auto;
    padding: 0.9rem;
    background: #ffffff;
  }

  .wallet-invoice-text code,
  .wallet-status-block code {
    display: block;
    word-break: break-all;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .wallet-submit {
    width: 100%;
  }

	  .wallet-fee-note {
	    color: var(--text-faint);
	    font-size: 0.82rem;
	    display: grid;
	    gap: 0.25rem;
	  }

  .wallet-success {
    color: var(--positive);
  }

  .wallet-error {
    color: var(--negative);
  }

	  .wallet-empty-state,
	  .wallet-gate {
	    display: grid;
	    gap: 0.75rem;
	  }

	  .wallet-balance-error {
	    margin-top: -0.15rem;
	  }

	  .wallet-input-wrap {
	    position: relative;
	  }

	  .wallet-type-badge {
	    position: absolute;
	    top: 0.65rem;
	    right: 0.65rem;
	    display: inline-flex;
	    align-items: center;
	    min-height: 1.35rem;
	    padding: 0 0.45rem;
	    background: var(--surface-hover);
	    color: var(--text);
	    font-size: 0.72rem;
	  }

	  .wallet-type-badge.invalid {
	    color: var(--negative);
	  }

	  .wallet-history-main small {
	    color: var(--text-faint);
	    font-size: 0.76rem;
	  }

	  .wallet-history-main strong {
	    font-family: var(--font-mono);
	  }

  .wallet-history-main strong.positive {
    color: var(--positive);
  }

	  .wallet-history-main strong.negative {
	    color: var(--negative);
	  }

	  .wallet-history-status.complete {
	    color: var(--positive);
	  }

	  .wallet-history-status.failed {
	    color: var(--negative);
	  }
	</style>
