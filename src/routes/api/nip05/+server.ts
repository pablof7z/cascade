/**
 * NIP-05 Username Lookup API Route
 * 
 * Checks if a username is available for registration.
 * NIP-05 format: username@domain.com or just username (defaults to our domain)
 */

import type { RequestHandler } from './$types';

const DOMAIN = import.meta.env.VITE_NIP05_DOMAIN || 'cascade.markets'

/**
 * GET /api/nip05?username=<name>
 * Checks if a NIP-05 username is available.
 * 
 * Response: { available: boolean, username: string, fullIdentifier: string }
 */
export const GET: RequestHandler = async ({ url }) => {
  const username = url.searchParams.get('username')?.toLowerCase().trim()

  if (!username) {
    return new Response(JSON.stringify({ 
      error: 'Username is required',
      available: false 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Validate username format (alphanumeric, underscores, 3-30 chars)
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return new Response(JSON.stringify({ 
      error: 'Username must be 3-30 characters, alphanumeric with underscores only',
      available: false 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Reserved usernames
  const reserved = ['admin', 'root', 'api', 'www', 'mail', 'ftp', 'support', 'help', 'nostr']
  if (reserved.includes(username)) {
    return new Response(JSON.stringify({ 
      available: false,
      username,
      fullIdentifier: `${username}@${DOMAIN}`,
      reserved: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // In production, this would query a database or the Nostr network
  // For now, return available=true (optimistic check)
  // TODO: Query NIP-05 lookup service or database for actual availability
  
  return new Response(JSON.stringify({ 
    available: true,
    username,
    fullIdentifier: `${username}@${DOMAIN}`
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * POST /api/nip05
 * Registers a NIP-05 username for a pubkey.
 * 
 * Body: { username: string, pubkey: string }
 * Response: { success: boolean, fullIdentifier: string }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json()
    const { username, pubkey } = body

    if (!username || !pubkey) {
      return new Response(JSON.stringify({ 
        error: 'Username and pubkey are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate pubkey format (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(pubkey)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid pubkey format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate username format
    if (!/^[a-z0-9_]{3,30}$/.test(username.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: 'Invalid username format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // In production, this would store the mapping in a database
    // For now, return success
    // TODO: Store username -> pubkey mapping in database
    
    return new Response(JSON.stringify({ 
      success: true,
      username: username.toLowerCase(),
      fullIdentifier: `${username.toLowerCase()}@${DOMAIN}`
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ 
      error: 'Invalid request body' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
