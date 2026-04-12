import type { RequestHandler } from './$types';
import {
  buildCallbackUrl,
  clearOauthSession,
  getSocialAuthConfig,
  popupCompletionResponse,
  readOauthSession
} from '$lib/server/social-auth';

export const GET: RequestHandler = async ({ cookies, fetch, url }) => {
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error') ?? '';
  const callbackUrl = buildCallbackUrl(url, 'google');
  const { googleClientId, googleClientSecret } = getSocialAuthConfig();
  const { state: storedState, verifier } = readOauthSession('google', cookies);

  clearOauthSession('google', cookies);

  if (oauthError) {
    return popupCompletionResponse({
      error: 'Google login was cancelled.'
    });
  }

  if (!googleClientId || !googleClientSecret) {
    return popupCompletionResponse({
      error: 'Google login is not configured on this deployment.'
    });
  }

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return popupCompletionResponse({
      error: 'Google login could not be verified. Please try again.'
    });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl
      })
    });

    if (!tokenResponse.ok) {
      return popupCompletionResponse({
        error: 'Google login failed during token exchange.'
      });
    }

    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenPayload.access_token ?? '';
    if (!accessToken) {
      return popupCompletionResponse({
        error: 'Google login did not return an access token.'
      });
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!profileResponse.ok) {
      return popupCompletionResponse({
        error: 'Google login succeeded, but Cascade could not read your profile.'
      });
    }

    const profile = (await profileResponse.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    const username = (profile.email ?? '').split('@')[0] ?? '';

    return popupCompletionResponse({
      profile: {
        provider: 'google',
        displayName: profile.name ?? '',
        username,
        avatarUrl: profile.picture ?? '',
        bio: ''
      }
    });
  } catch {
    return popupCompletionResponse({
      error: 'Google login failed. Please try again.'
    });
  }
};
