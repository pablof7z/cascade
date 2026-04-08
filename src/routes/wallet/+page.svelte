<script lang="ts">
  import { onMount } from 'svelte';
  import qrcode from 'qrcode';
  import { initNostrStore, getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import { sendTokens, receiveToken } from '../../walletStore';
  import { initWalletStore, refreshBalance, getBalance, isRefreshing } from '$lib/stores/wallet.svelte';
  import {
    createMarketDeposit,
    cancelDeposit,
    getAllDeposits,
    clearInactiveDeposits,
    getDepositErrorMessage,
    type Deposit
  } from '../../services/depositService';
  import { getMintUrl } from '$lib/config/mint';
  import DepositConfirmation from '$lib/components/DepositConfirmation.svelte';

  // Reactive state — derived from shared wallet store (single source of truth)
  let balance = $derived(getBalance());
  let isLoadingBalance = $derived(isRefreshing());
  let pubkey = $state<string | null>(null);

  // Deposit form state
  let depositAmount = $state('');
  let depositAmountError = $state<string | null>(null);
  let isCreatingDeposit = $state(false);
  let currentDeposit = $state<Deposit | null>(null);
  let depositError = $state<string | null>(null);

  // Deposit flow state
  let showConfirmation = $state(false);
  let confirmedAmount = $state(0);
  let qrCodeDataUrl = $state<string | null>(null);
  let invoiceCopied = $state(false);
  let timeRemaining = $state<number | null>(null);

  // Withdraw state
  let withdrawAmount = $state('');
  let withdrawMemo = $state('');
  let isSending = $state(false);
  let sendError = $state<string | null>(null);
  let sendSuccess = $state<string | null>(null);

  // Receive/token state
  let receiveTokenInput = $state('');
  let isReceiving = $state(false);
  let receiveError = $state<string | null>(null);
  let receiveSuccess = $state(false);

  // Transaction history
  let deposits = $state<Deposit[]>([]);
  let activeTab = $state<'deposit' | 'withdraw' | 'history' | 'receive'>('deposit');

  // Generate QR code locally when invoice changes
  $effect(() => {
    const invoice = currentDeposit?.invoice;
    if (invoice) {
      qrcode.toDataURL(invoice, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(url => { qrCodeDataUrl = url; })
        .catch(() => { qrCodeDataUrl = null; });
    } else {
      qrCodeDataUrl = null;
    }
  });

  // Countdown timer for invoice expiry
  $effect(() => {
    const expiry = currentDeposit?.expiry;
    const status = currentDeposit?.status;
    if (expiry && (status === 'waiting' || status === 'creating')) {
      const update = () => {
        const remaining = expiry - Math.floor(Date.now() / 1000);
        timeRemaining = remaining > 0 ? remaining : 0;
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      timeRemaining = null;
    }
  });

  onMount(async () => {
    // Initialize Nostr and wallet stores
    await initNostrStore();
    await initWalletStore();
    
    // Get initial pubkey
    pubkey = getCurrentPubkey();
    
    // Load initial balance and deposits
    refreshBalance();
    loadDeposits();
  });

  function loadDeposits() {
    deposits = getAllDeposits();
  }

  // Validate amount and show confirmation step
  function handleCreateDeposit() {
    const amount = parseInt(depositAmount, 10);
    depositAmountError = null;

    if (isNaN(amount) || amount <= 0) {
      depositAmountError = 'Please enter a valid amount';
      return;
    }
    if (amount < 1000) {
      depositAmountError = 'Minimum deposit is 1,000 sats';
      return;
    }
    if (amount > 1_000_000) {
      depositAmountError = 'Maximum deposit is 1,000,000 sats';
      return;
    }

    confirmedAmount = amount;
    showConfirmation = true;
  }

  // Actually create the deposit after confirmation
  async function handleConfirmDeposit() {
    showConfirmation = false;
    isCreatingDeposit = true;
    depositError = null;
    currentDeposit = null;

    try {
      const deposit = await createMarketDeposit(null, confirmedAmount, {
        callbacks: {
          onStatusChange: (d) => {
            currentDeposit = { ...d };
            // Auto-refresh balance when completed
            if (d.status === 'completed') {
              refreshBalance();
              loadDeposits();
            }
          },
          onInvoiceCreated: (d) => {
            currentDeposit = { ...d };
            loadDeposits();
          },
          onTokensReceived: () => {
            refreshBalance();
            loadDeposits();
          },
          onError: (d, error) => {
            depositError = getDepositErrorMessage(d);
            currentDeposit = { ...d };
          }
        }
      });

      if (deposit) {
        currentDeposit = { ...deposit };
        depositAmount = '';
      }
    } catch (err) {
      depositError = err instanceof Error ? err.message : 'Failed to create deposit';
    } finally {
      isCreatingDeposit = false;
    }
  }

  function handleCancelConfirmation() {
    showConfirmation = false;
  }

  async function handleCopyInvoice() {
    const invoice = currentDeposit?.invoice;
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      invoiceCopied = true;
      setTimeout(() => { invoiceCopied = false; }, 1500);
    } catch {
      // clipboard API not available — silently ignore
    }
  }

  function setPresetAmount(sats: number) {
    depositAmount = String(sats);
    depositAmountError = null;
  }

  async function handleSendTokens() {
    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      sendError = 'Please enter a valid amount';
      return;
    }

    if (amount > balance) {
      sendError = 'Insufficient balance';
      return;
    }

    isSending = true;
    sendError = null;
    sendSuccess = null;

    try {
      const token = await sendTokens(amount, withdrawMemo || undefined);
      if (token) {
        sendSuccess = 'Tokens sent successfully';
        withdrawAmount = '';
        withdrawMemo = '';
        refreshBalance();
      } else {
        sendError = 'Failed to send tokens';
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Failed to send tokens';
    } finally {
      isSending = false;
    }
  }

  async function handleReceiveToken() {
    if (!receiveTokenInput.trim()) {
      receiveError = 'Please enter a token';
      return;
    }

    isReceiving = true;
    receiveError = null;
    receiveSuccess = false;

    try {
      const success = await receiveToken(receiveTokenInput.trim());
      if (success) {
        receiveSuccess = true;
        receiveTokenInput = '';
        refreshBalance();
        loadDeposits();
      } else {
        receiveError = 'Failed to receive token';
      }
    } catch (err) {
      receiveError = err instanceof Error ? err.message : 'Failed to receive token';
    } finally {
      isReceiving = false;
    }
  }

  function clearCurrentDeposit() {
    if (currentDeposit) {
      // For non-terminal deposits, cancel to stop polling and clean up tracking
      if (currentDeposit.status !== 'completed' && currentDeposit.status !== 'failed' && currentDeposit.status !== 'expired') {
        cancelDeposit(currentDeposit.id);
      }
      clearInactiveDeposits();
      currentDeposit = null;
      qrCodeDataUrl = null;
    }
  }

  function formatSats(amount: number): string {
    return amount.toLocaleString();
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>Wallet — Cascade</title>
</svelte:head>

<main class="min-h-[calc(100vh-80px)] bg-neutral-950 text-white">
  <div class="max-w-2xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-white mb-2">Wallet</h1>
      <p class="text-neutral-400">Manage your sats and tokens</p>
    </div>

    <!-- Balance Card -->
    <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6 mb-8">
      <div class="flex items-baseline justify-between">
        <div>
          <p class="text-neutral-400 text-sm mb-1">Balance</p>
          {#if isLoadingBalance}
            <div class="h-8 w-32 bg-neutral-800 animate-pulse rounded"></div>
          {:else}
            <p class="text-3xl font-mono font-medium text-white">
              {formatSats(balance)} <span class="text-lg text-neutral-400">sats</span>
            </p>
          {/if}
        </div>
        <button
          onclick={refreshBalance}
          disabled={isLoadingBalance}
          class="text-sm text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-neutral-800 mb-6">
      <button
        onclick={() => activeTab = 'deposit'}
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px {activeTab === 'deposit' ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        Deposit
      </button>
      <button
        onclick={() => activeTab = 'withdraw'}
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px {activeTab === 'withdraw' ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        Send
      </button>
      <button
        onclick={() => activeTab = 'receive'}
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px {activeTab === 'receive' ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        Receive
      </button>
      <button
        onclick={() => activeTab = 'history'}
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px {activeTab === 'history' ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        History
      </button>
    </div>

    <!-- Deposit Tab -->
    {#if activeTab === 'deposit'}
      <div class="space-y-6">
        {#if showConfirmation}
          <!-- Confirmation Step -->
          <DepositConfirmation
            amount={confirmedAmount}
            mintUrl={getMintUrl()}
            onConfirm={handleConfirmDeposit}
            onCancel={handleCancelConfirmation}
          />

        {:else if !currentDeposit || currentDeposit.status === 'creating'}
          <!-- Deposit Form -->
          <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
            <h2 class="text-lg font-medium text-white mb-4">Deposit sats</h2>
            <p class="text-neutral-400 text-sm mb-4">
              Create a Lightning invoice to deposit sats into your wallet.
            </p>

            <div class="space-y-4">
              <div>
                <label for="deposit-amount" class="block text-sm font-medium text-neutral-300 mb-2">
                  Amount (sats)
                </label>
                <input
                  id="deposit-amount"
                  type="number"
                  min="1000"
                  max="1000000"
                  bind:value={depositAmount}
                  placeholder="Enter amount"
                  class="w-full px-4 py-2.5 bg-neutral-800 border {depositAmountError ? 'border-rose-500' : 'border-neutral-700'} rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
                {#if depositAmountError}
                  <p class="text-rose-400 text-xs mt-1">{depositAmountError}</p>
                {:else}
                  <p class="text-xs text-neutral-500 mt-1">Min 1,000 · Max 1,000,000 sats</p>
                {/if}
              </div>

              <!-- Preset amount buttons -->
              <div class="flex gap-2 flex-wrap">
                {#each [1000, 5000, 10000, 50000, 100000] as preset}
                  <button
                    onclick={() => setPresetAmount(preset)}
                    class="px-3 py-1.5 text-xs font-medium text-neutral-400 border border-neutral-700 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    {preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                {/each}
              </div>

              {#if depositError}
                <p class="text-rose-400 text-sm">{depositError}</p>
              {/if}

              <button
                onclick={handleCreateDeposit}
                disabled={isCreatingDeposit || !depositAmount}
                class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingDeposit ? 'Creating invoice...' : 'Create invoice'}
              </button>
            </div>
          </div>

        {:else}
          <!-- Invoice Display -->
          <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium text-white">Lightning Invoice</h2>
              <span class="text-sm px-2 py-1 {currentDeposit.status === 'completed' ? 'bg-emerald-900 text-emerald-400' : currentDeposit.status === 'failed' || currentDeposit.status === 'expired' ? 'bg-rose-900 text-rose-400' : 'bg-neutral-800 text-neutral-300'}">
                {currentDeposit.status}
              </span>
            </div>

            <p class="text-neutral-400 text-sm mb-4">
              {formatSats(currentDeposit.amount)} sats
            </p>

            <!-- Expiry countdown -->
            {#if timeRemaining !== null && currentDeposit.status === 'waiting'}
              <div class="mb-4 flex items-center gap-2">
                <span class="text-xs text-neutral-500">Expires in</span>
                <span class="text-sm font-mono {timeRemaining < 60 ? 'text-rose-400' : 'text-neutral-300'}">
                  {timeRemaining === 0 ? 'Expired' : formatCountdown(timeRemaining)}
                </span>
              </div>
            {/if}

            <!-- QR code (locally generated) -->
            {#if qrCodeDataUrl && currentDeposit.status === 'waiting'}
              <div class="flex justify-center mb-4">
                <img
                  src={qrCodeDataUrl}
                  alt="Lightning Invoice QR Code"
                  class="w-48 h-48 rounded-sm"
                />
              </div>
            {/if}

            <!-- Invoice string + copy button -->
            {#if currentDeposit.invoice && currentDeposit.status === 'waiting'}
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs text-neutral-500">Invoice</p>
                  <button
                    onclick={handleCopyInvoice}
                    class="text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    {invoiceCopied ? 'Copied!' : 'Copy invoice'}
                  </button>
                </div>
                <p class="text-xs font-mono text-neutral-300 break-all bg-neutral-800 p-2 rounded">
                  {currentDeposit.invoice}
                </p>
              </div>
            {/if}

            <!-- Error display -->
            {#if (currentDeposit.status === 'failed' || currentDeposit.status === 'expired') && currentDeposit.error}
              <p class="text-rose-400 text-sm mb-4">
                {getDepositErrorMessage(currentDeposit)}
              </p>
            {/if}

            <!-- Completed confirmation -->
            {#if currentDeposit.status === 'completed'}
              <p class="text-emerald-400 text-sm mb-4">
                Payment received — {formatSats(currentDeposit.amount)} sats added to your wallet.
              </p>
            {/if}

            <div class="flex gap-3">
              <button
                onclick={clearCurrentDeposit}
                class="flex-1 px-4 py-2 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
              >
                {currentDeposit.status === 'completed' ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Withdraw Tab -->
    {#if activeTab === 'withdraw'}
      <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
        <h2 class="text-lg font-medium text-white mb-4">Send tokens</h2>
        <p class="text-neutral-400 text-sm mb-4">
          Send tokens to another wallet.
        </p>

        <div class="space-y-4">
          <div>
            <label for="withdraw-amount" class="block text-sm font-medium text-neutral-300 mb-2">
              Amount (sats)
            </label>
            <input
              id="withdraw-amount"
              type="number"
              min="1"
              max={balance}
              bind:value={withdrawAmount}
              placeholder="Enter amount"
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
            <p class="text-xs text-neutral-500 mt-1">Available: {formatSats(balance)} sats</p>
          </div>

          <div>
            <label for="withdraw-memo" class="block text-sm font-medium text-neutral-300 mb-2">
              Memo (optional)
            </label>
            <input
              id="withdraw-memo"
              type="text"
              bind:value={withdrawMemo}
              placeholder="Add a note"
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {#if sendError}
            <p class="text-rose-400 text-sm">{sendError}</p>
          {/if}

          {#if sendSuccess}
            <p class="text-emerald-400 text-sm">{sendSuccess}</p>
          {/if}

          <button
            onclick={handleSendTokens}
            disabled={isSending || !withdrawAmount || balance === 0}
            class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send tokens'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Receive Tab -->
    {#if activeTab === 'receive'}
      <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
        <h2 class="text-lg font-medium text-white mb-4">Receive tokens</h2>
        <p class="text-neutral-400 text-sm mb-4">
          Paste a token to add it to your wallet.
        </p>

        <div class="space-y-4">
          <div>
            <label for="receive-token" class="block text-sm font-medium text-neutral-300 mb-2">
              Token
            </label>
            <textarea
              id="receive-token"
              bind:value={receiveTokenInput}
              placeholder="Paste your token here"
              rows="4"
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none font-mono text-xs"
            ></textarea>
          </div>

          {#if receiveError}
            <p class="text-rose-400 text-sm">{receiveError}</p>
          {/if}

          {#if receiveSuccess}
            <p class="text-emerald-400 text-sm">Token received successfully!</p>
          {/if}

          <button
            onclick={handleReceiveToken}
            disabled={isReceiving || !receiveTokenInput.trim()}
            class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {isReceiving ? 'Receiving...' : 'Receive tokens'}
          </button>
        </div>
      </div>
    {/if}

    <!-- History Tab -->
    {#if activeTab === 'history'}
      <div class="bg-neutral-900 border border-neutral-800 rounded-sm overflow-hidden">
        <div class="p-4 border-b border-neutral-800">
          <h2 class="text-lg font-medium text-white">Transaction History</h2>
        </div>

        {#if deposits.length === 0}
          <div class="p-8 text-center">
            <p class="text-neutral-500">No transactions yet</p>
          </div>
        {:else}
          <div class="divide-y divide-neutral-800">
            {#each deposits as deposit}
              <div class="p-4 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-emerald-400 font-mono text-sm">+{formatSats(deposit.amount)}</span>
                    <span class="text-xs px-1.5 py-0.5 {deposit.status === 'completed' ? 'bg-emerald-900 text-emerald-400' : deposit.status === 'failed' || deposit.status === 'expired' ? 'bg-rose-900 text-rose-400' : 'bg-neutral-800 text-neutral-300'}">
                      {deposit.status}
                    </span>
                  </div>
                  <p class="text-xs text-neutral-500 mt-1">{formatDate(deposit.createdAt)}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-neutral-500">Deposit</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>
