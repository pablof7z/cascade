/**
 * Twitter OAuth API Route
 * 
 * Initiates OAuth flow with Twitter via NIP-98 (OAuth 2.0 for Nostr)
 * and returns the user's pubkey after authentication.
 */

import type { RequestHandler } from './$types';

// Twitter OAuth config from environment
const TWITTER_CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID || ''
const TWITTER_REDIRECT_URI = import.meta.env.VITE_TWITTER_REDIRECT_URI || 
  (typeof window !== 'undefined' ? `${window.location.origin}/api/auth/twitter/callback` : '')

/**
 * GET /api/auth/twitter
 * Initiates the Twitter OAuth flow by redirecting to Twitter's authorization page.
 */
export const GET: RequestHandler = async () => {
  if (!TWITTER_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'Twitter OAuth not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope: 'users.read tweet.read',
    state,
  })

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl,
      'X-OAuth-State': state,
    }
  })
}
