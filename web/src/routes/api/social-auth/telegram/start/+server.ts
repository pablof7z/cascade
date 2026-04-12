import type { RequestHandler } from './$types';
import {
  buildCallbackUrl,
  getSocialAuthConfig,
  popupCompletionResponse,
  telegramAuthStartResponse
} from '$lib/server/social-auth';

export const GET: RequestHandler = ({ url }) => {
  const { telegramBotName } = getSocialAuthConfig();
  if (!telegramBotName) {
    return popupCompletionResponse({
      error: 'Telegram login is not configured on this deployment.'
    });
  }

  return telegramAuthStartResponse({
    authUrl: buildCallbackUrl(url, 'telegram'),
    botName: telegramBotName
  });
};
