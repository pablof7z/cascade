/**
 * PostHog Analytics - Cascade Markets
 * 
 * Singleton PostHog instance for funnel tracking.
 * Environment variables:
 *   VITE_POSTHOG_KEY  - PostHog project API key
 *   VITE_POSTHOG_HOST - PostHog host URL (default: https://app.posthog.com)
 */

import { posthog as posthogInstance, type Properties } from 'posthog-js'

// Environment variables with fallbacks
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://app.posthog.com'

let initialized = false

/**
 * Initialize PostHog. Safe to call multiple times - only initializes once.
 */
export function initPosthog(): void {
  if (initialized || typeof window === 'undefined') return
  
  // Only initialize if we have a key
  if (!POSTHOG_KEY) {
    console.warn('[posthog] VITE_POSTHOG_KEY not set, analytics disabled')
    return
  }

  posthogInstance.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // We handle page views manually
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true, // Don't capture sensitive input data
    },
  })

  initialized = true
}

/**
 * Returns true if PostHog is initialized and ready
 */
export function isPosthogReady(): boolean {
  return initialized
}

/**
 * Get the PostHog instance for advanced usage
 */
export function getPosthog() {
  return posthogInstance
}

// ── Funnel Event Tracking ──────────────────────────────────────────────────

/**
 * Track a page view event
 */
export function trackPageView(page: string): void {
  if (!initialized) return
  posthogInstance.capture('page_view', { page })
}

/**
 * Track signup started - user begins the signup/onboarding process
 */
export function trackSignupStarted(): void {
  if (!initialized) return
  posthogInstance.capture('signup_started')
}

/**
 * Track signup completed
 * @param method - How the user connected: 'oauth_twitter' | 'oauth_telegram' | 'oauth_google' | 'skip' | 'nostr_extension' | 'manual_npub'
 */
export function trackSignupCompleted(method: string): void {
  if (!initialized) return
  posthogInstance.capture('signup_completed', { method })
}

/**
 * Track first trade started - user initiates their first trade
 */
export function trackFirstTradeStarted(): void {
  if (!initialized) return
  posthogInstance.capture('first_trade_started')
}

/**
 * Track first trade completed - user's first trade is confirmed
 */
export function trackFirstTradeCompleted(marketSlug: string, side: string, amount: number): void {
  if (!initialized) return
  posthogInstance.capture('first_trade_completed', {
    market_slug: marketSlug,
    side,
    amount,
  })
}

/**
 * Identify user after signup (associate events with user)
 */
export function identifyUser(pubkey: string, traits?: Properties): void {
  if (!initialized) return
  posthogInstance.identify(pubkey, traits)
}

/**
 * Track market created
 */
export function trackMarketCreated(marketSlug: string): void {
  if (!initialized) return
  posthogInstance.capture('market_created', { market_slug: marketSlug })
}

/**
 * Track trade placed
 */
export function trackTradePlaced(marketSlug: string, side: string, amount: number): void {
  if (!initialized) return
  posthogInstance.capture('trade_placed', {
    market_slug: marketSlug,
    side,
    amount,
  })
}

/**
 * Reset state for logout
 */
export function resetPosthog(): void {
  if (!initialized) return
  posthogInstance.reset()
}
