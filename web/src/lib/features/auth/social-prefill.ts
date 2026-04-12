import { browser } from '$app/environment';

export type SocialProvider = 'google' | 'telegram' | 'x';

export type SocialProfilePrefill = {
  provider: SocialProvider;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
};

export const SOCIAL_PROFILE_PREFILL_STORAGE_KEY = 'cascade.social-profile-prefill';
export const SOCIAL_PROFILE_ERROR_STORAGE_KEY = 'cascade.social-profile-error';

export function socialProviderLabel(provider: SocialProvider): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'telegram':
      return 'Telegram';
    case 'x':
      return 'X';
  }
}

export function clearSocialProfileBootstrap(): void {
  if (!browser) return;

  window.localStorage.removeItem(SOCIAL_PROFILE_PREFILL_STORAGE_KEY);
  window.localStorage.removeItem(SOCIAL_PROFILE_ERROR_STORAGE_KEY);
}

export function storeSocialProfilePrefill(prefill: SocialProfilePrefill): void {
  if (!browser) return;

  window.localStorage.setItem(SOCIAL_PROFILE_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
  window.localStorage.removeItem(SOCIAL_PROFILE_ERROR_STORAGE_KEY);
}

export function readSocialProfilePrefill(): SocialProfilePrefill | null {
  if (!browser) return null;

  const raw = window.localStorage.getItem(SOCIAL_PROFILE_PREFILL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SocialProfilePrefill>;
    if (
      parsed.provider !== 'google' &&
      parsed.provider !== 'telegram' &&
      parsed.provider !== 'x'
    ) {
      return null;
    }

    return {
      provider: parsed.provider,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
      bio: typeof parsed.bio === 'string' ? parsed.bio : ''
    };
  } catch {
    return null;
  }
}

export function consumeSocialProfilePrefill(): SocialProfilePrefill | null {
  const prefill = readSocialProfilePrefill();
  if (!browser) return prefill;

  window.localStorage.removeItem(SOCIAL_PROFILE_PREFILL_STORAGE_KEY);
  return prefill;
}

export function storeSocialProfileError(message: string): void {
  if (!browser) return;

  window.localStorage.setItem(SOCIAL_PROFILE_ERROR_STORAGE_KEY, message);
  window.localStorage.removeItem(SOCIAL_PROFILE_PREFILL_STORAGE_KEY);
}

export function consumeSocialProfileError(): string {
  if (!browser) return '';

  const raw = window.localStorage.getItem(SOCIAL_PROFILE_ERROR_STORAGE_KEY) ?? '';
  window.localStorage.removeItem(SOCIAL_PROFILE_ERROR_STORAGE_KEY);
  return raw;
}
