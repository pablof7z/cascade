<script lang="ts">
  import { onMount } from 'svelte';
  import { initNostrStore, getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import { getWalletBalance, createDeposit, sendTokens, receiveToken } from '../../walletStore';
  import { initWalletStore, refreshBalance } from '$lib/stores/wallet.svelte';
  import { createMarketDeposit, getAllDeposits, clearInactiveDeposits, type Deposit } from '../../services/depositService';

  // Reactive state
  let balance = $state(0);
  let isLoadingBalance = $state(true);
  let pubkey = $state<string | null>(null);

  // Deposit state
  let depositAmount = $state('');
  let isCreatingDeposit = $state(false);
  let currentDeposit = $state<Deposit | null>(null);
  let depositError = $state<string | null>(null);

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

  // QR code URL for Lightning invoice
  let qrCodeUrl = $derived(currentDeposit?.quoteId 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentDeposit.quoteId)}`
    : null
  );

  onMount(async () => {
    // Initialize Nostr and wallet stores
    await initNostrStore();
    await initWalletStore();
    
    // Get initial pubkey
    pubkey = getCurrentPubkey();
    
    // Load initial balance and deposits
    loadBalance();
    loadDeposits();
  });

  async function loadBalance() {
    isLoadingBalance = true;
    try {
      balance = await getWalletBalance();
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      isLoadingBalance = false;
    }
  }

  async function loadDeposits() {
    deposits = getAllDeposits();
  }

  async function handleCreateDeposit() {
    const amount = parseInt(depositAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      depositError = 'Please enter a valid amount';
      return;
    }

    isCreatingDeposit = true;
    depositError = null;
    currentDeposit = null;

    try {
      const deposit = await createMarketDeposit(null, amount, {
        callbacks: {
          onStatusChange: (d) => {
            currentDeposit = d;
          },
          onInvoiceCreated: (d) => {
            currentDeposit = d;
            loadBalance();
            loadDeposits();
          },
          onTokensReceived: () => {
            loadBalance();
            loadDeposits();
          },
          onError: (d, error) => {
            depositError = error;
          }
        }
      });

      if (deposit) {
        currentDeposit = deposit;
        depositAmount = '';
      }
    } catch (err) {
      depositError = err instanceof Error ? err.message : 'Failed to create deposit';
    } finally {
      isCreatingDeposit = false;
    }
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
        loadBalance();
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
        loadBalance();
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
      clearInactiveDeposits();
      currentDeposit = null;
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
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-8">
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
          onclick={loadBalance}
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
        {#if !currentDeposit}
          <!-- Deposit Form -->
          <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                  min="1"
                  bind:value={depositAmount}
                  placeholder="Enter amount"
                  class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
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
          <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium text-white">Lightning Invoice</h2>
              <span class="text-sm px-2 py-1 rounded {currentDeposit.status === 'completed' ? 'bg-emerald-900 text-emerald-400' : currentDeposit.status === 'failed' ? 'bg-rose-900 text-rose-400' : 'bg-neutral-800 text-neutral-300'}">
                {currentDeposit.status}
              </span>
            </div>

            <p class="text-neutral-400 text-sm mb-4">
              {formatSats(currentDeposit.amount)} sats
            </p>

            {#if qrCodeUrl}
              <div class="flex justify-center mb-4">
                <img
                  src={qrCodeUrl}
                  alt="Lightning Invoice QR Code"
                  class="w-48 h-48 rounded-lg"
                />
              </div>
            {/if}

            {#if currentDeposit.quoteId}
              <div class="mb-4">
                <p class="text-xs text-neutral-500 mb-1">Invoice</p>
                <p class="text-xs font-mono text-neutral-300 break-all bg-neutral-800 p-2 rounded">
                  {currentDeposit.quoteId}
                </p>
              </div>
            {/if}

            <div class="flex gap-3">
              {#if currentDeposit.status !== 'completed'}
                <button
                  onclick={loadBalance}
                  class="flex-1 px-4 py-2 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
                >
                  Refresh status
                </button>
              {/if}
              <button
                onclick={clearCurrentDeposit}
                class="flex-1 px-4 py-2 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Withdraw Tab -->
    {#if activeTab === 'withdraw'}
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
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
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
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
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none font-mono text-xs"
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
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
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
                    <span class="text-xs px-1.5 py-0.5 rounded {deposit.status === 'completed' ? 'bg-emerald-900 text-emerald-400' : deposit.status === 'failed' ? 'bg-rose-900 text-rose-400' : 'bg-neutral-800 text-neutral-300'}">
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
