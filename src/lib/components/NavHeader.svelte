<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { page as pageState } from '$app/state';
  import { isTestnet, toggle, TESTNET_LABELS } from '$lib/stores/testnet';

  const isDashboardRoute = pageState.url.pathname.startsWith('/dashboard');
  import { nostrStore, reconnect, disconnect } from '$lib/stores/nostr';
  import { initWalletStore, destroyWalletStore } from '$lib/walletStore';
  import { getDisplayName } from '../../services/nostrService';
  import WalletWidget from './WalletWidget.svelte';

  // Reactive state
  let searchQuery = $state('');
  let userMenuOpen = $state(false);
  let mobileMenuOpen = $state(false);
  let userMenuRef = $state<HTMLDivElement | null>(null);
  let testnetValue = $state(false);
  let pubkey = $state<string | null>(null);
  let isReady = $state(false);
  let displayName = $state<string>('');

  // Sync with stores using $effect
  $effect(() => {
    testnetValue = isTestnet();
  });

  $effect(() => {
    const store = nostrStore.get();
    pubkey = store.pubkey;
    isReady = store.isReady;
  });

  // Initialize from nostrStore
  $effect(() => {
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
      isReady = state.isReady;
    });
    return unsubscribe;
  });

  // Load display name when pubkey changes
  $effect(() => {
    if (!pubkey) {
      displayName = '';
      return;
    }
    const currentPubkey = pubkey;
    getDisplayName(currentPubkey).then((name) => {
      if (pubkey === currentPubkey) displayName = name;
    });
  });

  // Initialize wallet store when pubkey is available, cleanup when null
  $effect(() => {
    if (pubkey !== null) {
      initWalletStore();
    } else {
      destroyWalletStore();
    }
  });

  // Close user menu when clicking outside
  $effect(() => {
    if (!userMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef && !userMenuRef.contains(event.target as Node)) {
        userMenuOpen = false;
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  // Derived values
  let path = $derived($page.url.pathname);
  
  const navItems = [
    { href: '/', label: 'Markets' },
    { href: '/activity', label: 'Activity' },
  ];

  let primaryAction = { to: '/thesis/new', label: 'Build Thesis' };

  let searchPlaceholder = 'Search markets...';

  let isLoggedIn = $derived(pubkey !== null);

  let avatarInitials = $derived(displayName ? displayName.slice(0, 1).toUpperCase() : '?');

  let abbreviatedPubkey = $derived(displayName || 'Anonymous');

  // Functions
  async function handleConnect() {
    await reconnect();
  }

  function isActive(href: string): boolean {
    if (href === '/') {
      return path === '/';
    }
    return path === href;
  }

  function getLinkClass(href: string): string {
    const active = isActive(href);
    return `px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'text-white bg-neutral-800'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
    }`;
  }

  function handleSearch(e: Event) {
    e.preventDefault();
    if (searchQuery.trim()) {
      const destination = isDashboardRoute ? '/dashboard/fields' : '/';
      goto(`${destination}?search=${encodeURIComponent(searchQuery.trim())}`);
      searchQuery = '';
    }
  }

  function closeUserMenu() {
    userMenuOpen = false;
  }
</script>

<header class="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    <div class="flex items-center gap-6">
      <a href="/" class="text-xl font-bold text-white tracking-tight">
        Cascade
      </a>
      
      {#if testnetValue}
        <button
          onclick={toggle}
          class="px-2 py-0.5 text-xs font-bold border border-neutral-600 text-neutral-400 uppercase tracking-wide hover:border-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
          title="Click to switch to mainnet"
        >
          {TESTNET_LABELS.label}
        </button>
      {:else}
        <button
          onclick={toggle}
          class="px-2 py-0.5 text-xs font-medium border border-neutral-600 text-neutral-400 uppercase tracking-wide hover:border-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
          title="Click to switch to testnet"
        >
          Mainnet
        </button>
      {/if}

      <!-- Mobile menu button -->
      <button
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
        class="block md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
        aria-label="Toggle menu"
      >
        {#if mobileMenuOpen}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        {/if}
      </button>

      <nav class="hidden md:flex items-center gap-1">
        {#each navItems as item}
          <a href={item.href} class={getLinkClass(item.href)}>
            {item.label}
          </a>
        {/each}
      </nav>
    </div>

    <div class="flex items-center gap-4">
      <!-- Search Bar -->
      <form onsubmit={handleSearch} class="hidden sm:block">
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={searchPlaceholder}
            class="w-48 lg:w-64 px-4 py-1.5 pl-9 text-sm bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
          />
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </form>

      <!-- Primary Action -->
      <a
        href={primaryAction.to}
        class="px-4 py-2 text-sm font-medium text-neutral-950 bg-white hover:bg-neutral-200 transition-colors"
      >
        {primaryAction.label}
      </a>

      <!-- Wallet Widget (desktop) -->
      {#if isLoggedIn}
        <div class="hidden sm:block">
          <WalletWidget />
        </div>
      {/if}

      <!-- User Menu or Connect Button -->
      {#if !isReady}
        <div class="w-7 h-7 rounded-sm bg-neutral-800 animate-pulse"></div>
      {:else if isLoggedIn}
        <div class="relative" bind:this={userMenuRef}>
          <button
            onclick={() => userMenuOpen = !userMenuOpen}
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-sm transition-colors"
          >
            <div class="w-7 h-7 rounded-sm bg-neutral-700 flex items-center justify-center text-white text-xs font-mono font-bold">
              {avatarInitials}
            </div>
            <span class="hidden sm:block text-xs font-mono text-neutral-400">
              {abbreviatedPubkey}
            </span>
            <svg
              class="w-4 h-4 transition-transform {userMenuOpen ? 'rotate-180' : ''}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {#if userMenuOpen}
            <div class="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 py-1 z-50">
              {#if pubkey}
                <a
                  href="/profile/{pubkey}"
                  class="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  onclick={closeUserMenu}
                >
                  View Profile
                </a>
              {/if}
              <a
                href="/bookmarks"
                class="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                onclick={closeUserMenu}
              >
                Bookmarks
              </a>
              <div class="border-t border-neutral-700 my-1"></div>
              <button
                class="block w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                onclick={() => {
                  disconnect();
                  closeUserMenu();
                }}
              >
                Disconnect
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <button
          onclick={handleConnect}
          class="text-xs font-medium text-white border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 transition-colors"
        >
          Connect Wallet
        </button>
      {/if}
    </div>
  </div>

  <!-- Mobile Navigation Menu -->
  {#if mobileMenuOpen}
    <div class="md:hidden border-t border-neutral-800 bg-neutral-950/98">
      <nav class="flex flex-col py-2">
        {#each navItems as item}
          <a
            href={item.href}
            class="{getLinkClass(item.href).replace('px-3 py-2', 'px-6 py-3')}"
            onclick={() => mobileMenuOpen = false}
          >
            {item.label}
          </a>
        {/each}

        <!-- Wallet balance in mobile menu -->
        {#if isLoggedIn}
          <div class="px-6 py-3 border-t border-neutral-800 mt-2">
            <WalletWidget />
          </div>
        {/if}
      </nav>
    </div>
  {/if}
</header>
