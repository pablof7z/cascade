import type { VercelRequest, VercelResponse } from '@vercel/node'

// Twitter OAuth 2.0 with PKCE
// Step 2: Handle callback, exchange code for token, fetch user profile

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    })
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state, error, error_description } = req.query

  // Handle OAuth errors
  if (error) {
    return redirectWithError(res, error_description?.toString() || error.toString())
  }

  if (!code || typeof code !== 'string') {
    return redirectWithError(res, 'Missing authorization code')
  }

  // Verify state
  const cookies = parseCookies(req.headers.cookie)
  const storedState = cookies.twitter_oauth_state
  const codeVerifier = cookies.twitter_code_verifier

  if (!storedState || storedState !== state) {
    return redirectWithError(res, 'Invalid state parameter')
  }

  if (!codeVerifier) {
    return redirectWithError(res, 'Missing code verifier')
  }

  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET
  const callbackUrl = process.env.TWITTER_CALLBACK_URL || 'https://cascade.f7z.io/api/auth/twitter/callback'

  if (!clientId || !clientSecret) {
    return redirectWithError(res, 'Twitter credentials not configured')
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier
      }).toString()
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return redirectWithError(res, 'Failed to authenticate with Twitter')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url,description', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!userResponse.ok) {
      console.error('User fetch failed:', await userResponse.text())
      return redirectWithError(res, 'Failed to fetch Twitter profile')
    }

    const userData = await userResponse.json()
    const profile = userData.data

    // Clear OAuth cookies
    res.setHeader('Set-Cookie', [
      'twitter_code_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      'twitter_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    ])

    // Redirect back to onboarding with profile data
    const profileData = {
      name: profile.name || '',
      username: profile.username || '',
      avatar: profile.profile_image_url?.replace('_normal', '_400x400') || '',
      bio: profile.description || ''
    }

    const params = new URLSearchParams({
      twitter_profile: Buffer.from(JSON.stringify(profileData)).toString('base64')
    })

    res.redirect(302, `/register?${params.toString()}`)

  } catch (err) {
    console.error('Twitter OAuth error:', err)
    return redirectWithError(res, 'Authentication failed')
  }
}

function redirectWithError(res: VercelResponse, message: string) {
  const params = new URLSearchParams({ twitter_error: message })
  res.redirect(302, `/register?${params.toString()}`)
}
