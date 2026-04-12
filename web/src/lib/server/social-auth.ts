import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import crypto from 'node:crypto';
import {
  SOCIAL_PROFILE_ERROR_STORAGE_KEY,
  SOCIAL_PROFILE_PREFILL_STORAGE_KEY,
  type SocialProfilePrefill,
  type SocialProvider
} from '$lib/features/auth/social-prefill';

const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export function getSocialAuthConfig() {
  return {
    googleClientId: firstConfigured(['GOOGLE_CLIENT_ID']),
    googleClientSecret: firstConfigured(['GOOGLE_CLIENT_SECRET']),
    telegramBotName: firstConfigured(['TELEGRAM_BOT_NAME', 'TELEGRAM_BOT_USERNAME']),
    telegramBotToken: firstConfigured(['TELEGRAM_BOT_TOKEN']),
    xClientId: firstConfigured(['X_CLIENT_ID', 'TWITTER_CLIENT_ID']),
    xClientSecret: firstConfigured(['X_CLIENT_SECRET', 'TWITTER_CLIENT_SECRET'])
  };
}

export function buildCallbackUrl(url: URL, provider: SocialProvider): string {
  return new URL(`/api/social-auth/${provider}/callback`, url.origin).toString();
}

export function createOauthSession(provider: 'google' | 'x', cookies: Cookies) {
  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  cookies.set(oauthStateCookieName(provider), state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS
  });
  cookies.set(oauthVerifierCookieName(provider), verifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS
  });

  return { state, verifier, challenge };
}

export function readOauthSession(provider: 'google' | 'x', cookies: Cookies) {
  return {
    state: cookies.get(oauthStateCookieName(provider)) ?? '',
    verifier: cookies.get(oauthVerifierCookieName(provider)) ?? ''
  };
}

export function clearOauthSession(provider: 'google' | 'x', cookies: Cookies): void {
  cookies.delete(oauthStateCookieName(provider), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/'
  });
  cookies.delete(oauthVerifierCookieName(provider), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/'
  });
}

export function popupCompletionResponse(input: {
  error?: string;
  profile?: SocialProfilePrefill;
}): Response {
  const encodedProfile = input.profile
    ? Buffer.from(JSON.stringify(input.profile), 'utf8').toString('base64')
    : '';
  const encodedError = input.error
    ? Buffer.from(input.error, 'utf8').toString('base64')
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Completing sign-in…</title>
  </head>
  <body style="margin:0;background:#0a0a0a;color:#fafafa;font:16px/1.5 Inter, system-ui, sans-serif;">
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;">
      <div>
        <p style="margin:0 0 8px;">Completing sign-in…</p>
        <p style="margin:0;color:#a3a3a3;font-size:14px;">This window can close automatically.</p>
      </div>
    </div>
    <script>
      const prefillKey = ${JSON.stringify(SOCIAL_PROFILE_PREFILL_STORAGE_KEY)};
      const errorKey = ${JSON.stringify(SOCIAL_PROFILE_ERROR_STORAGE_KEY)};
      localStorage.removeItem(prefillKey);
      localStorage.removeItem(errorKey);
      ${input.profile ? `localStorage.setItem(prefillKey, atob(${JSON.stringify(encodedProfile)}));` : ''}
      ${input.error ? `localStorage.setItem(errorKey, atob(${JSON.stringify(encodedError)}));` : ''}
      if (window.opener && !window.opener.closed) {
        window.close();
      } else {
        window.location.replace('/join');
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8'
    }
  });
}

export function telegramAuthStartResponse(input: {
  authUrl: string;
  botName: string;
}): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Telegram profile import</title>
  </head>
  <body style="margin:0;background:#0a0a0a;color:#fafafa;font:16px/1.5 Inter, system-ui, sans-serif;">
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;">
      <div style="display:grid;gap:12px;justify-items:center;text-align:center;max-width:320px;">
        <h1 style="margin:0;font-size:24px;letter-spacing:-0.04em;">Continue with Telegram</h1>
        <p style="margin:0;color:#a3a3a3;">Use Telegram to import your basic profile details, then return to Cascade.</p>
        <script async src="https://telegram.org/js/telegram-widget.js?22"
          data-telegram-login="${escapeHtmlAttribute(input.botName)}"
          data-size="large"
          data-radius="4"
          data-auth-url="${escapeHtmlAttribute(input.authUrl)}"
          data-request-access="write"></script>
      </div>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8'
    }
  });
}

export function validateTelegramAuth(
  authData: Record<string, string>,
  botToken: string
): boolean {
  const expectedHash = authData.hash ?? '';
  const comparable = { ...authData };
  delete comparable.hash;

  const dataCheckString = Object.keys(comparable)
    .sort()
    .map((key) => `${key}=${comparable[key] ?? ''}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const authDate = Number.parseInt(authData.auth_date ?? '0', 10);
  const now = Math.floor(Date.now() / 1000);
  const freshEnough = Number.isFinite(authDate) && now - authDate <= 3600;

  return hash === expectedHash && freshEnough;
}

function oauthStateCookieName(provider: 'google' | 'x'): string {
  return `cascade_${provider}_oauth_state`;
}

function oauthVerifierCookieName(provider: 'google' | 'x'): string {
  return `cascade_${provider}_oauth_verifier`;
}

function firstConfigured(keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
