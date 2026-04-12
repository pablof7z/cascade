import type { RequestHandler } from './$types';
import {
  getSocialAuthConfig,
  popupCompletionResponse,
  validateTelegramAuth
} from '$lib/server/social-auth';

export const GET: RequestHandler = ({ url }) => {
  const { telegramBotToken } = getSocialAuthConfig();
  if (!telegramBotToken) {
    return popupCompletionResponse({
      error: 'Telegram login is not configured on this deployment.'
    });
  }

  const authData = Object.fromEntries(url.searchParams.entries());
  if (!authData.id || !authData.first_name || !authData.auth_date || !authData.hash) {
    return popupCompletionResponse({
      error: 'Telegram login did not return the required profile fields.'
    });
  }

  if (!validateTelegramAuth(authData, telegramBotToken)) {
    return popupCompletionResponse({
      error: 'Telegram login could not be verified. Please try again.'
    });
  }

  return popupCompletionResponse({
    profile: {
      provider: 'telegram',
      displayName: [authData.first_name, authData.last_name].filter(Boolean).join(' '),
      username: authData.username ?? '',
      avatarUrl: authData.photo_url ?? '',
      bio: ''
    }
  });
};
