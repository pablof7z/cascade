import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// Twitter OAuth 2.0 with PKCE
// Step 1: Redirect user to Twitter authorization page

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = process.env.TWITTER_CLIENT_ID
  const callbackUrl = process.env.TWITTER_CALLBACK_URL || 'https://cascade.f7z.io/api/auth/twitter/callback'

  if (!clientId) {
    return res.status(500).json({ error: 'Twitter client ID not configured' })
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store verifier in a secure cookie for callback
  res.setHeader('Set-Cookie', [
    `twitter_code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `twitter_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ])

  // Build Twitter authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'tweet.read users.read offline.access',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`

  // Redirect to Twitter
  res.redirect(302, authUrl)
}
