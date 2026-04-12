import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  buildCallbackUrl,
  createOauthSession,
  getSocialAuthConfig,
  popupCompletionResponse
} from '$lib/server/social-auth';

export const GET: RequestHandler = ({ cookies, url }) => {
  const { xClientId } = getSocialAuthConfig();
  if (!xClientId) {
    return popupCompletionResponse({
      error: 'X login is not configured on this deployment.'
    });
  }

  const { challenge, state } = createOauthSession('x', cookies);
  const callbackUrl = buildCallbackUrl(url, 'x');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: xClientId,
    redirect_uri: callbackUrl,
    scope: 'tweet.read users.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  throw redirect(302, `https://x.com/i/oauth2/authorize?${params.toString()}`);
};
