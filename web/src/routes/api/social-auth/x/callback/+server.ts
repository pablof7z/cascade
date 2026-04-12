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
  const oauthErrorDescription = url.searchParams.get('error_description') ?? '';
  const callbackUrl = buildCallbackUrl(url, 'x');
  const { xClientId, xClientSecret } = getSocialAuthConfig();
  const { state: storedState, verifier } = readOauthSession('x', cookies);

  clearOauthSession('x', cookies);

  if (oauthError) {
    return popupCompletionResponse({
      error: oauthErrorDescription || 'X login was cancelled.'
    });
  }

  if (!xClientId || !xClientSecret) {
    return popupCompletionResponse({
      error: 'X login is not configured on this deployment.'
    });
  }

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return popupCompletionResponse({
      error: 'X login could not be verified. Please try again.'
    });
  }

  try {
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${xClientId}:${xClientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        code_verifier: verifier
      })
    });

    if (!tokenResponse.ok) {
      return popupCompletionResponse({
        error: 'X login failed during token exchange.'
      });
    }

    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenPayload.access_token ?? '';
    if (!accessToken) {
      return popupCompletionResponse({
        error: 'X login did not return an access token.'
      });
    }

    const profileResponse = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url,description',
      {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!profileResponse.ok) {
      return popupCompletionResponse({
        error: 'X login succeeded, but Cascade could not read your profile.'
      });
    }

    const profilePayload = (await profileResponse.json()) as {
      data?: {
        description?: string;
        name?: string;
        profile_image_url?: string;
        username?: string;
      };
    };
    const profile = profilePayload.data;

    return popupCompletionResponse({
      profile: {
        provider: 'x',
        displayName: profile?.name ?? '',
        username: profile?.username ?? '',
        avatarUrl: (profile?.profile_image_url ?? '').replace('_normal', '_400x400'),
        bio: profile?.description ?? ''
      }
    });
  } catch {
    return popupCompletionResponse({
      error: 'X login failed. Please try again.'
    });
  }
};
