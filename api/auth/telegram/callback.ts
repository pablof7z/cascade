import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// Telegram Login Widget callback handler
// Validates the authentication data hash and extracts user profile

interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

function validateTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data
  
  // Create data check string (alphabetically sorted key=value pairs)
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n')
  
  // Create secret key from bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  
  // Calculate HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  
  // Compare hashes
  if (hmac !== hash) {
    return false
  }
  
  // Check auth_date is not too old (allow 1 hour)
  const authDate = data.auth_date
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 3600) {
    return false
  }
  
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    return redirectWithError(res, 'Telegram bot not configured')
  }

  // Extract auth data from query params
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query

  if (!id || !first_name || !auth_date || !hash) {
    return redirectWithError(res, 'Missing authentication data')
  }

  const authData: TelegramAuthData = {
    id: parseInt(id as string, 10),
    first_name: first_name as string,
    last_name: last_name as string | undefined,
    username: username as string | undefined,
    photo_url: photo_url as string | undefined,
    auth_date: parseInt(auth_date as string, 10),
    hash: hash as string
  }

  // Validate the authentication
  if (!validateTelegramAuth(authData, botToken)) {
    return redirectWithError(res, 'Invalid authentication data')
  }

  // Build profile data
  const displayName = [authData.first_name, authData.last_name]
    .filter(Boolean)
    .join(' ')

  const profileData = {
    name: displayName,
    username: authData.username || '',
    avatar: authData.photo_url || '',
    bio: ''
  }

  // Send profile data to opener window via postMessage and close popup
  const profileBase64 = Buffer.from(JSON.stringify(profileData)).toString('base64')
  
  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Telegram Login</title></head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'telegram_auth',
              profile: '${profileBase64}'
            }, '*');
            window.close();
          } else {
            // Fallback: redirect if no opener (direct navigation)
            window.location.href = '/register?telegram_profile=${profileBase64}';
          }
        </script>
        <p>Completing login...</p>
      </body>
    </html>
  `)
}

function redirectWithError(res: VercelResponse, message: string) {
  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Telegram Login</title></head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'telegram_error',
              error: '${message.replace(/'/g, "\\'")}'
            }, '*');
            window.close();
          } else {
            window.location.href = '/register?telegram_error=${encodeURIComponent(message)}';
          }
        </script>
        <p>Authentication failed...</p>
      </body>
    </html>
  `)
}
