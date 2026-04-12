import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  buildCallbackUrl,
  createOauthSession,
  getSocialAuthConfig,
  popupCompletionResponse
} from '$lib/server/social-auth';

export const GET: RequestHandler = ({ cookies, url }) => {
  const { googleClientId } = getSocialAuthConfig();
  if (!googleClientId) {
    return popupCompletionResponse({
      error: 'Google login is not configured on this deployment.'
    });
  }

  const { challenge, state } = createOauthSession('google', cookies);
  const callbackUrl = buildCallbackUrl(url, 'google');
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent select_account'
  });

  throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
