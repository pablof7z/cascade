<script lang="ts">
  import { onMount } from 'svelte';
  import { initNostrStore, getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import { receiveToken } from '../../walletStore';
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
  import { detectInputType, extractAmountFromBolt11, estimateMeltFee, meltTokens, resolveLightningAddress, type MeltResult } from '../../services/withdrawService';
  import WithdrawConfirmation from '$lib/components/WithdrawConfirmation.svelte';
  import WithdrawStatus from '$lib/components/WithdrawStatus.svelte';
  import QRCode from '$lib/components/QRCode.svelte';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import InvoiceExpiry from '$lib/components/InvoiceExpiry.svelte';
  import MintHealthIndicator from '$lib/components/MintHealthIndicator.svelte';
  import { addTransaction, updateTransaction, getTransactions, type WalletTransaction } from '$lib/walletHistory';

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

  // Mint health and operation guard
  let mintHealthy = $state(false);
  let isOperationInFlight = $state(false);

  // Withdraw tab state
  let withdrawInput = $state('')
  let withdrawAmount = $state<number | null>(null)
  let inputType = $state<'bolt11' | 'lightning_address' | 'lnurl' | 'invalid'>('invalid')
  let estimatedFee = $state<number | null>(null)
  let isResolvingLnAddress = $state(false)

  // Withdraw confirmation/status
  let showWithdrawConfirmation = $state(false)
  let withdrawStatus = $state<'pending' | 'processing' | 'complete' | 'failed'>('pending')
  let withdrawError = $state<string | null>(null)
  let withdrawPreimage = $state<string | null>(null)

  // Unified history
  let unifiedHistory = $state<WalletTransaction[]>([])
  let historyFilter = $state<'all' | 'deposits' | 'withdrawals'>('all')
  let filteredHistory = $derived(
    historyFilter === 'all' ? unifiedHistory :
    historyFilter === 'deposits' ? unifiedHistory.filter(t => t.type === 'deposit') :
    unifiedHistory.filter(t => t.type === 'withdrawal')
  )

  // Receive/token state
  let receiveTokenInput = $state('');
  let isReceiving = $state(false);
  let receiveError = $state<string | null>(null);
  let receiveSuccess = $state(false);

  // Transaction history
  let deposits = $state<Deposit[]>([]);
  let activeTab = $state<'deposit' | 'withdraw' | 'history' | 'receive'>('deposit');

  onMount(async () => {
    // Initialize Nostr and wallet stores
    await initNostrStore();
    await initWalletStore();
    
    // Get initial pubkey
    pubkey = getCurrentPubkey();
    
    // Load initial balance and deposits
    refreshBalance();
    loadDeposits();
    loadUnifiedHistory();
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
    isOperationInFlight = true;
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
            addTransaction({
              type: 'deposit',
              amount: confirmedAmount,
              status: 'complete'
            });
            loadUnifiedHistory();
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
      isOperationInFlight = false;
    }
  }

  function handleCancelConfirmation() {
    showConfirmation = false;
  }

  function setPresetAmount(sats: number) {
    depositAmount = String(sats);
    depositAmountError = null;
  }

  function handleWithdrawInputChange(value: string) {
    withdrawInput = value
    withdrawError = null
    inputType = detectInputType(value)

    if (inputType === 'bolt11') {
      const amount = extractAmountFromBolt11(value)
      if (amount !== null) {
        withdrawAmount = amount
        fetchFeeEstimate(amount)
      } else {
        withdrawAmount = null
        estimatedFee = null
      }
    } else if (inputType === 'lightning_address') {
      withdrawAmount = null
      estimatedFee = null
    } else if (inputType === 'lnurl' && value.trim()) {
      withdrawError = 'LNURL addresses are not supported — please use a bolt11 invoice or Lightning address'
    } else if (inputType === 'invalid' && value.trim()) {
      withdrawError = 'Invalid Lightning address or invoice'
    }
  }

  function handleAmountChange(amount: number) {
    withdrawAmount = amount
    if (amount > 0) {
      fetchFeeEstimate(amount)
    }
  }

  async function fetchFeeEstimate(amount: number) {
    try {
      const result = await estimateMeltFee(amount)
      estimatedFee = result.fee
    } catch {
      estimatedFee = Math.max(1, Math.floor(amount * 0.005))
    }
  }

  function validateWithdrawInput(): boolean {
    if (withdrawAmount === null || withdrawAmount <= 0) {
      withdrawError = 'Please enter a valid amount'
      return false
    }
    if (inputType === 'invalid' || inputType === 'lnurl') {
      withdrawError = inputType === 'lnurl'
        ? 'LNURL addresses are not supported — please use a bolt11 invoice or Lightning address'
        : 'Invalid Lightning address or invoice'
      return false
    }
    if (withdrawAmount + (estimatedFee ?? 0) > balance) {
      withdrawError = `Insufficient balance. Total needed: ${(withdrawAmount + (estimatedFee ?? 0)).toLocaleString()} sats`
      return false
    }
    return true
  }

  function handleShowWithdrawConfirmation() {
    withdrawError = null
    if (!validateWithdrawInput()) return
    showWithdrawConfirmation = true
  }

  async function handleConfirmWithdraw() {
    if (!withdrawAmount) return

    showWithdrawConfirmation = false
    withdrawStatus = 'pending'
    withdrawError = null
    withdrawPreimage = null
    isOperationInFlight = true

    const tx = addTransaction({
      type: 'withdrawal',
      amount: withdrawAmount,
      fee: estimatedFee ?? 0,
      destination: inputType === 'bolt11' ? withdrawInput.slice(0, 40) + '...' : withdrawInput,
      status: 'pending'
    })

    try {
      let invoice = withdrawInput
      if (inputType === 'lightning_address') {
        isResolvingLnAddress = true
        try {
          invoice = await resolveLightningAddress(withdrawInput, withdrawAmount * 1000)
        } finally {
          isResolvingLnAddress = false
        }
      }

      withdrawStatus = 'processing'

      const result: MeltResult = await meltTokens(withdrawAmount, invoice)

      if (result.success) {
        withdrawStatus = 'complete'
        withdrawPreimage = result.preimage ?? null
        updateTransaction(tx.id, { status: 'complete', fee: result.feePaid ?? estimatedFee ?? 0 })
        refreshBalance()
        loadUnifiedHistory()
      } else {
        withdrawStatus = 'failed'
        withdrawError = result.error?.message ?? 'Withdrawal failed'
        updateTransaction(tx.id, { status: 'failed' })
        loadUnifiedHistory()
      }
    } catch (e) {
      withdrawStatus = 'failed'
      withdrawError = e instanceof Error ? e.message : 'Withdrawal failed'
      updateTransaction(tx.id, { status: 'failed' })
      loadUnifiedHistory()
    } finally {
      isOperationInFlight = false
    }
  }

  function handleCancelWithdrawConfirmation() {
    showWithdrawConfirmation = false
  }

  function handleRetry() {
    withdrawStatus = 'pending'
    withdrawError = null
  }

  function handleReset() {
    withdrawInput = ''
    withdrawAmount = null
    inputType = 'invalid'
    estimatedFee = null
    withdrawStatus = 'pending'
    withdrawError = null
    withdrawPreimage = null
    showWithdrawConfirmation = false
  }

  function loadUnifiedHistory() {
    unifiedHistory = getTransactions()
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
      <div class="flex items-center justify-between mt-3">
        <MintHealthIndicator mintUrl={getMintUrl()} bind:mintHealthy />
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
                disabled={isCreatingDeposit || !depositAmount || isOperationInFlight || !mintHealthy}
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
            {#if currentDeposit.expiry && currentDeposit.status === 'waiting'}
              <div class="mb-4">
                <InvoiceExpiry
                  expiresAt={currentDeposit.expiry}
                  onExpired={() => { clearCurrentDeposit() }}
                />
              </div>
            {/if}

            <!-- QR code -->
            {#if currentDeposit.invoice && currentDeposit.status === 'waiting'}
              <div class="flex justify-center mb-4 bg-white p-3 w-fit mx-auto">
                <QRCode value={currentDeposit.invoice} size={192} />
              </div>
            {/if}

            <!-- Invoice string + copy button -->
            {#if currentDeposit.invoice && currentDeposit.status === 'waiting'}
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs text-neutral-500">Invoice</p>
                  <CopyButton text={currentDeposit.invoice} label="Copy invoice" />
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
      {#if showWithdrawConfirmation && withdrawAmount !== null && estimatedFee !== null}
        <WithdrawConfirmation
          amount={withdrawAmount}
          fee={estimatedFee}
          destination={withdrawInput}
          destinationType={inputType === 'lightning_address' ? 'lightning_address' : 'bolt11'}
          onConfirm={handleConfirmWithdraw}
          onCancel={handleCancelWithdrawConfirmation}
        />
      {:else if withdrawStatus !== 'pending' || (withdrawError !== null && withdrawStatus !== 'pending')}
        <WithdrawStatus
          status={withdrawStatus}
          amount={withdrawAmount ?? 0}
          fee={estimatedFee}
          error={withdrawError}
          preimage={withdrawPreimage ?? undefined}
          onretry={withdrawStatus === 'failed' ? handleRetry : undefined}
        />

        {#if withdrawStatus === 'complete'}
          <button
            onclick={handleReset}
            class="mt-4 w-full px-4 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
          >
            New withdrawal
          </button>
        {/if}
      {:else}
        <div class="bg-neutral-900 border border-neutral-800 rounded-sm p-6">
          <h2 class="text-lg font-medium text-white mb-4">Withdraw via Lightning</h2>

          <div class="mb-4">
            <label for="withdraw-input" class="block text-sm font-medium text-neutral-300 mb-2">
              Lightning Address or Invoice
            </label>
            <div class="relative">
              <textarea
                id="withdraw-input"
                value={withdrawInput}
                oninput={(e) => handleWithdrawInputChange((e.target as HTMLTextAreaElement).value)}
                placeholder="lntb... or user@domain.com"
                rows="3"
                class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none font-mono text-xs"
              ></textarea>
              {#if withdrawInput.trim()}
                <span class="absolute top-2 right-2 text-xs px-2 py-0.5 {inputType === 'bolt11' ? 'bg-neutral-800 text-neutral-300' : inputType === 'lightning_address' ? 'bg-neutral-800 text-neutral-200' : inputType === 'lnurl' ? 'bg-neutral-800 text-neutral-300' : 'bg-rose-900 text-rose-300'}">
                  {inputType === 'bolt11' ? 'Invoice' : inputType === 'lightning_address' ? 'Address' : inputType === 'lnurl' ? 'LNURL' : 'Invalid'}
                </span>
              {/if}
            </div>
          </div>

          <div class="mb-4">
            <label for="withdraw-amount" class="block text-sm font-medium text-neutral-300 mb-2">
              Amount (sats)
            </label>
            <input
              id="withdraw-amount"
              type="number"
              value={withdrawAmount ?? ''}
              oninput={(e) => handleAmountChange(parseInt((e.target as HTMLInputElement).value) || 0)}
              disabled={inputType === 'bolt11'}
              placeholder="Enter amount"
              class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 {inputType === 'bolt11' ? 'opacity-50' : ''}"
            />
            <p class="text-xs text-neutral-500 mt-1">Available: {formatSats(balance)} sats</p>
          </div>

          {#if estimatedFee !== null && withdrawAmount !== null}
            <div class="mb-4 text-xs text-neutral-500 space-y-1">
              <p>Network fee: ~{estimatedFee.toLocaleString()} sats</p>
              <p>Total: {withdrawAmount.toLocaleString()} + {estimatedFee.toLocaleString()} = {(withdrawAmount + estimatedFee).toLocaleString()} sats</p>
            </div>
          {/if}

          {#if withdrawError}
            <p class="text-rose-400 text-sm mb-4">{withdrawError}</p>
          {/if}

          {#if withdrawAmount !== null && estimatedFee !== null && withdrawAmount + estimatedFee > balance}
            <p class="text-rose-400 text-sm mb-4">Insufficient balance. Total needed: {(withdrawAmount + estimatedFee).toLocaleString()} sats</p>
          {/if}

          <button
            onclick={handleShowWithdrawConfirmation}
            disabled={withdrawAmount === null || withdrawAmount <= 0 || inputType === 'invalid' || inputType === 'lnurl' || isResolvingLnAddress || (withdrawAmount + (estimatedFee ?? 0) > balance) || isOperationInFlight || !mintHealthy}
            class="w-full px-4 py-2.5 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {isResolvingLnAddress ? 'Resolving Lightning address...' : 'Continue'}
          </button>
        </div>
      {/if}

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
      <div>
        <!-- Filter tabs -->
        <div class="flex gap-1 border-b border-neutral-800 mb-4">
          {#each [['all', 'All'], ['deposits', 'Deposits'], ['withdrawals', 'Withdrawals']] as [value, label]}
            <button
              onclick={() => historyFilter = value as typeof historyFilter}
              class="px-3 py-2 text-sm font-medium transition-colors -mb-px {historyFilter === value ? 'border-b-2 border-white text-white' : 'text-neutral-500 hover:text-neutral-300'}"
            >
              {label}
            </button>
          {/each}
        </div>

        {#if filteredHistory.length === 0}
          <div class="p-8 text-center">
            <p class="text-neutral-500">No transactions yet</p>
          </div>
        {:else}
          <div class="divide-y divide-neutral-800">
            {#each filteredHistory as tx}
              <div class="py-3 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm {tx.type === 'deposit' || tx.type === 'receive' ? 'text-emerald-400' : 'text-rose-300'}">
                      {tx.type === 'deposit' || tx.type === 'receive' ? '+' : '-'}{tx.amount.toLocaleString()}
                    </span>
                    <span class="text-xs px-1.5 py-0.5 {tx.status === 'complete' ? 'bg-emerald-900 text-emerald-400' : tx.status === 'failed' ? 'bg-rose-900 text-rose-400' : 'bg-neutral-800 text-neutral-300'}">
                      {tx.status}
                    </span>
                    <span class="text-xs text-neutral-600">{tx.type}</span>
                  </div>
                  {#if tx.destination}
                    <p class="text-xs text-neutral-500 mt-0.5">{tx.destination}</p>
                  {/if}
                </div>
                <span class="text-xs text-neutral-500">{formatDate(tx.timestamp)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>
