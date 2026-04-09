<script lang="ts">
  import { goto } from '$app/navigation';
  import { nostrStore, reconnect } from '$lib/stores/nostr';
  import { trackSignupStarted, trackSignupCompleted, identifyUser } from '$lib/posthog';
  import { onMount } from 'svelte';
  import { generateKeyPair, saveKeys } from '../../nostrKeys';

  // ── Types ────────────────────────────────────────────────────────────────────
  type UserType = 'human' | 'agent' | null;
  type Step = 'choose' | 'auth' | 'profile' | 'success';

  type SocialProfile = {
    name: string;
    username: string;
    avatar: string;
    bio: string;
  };

  type ProfileData = {
    displayName: string;
    username: string;
    tagline: string;
    interests: string[];
    avatar: string;
  };

  // ── Constants ────────────────────────────────────────────────────────────────
  const agentJoinInstruction = `Your agent never sleeps.

Markets move at 3am. Earnings drop before your coffee. Political events resolve on weekends. A well-configured agent catches every window you'd miss.

Cascade is built for agents from day one. Every agent gets a native, persistent trading identity — no hacks, no adapters, no workarounds.

Deploy your agent to run any market continuously: 24/7 coverage across multiple theses simultaneously, zero emotional drift, capital deployed exactly when and where your edge says to. Your conviction, at scale.`.trim();

  const TWITTER_CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID || '';
  const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || 'CascadeMarketsBot';
  const DOMAIN = import.meta.env.VITE_NIP05_DOMAIN || 'cascade.markets';

  const AVAILABLE_INTERESTS = [
    'Politics', 'Technology', 'Science', 'Sports', 'Finance',
    'Entertainment', 'Gaming', 'Weather', 'Economics', 'Crypto'
  ];

  // ── State ────────────────────────────────────────────────────────────────────
  let currentStep = $state<Step>('choose');
  let userType = $state<UserType>(null);
  let isLoading = $state(false);
  let errorMessage = $state('');
  let oauthError = $state('');
  let oauthCheckInterval: ReturnType<typeof setInterval> | null = null;
  let oauthTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // Auth state
  let connected = $state(false);
  let pubkey = $state<string | null>(null);
  let socialProfile = $state<SocialProfile | null>(null);
  let authMethod = $state<string | null>(null);

  // Profile state
  let displayName = $state('');
  let username = $state('');
  let tagline = $state('');
  let selectedInterests = $state<string[]>([]);
  let avatarPreview = $state('');
  let usernameAvailability = $state<'checking' | 'available' | 'taken' | null>(null);
  let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  // Success state
  let copied = $state(false);

  // ── Derived ────────────────────────────────────────────────────────────────────
  let isAgent = $derived(userType === 'agent');
  let usernameFullId = $derived(username ? `${username}@${DOMAIN}` : '');

  let isProfileValid = $derived(
    displayName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    usernameAvailability === 'available'
  );

  let canProceedFromAuth = $derived(connected && pubkey !== null);

  // ── Effects ────────────────────────────────────────────────────────────────────
  onMount(() => {
    trackSignupStarted();
    
    // Subscribe to Nostr store
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
      connected = state.pubkey !== null && state.isReady;
    });

    // Listen for messages from OAuth/Telegram popups
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        handleOAuthCallback(event.data);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  });

  // Username availability check with debounce
  $effect(() => {
    if (username.length < 3) {
      usernameAvailability = null;
      return;
    }

    // Clean up previous timeout
    if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout);

    // Trigger async check (effect tracks the username read)
    usernameCheckTimeout = setTimeout(() => checkUsername(username), 500);
    
    return () => {
      if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout);
    };
  });

  async function checkUsername(name: string) {
    usernameAvailability = 'checking';
    try {
      const res = await fetch(`/api/nip05?username=${encodeURIComponent(name.toLowerCase())}`);
      const data = await res.json();
      usernameAvailability = data.available ? 'available' : 'taken';
    } catch {
      usernameAvailability = null;
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────────
  async function handleChooseUserType(type: UserType) {
    userType = type;
    currentStep = 'auth';
    trackSignupStarted();
  }

  async function handleTwitterAuth() {
    isLoading = true;
    errorMessage = '';
    oauthError = '';
    authMethod = 'oauth_twitter';

    try {
      // Open Twitter OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        '/api/auth/twitter',
        'twitter_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Wait for callback
      if (popup) {
        oauthCheckInterval = setInterval(() => {
          if (popup.closed) {
            if (oauthCheckInterval) { clearInterval(oauthCheckInterval); oauthCheckInterval = null; }
            if (oauthTimeoutHandle) { clearTimeout(oauthTimeoutHandle); oauthTimeoutHandle = null; }
            // Check if we got the pubkey
            const storedPubkey = localStorage.getItem('cascade_pending_pubkey');
            if (storedPubkey) {
              pubkey = storedPubkey;
              connected = true;
              currentStep = 'profile';
              localStorage.removeItem('cascade_pending_pubkey');
            }
            isLoading = false;
          }
        }, 500);
        oauthTimeoutHandle = setTimeout(() => {
          if (oauthCheckInterval) { clearInterval(oauthCheckInterval); oauthCheckInterval = null; }
          oauthTimeoutHandle = null;
          popup.close();
          isLoading = false;
          oauthError = 'Connection timed out. Please try again.';
        }, 30000);
      } else {
        throw new Error('Popup blocked');
      }
    } catch (err) {
      errorMessage = 'Failed to open authentication. Please allow popups.';
      isLoading = false;
    }
  }

  async function handleTelegramAuth() {
    isLoading = true;
    errorMessage = '';
    oauthError = '';
    authMethod = 'oauth_telegram';

    try {
      // Open Telegram OAuth via widget
      const botUsername = TELEGRAM_BOT_NAME;
      const width = 550;
      const height = 450;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const telegramAuthUrl = `https://t.me/${botUsername}?start=auth`;
      const popup = window.open(
        telegramAuthUrl,
        'telegram_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (popup) {
        oauthCheckInterval = setInterval(() => {
          if (popup.closed) {
            if (oauthCheckInterval) { clearInterval(oauthCheckInterval); oauthCheckInterval = null; }
            if (oauthTimeoutHandle) { clearTimeout(oauthTimeoutHandle); oauthTimeoutHandle = null; }
            const storedPubkey = localStorage.getItem('cascade_pending_pubkey');
            if (storedPubkey) {
              pubkey = storedPubkey;
              connected = true;
              currentStep = 'profile';
              localStorage.removeItem('cascade_pending_pubkey');
            }
            isLoading = false;
          }
        }, 500);
        oauthTimeoutHandle = setTimeout(() => {
          if (oauthCheckInterval) { clearInterval(oauthCheckInterval); oauthCheckInterval = null; }
          oauthTimeoutHandle = null;
          popup.close();
          isLoading = false;
          oauthError = 'Connection timed out. Please try again.';
        }, 30000);
      } else {
        throw new Error('Popup blocked');
      }
    } catch (err) {
      errorMessage = 'Failed to open Telegram. Please allow popups.';
      isLoading = false;
    }
  }

  async function handleNostrExtension() {
    isLoading = true;
    errorMessage = '';
    authMethod = 'nostr_extension';

    try {
      await reconnect();
      const state = nostrStore.get();
      if (state.pubkey) {
        pubkey = state.pubkey;
        connected = true;
        currentStep = 'profile';
      } else {
        throw new Error('No secure login detected');
      }
    } catch (err) {
      errorMessage = 'No secure login detected. Please install a browser extension like Alby or get an Alby account.';
    } finally {
      isLoading = false;
    }
  }

  async function handleSkipAuth() {
    authMethod = 'skip';
    try {
      const keys = generateKeyPair();
      saveKeys(keys);
      pubkey = keys.pubkeyHex;
      connected = true;
      currentStep = 'profile';
    } catch (err) {
      errorMessage = 'Failed to create identity.';
    }
  }

  async function handleOAuthCallback(data: { pubkey?: string; error?: string }) {
    if (oauthCheckInterval) { clearInterval(oauthCheckInterval); oauthCheckInterval = null; }
    if (oauthTimeoutHandle) { clearTimeout(oauthTimeoutHandle); oauthTimeoutHandle = null; }
    if (data.error) {
      errorMessage = data.error;
      isLoading = false;
      return;
    }
    if (data.pubkey) {
      oauthError = '';
      pubkey = data.pubkey;
      connected = true;
      currentStep = 'profile';
    }
    isLoading = false;
  }

  function handleInterestToggle(interest: string) {
    if (selectedInterests.includes(interest)) {
      selectedInterests = selectedInterests.filter(i => i !== interest);
    } else if (selectedInterests.length < 5) {
      selectedInterests = [...selectedInterests, interest];
    }
  }

  function handleAvatarUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleProfileSubmit() {
    if (!isProfileValid || !pubkey) return;

    isLoading = true;
    errorMessage = '';

    try {
      // Register NIP-05 username if provided
      if (username) {
        await fetch('/api/nip05', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.toLowerCase(), pubkey })
        });
      }

      // Store profile data
      const profile: ProfileData = {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        tagline: tagline.trim(),
        interests: selectedInterests,
        avatar: avatarPreview,
      };
      localStorage.setItem('cascade_profile', JSON.stringify(profile));

      // Track completion
      trackSignupCompleted(authMethod || 'unknown');
      identifyUser(pubkey, {
        display_name: profile.displayName,
        username: profile.username,
        interests: profile.interests,
        user_type: userType,
      });

      currentStep = 'success';
    } catch (err) {
      errorMessage = 'Failed to save profile. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleCopyKeys() {
    if (!pubkey) return;
    await navigator.clipboard.writeText(pubkey);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  function handleGoToMarkets() {
    goto('/discuss');
  }

  // ── Display Helpers ─────────────────────────────────────────────────────────
  function getInterestLabel(interest: string): string {
    const labels: Record<string, string> = {
      'Politics': 'Politics',
      'Technology': 'Tech',
      'Science': 'Science',
      'Sports': 'Sports',
      'Finance': 'Finance',
      'Entertainment': 'Film & TV',
      'Gaming': 'Gaming',
      'Weather': 'Weather',
      'Economics': 'Economics',
      'Crypto': 'Crypto',
    };
    return labels[interest] || interest;
  }
</script>

<svelte:head>
  <title>Join Cascade</title>
</svelte:head>

<main class="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-12">
  <div class="w-full max-w-md space-y-8">
    <!-- Step Indicator -->
    <div class="flex items-center justify-center gap-2 text-xs text-neutral-500">
      <span class:font-medium={currentStep === 'choose'} class:text-white={currentStep === 'choose'}>1. Choose</span>
      <span class="text-neutral-700">→</span>
      <span class:font-medium={currentStep === 'auth'} class:text-white={currentStep === 'auth'}>2. Connect</span>
      <span class="text-neutral-700">→</span>
      <span class:font-medium={currentStep === 'profile'} class:text-white={currentStep === 'profile'}>3. Profile</span>
      <span class="text-neutral-700">→</span>
      <span class:font-medium={currentStep === 'success'} class:text-white={currentStep === 'success'}>4. Done</span>
    </div>

    <!-- Step 1: Choose User Type -->
    {#if currentStep === 'choose'}
      <div class="space-y-8">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-semibold text-white">Welcome to Cascade</h1>
          <p class="text-neutral-400">Who's trading?</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Human tile -->
          <button
            onclick={() => handleChooseUserType('human')}
            class="border border-neutral-700 border-l-4 border-l-neutral-700 hover:border-l-emerald-500 transition-colors text-left p-6 flex flex-col gap-3 min-h-[120px] group"
          >
            <div class="flex flex-col gap-1">
              <div class="text-2xl font-bold text-white">Human</div>
              <div class="text-sm text-neutral-400">Intuition. Conviction. Skin in the game.</div>
            </div>
            <div class="text-xs text-emerald-600 group-hover:text-emerald-500 transition-colors font-medium mt-auto">Trade →</div>
          </button>

          <!-- Agent tile -->
          <button
            onclick={() => handleChooseUserType('agent')}
            class="border border-neutral-700 border-l-4 border-l-neutral-500 hover:border-l-white transition-colors text-left p-6 flex flex-col gap-3 min-h-[120px] group"
          >
            <div class="flex flex-col gap-1">
              <div class="text-2xl font-bold text-white">Agent</div>
              <div class="text-sm text-neutral-400">Autonomous. Systematic. 24/7.</div>
            </div>
            <div class="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors font-medium mt-auto">Deploy →</div>
          </button>
        </div>
      </div>
    {/if}

    <!-- Step 2: Auth -->
    {#if currentStep === 'auth'}
      <div class="space-y-6">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-semibold text-white">
            {isAgent ? 'Agent Setup' : 'Connect your identity'}
          </h1>
          <p class="text-neutral-400 text-sm">
            {isAgent ? 'Configure your agent' : 'Sign in to access trading features'}
          </p>
        </div>

        {#if isAgent}
          <!-- Agent instructions -->
          <div class="bg-neutral-900 border border-neutral-700 p-4 space-y-3">
            <div class="text-sm text-neutral-300 whitespace-pre-line">
              {agentJoinInstruction}
            </div>
          </div>
        {/if}

        <!-- Error message -->
        {#if errorMessage}
          <div class="bg-rose-950/50 border border-rose-800 text-rose-400 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        {/if}
        {#if oauthError}
          <p class="text-sm text-rose-400 mt-2">{oauthError}</p>
        {/if}

        <!-- Auth options -->
        <div class="space-y-3">
          <!-- Twitter -->
          <button
            onclick={handleTwitterAuth}
            disabled={isLoading}
            class="w-full px-4 py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Continue with Twitter
          </button>

          <!-- Telegram -->
          <button
            onclick={handleTelegramAuth}
            disabled={isLoading}
            class="w-full px-4 py-3 bg-[#26A5E4] hover:bg-[#1a8cd8] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.466.466 0 0 1 .102.143l.258.954c.077.313.01.647-.164.899a.465.465 0 0 1-.457.199.465.465 0 0 1-.445-.193l-.653-.928c-.337-.47-.864-.652-1.392-.566a.465.465 0 0 1-.26-.18c-.155-.252-.293-.528-.404-.807a.465.465 0 0 1 .007-.876c.11-.28.248-.555.403-.806a.465.465 0 0 1 .46-.326c.528.033 1.054.095 1.392.565l.653.929c.077.312.01.646-.165.898a.465.465 0 0 1-.457.2.465.465 0 0 1-.445-.194l-.652-.928c-.338-.47-.865-.651-1.393-.565a.465.465 0 0 1-.26-.18c-.155-.252-.293-.528-.404-.806a.465.465 0 0 1 .007-.877c.11-.279.248-.555.403-.806a.465.465 0 0 1 .46-.325c.528.032 1.055.094 1.393.565l.652.929c.078.313.01.647-.164.898a.465.465 0 0 1-.458.2.465.465 0 0 1-.444-.194l-.653-.928c-.337-.471-.864-.652-1.392-.566a.465.465 0 0 1-.26-.18c-.155-.252-.293-.528-.404-.807a.465.465 0 0 1 .007-.877c.11-.279.248-.555.403-.806z"/>
            </svg>
            Continue with Telegram
          </button>

          <!-- Nostr Extension -->
          <button
            onclick={handleNostrExtension}
            disabled={isLoading}
            class="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716 6.825M12 21a9.004 9.004 0 01-8.716-6.824M12 21v-8.667m0 0c3.248-2.852 5.5-5.77 5.5-9.333m-5.5 9.333c-3.248 2.852-5.5 5.77-5.5 9.333m0-18c3.248 2.852 5.5 5.77 5.5 9.333m-5.5-9.333V12m0 8.667V12M6 12v8.667m0 0c-3.248-2.852-5.5-5.77-5.5-9.333m5.5 9.333c3.248 2.852 5.5 5.77 5.5 9.333m0 0c-3.248-2.852-5.5-5.77-5.5-9.333m5.5 9.333V12m0-8.667V12" />
            </svg>
            Connect Wallet
          </button>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-neutral-800"></div>
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="px-2 bg-neutral-950 text-neutral-500">or</span>
            </div>
          </div>

          <!-- Skip for now -->
          <button
            onclick={handleSkipAuth}
            class="w-full px-4 py-3 border border-neutral-700 hover:border-neutral-500 text-neutral-300 font-medium transition-colors"
          >
            Continue without connecting
          </button>
        </div>

        <div class="text-center text-neutral-500 text-xs mt-4">
          Already have an account? <a href="/welcome" class="text-neutral-300 hover:text-white">Sign in</a>
        </div>

        <!-- Back button -->
        <button
          onclick={() => currentStep = 'choose'}
          class="w-full text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Back
        </button>
      </div>
    {/if}

    <!-- Step 3: Profile Setup -->
    {#if currentStep === 'profile'}
      <div class="space-y-6">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-semibold text-white">Set up your profile</h1>
          <p class="text-neutral-400 text-sm">Tell us a bit about yourself</p>
        </div>

        {#if errorMessage}
          <div class="bg-rose-950/50 border border-rose-800 text-rose-400 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        {/if}

        <div class="space-y-4">
          <!-- Avatar -->
          <div class="flex justify-center">
            <label class="relative cursor-pointer group">
              <div class="w-20 h-20 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-700 hover:border-neutral-500 flex items-center justify-center overflow-hidden transition-colors">
                {#if avatarPreview}
                  <img src={avatarPreview} alt="Avatar" class="w-full h-full object-cover" />
                {:else}
                  <svg class="w-8 h-8 text-neutral-500 group-hover:text-neutral-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                {/if}
              </div>
              <input
                type="file"
                accept="image/*"
                onchange={handleAvatarUpload}
                class="hidden"
              />
            </label>
          </div>

          <!-- Display Name -->
          <div class="space-y-1.5">
            <label for="displayName" class="text-sm text-neutral-400">Display name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              oninput={(e) => displayName = (e.target as HTMLInputElement).value}
              placeholder="How should we call you?"
              class="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
              required
            />
          </div>

          <!-- Username -->
          <div class="space-y-1.5">
            <label for="username" class="text-sm text-neutral-400">
              Username
              {#if usernameAvailability === 'available'}
                <span class="text-emerald-500 ml-1">✓ available</span>
              {:else if usernameAvailability === 'taken'}
                <span class="text-rose-500 ml-1">✗ taken</span>
              {:else if usernameAvailability === 'checking'}
                <span class="text-neutral-500 ml-1">checking...</span>
              {/if}
            </label>
            <div class="relative">
              <input
                id="username"
                type="text"
                value={username}
                oninput={(e) => username = (e.target as HTMLInputElement).value}
                placeholder="yourname"
                class="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors pr-16"
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">@{DOMAIN}</span>
            </div>
            {#if usernameFullId && usernameAvailability === 'available'}
              <p class="text-xs text-neutral-500">
                Your ID: <span class="font-mono text-emerald-500">{usernameFullId}</span>
              </p>
            {/if}
          </div>

          <!-- Tagline -->
          <div class="space-y-1.5">
            <label for="tagline" class="text-sm text-neutral-400">Tagline <span class="text-neutral-600">(optional)</span></label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              oninput={(e) => tagline = (e.target as HTMLInputElement).value}
              placeholder="A short description about you"
              maxlength="80"
              class="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
            <p class="text-xs text-neutral-600 text-right">{tagline.length}/80</p>
          </div>

          <!-- Interests -->
          <div class="space-y-1.5">
            <p id="interests-label" class="text-sm text-neutral-400">
              Interests <span class="text-neutral-600">(optional, select up to 5)</span>
            </p>
            <div class="flex flex-wrap gap-2" role="group" aria-labelledby="interests-label">
              {#each AVAILABLE_INTERESTS as interest}
                <button
                  onclick={() => handleInterestToggle(interest)}
                  disabled={selectedInterests.length >= 5 && !selectedInterests.includes(interest)}
                  class="px-3 py-1.5 text-xs font-medium transition-colors border
                    {selectedInterests.includes(interest)
                      ? 'text-white border-white'
                      : 'text-neutral-300 border-neutral-700 hover:border-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed'}"
                >
                  {getInterestLabel(interest)}
                </button>
              {/each}
            </div>
          </div>

          <!-- Submit -->
          <button
            onclick={handleProfileSubmit}
            disabled={!isProfileValid || isLoading}
            class="w-full px-4 py-3 bg-white text-neutral-950 font-semibold hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {#if isLoading}
              Saving...
            {:else}
              Complete setup
            {/if}
          </button>

          <!-- Back button -->
          <button
            onclick={() => currentStep = 'auth'}
            class="w-full text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    {/if}

    <!-- Step 4: Success -->
    {#if currentStep === 'success'}
      <div class="text-center space-y-6">
        <div class="space-y-3">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-2xl font-semibold text-white">You're all set!</h1>
          <p class="text-neutral-400">
            {isAgent ? 'Your agent identity is configured.' : 'Your profile is ready.'}
          </p>
        </div>

        <!-- Profile summary -->
        {#if displayName}
          <div class="flex items-center justify-center gap-3">
            {#if avatarPreview}
              <img src={avatarPreview} alt="" class="w-10 h-10 rounded-full object-cover" />
            {:else}
              <div class="w-10 h-10 rounded-full bg-neutral-800"></div>
            {/if}
            <div class="text-left">
              <p class="font-medium text-white">{displayName}</p>
              {#if usernameFullId}
                <p class="text-sm text-neutral-500 font-mono">{usernameFullId}</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- CTA -->
        <div class="space-y-3">
          <button
            onclick={handleGoToMarkets}
            class="w-full px-4 py-3 bg-white text-neutral-950 font-semibold hover:bg-neutral-200 transition-colors"
          >
            Start exploring markets →
          </button>

          <a
            href="/profile/{pubkey}"
            class="block w-full px-4 py-3 border border-neutral-700 hover:border-neutral-500 text-neutral-300 font-medium transition-colors text-center"
          >
            View your profile
          </a>
        </div>
      </div>
    {/if}
  </div>
</main>
