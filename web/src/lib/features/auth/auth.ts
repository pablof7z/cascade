import { browser } from '$app/environment';
import {
  NDKNip46Signer,
  type NDKEvent,
  type NDKUser,
  type NDKUserProfile
} from '@nostr-dev-kit/ndk';
import QRCode from 'qrcode';
import { APP_NAME } from '$lib/ndk/config';
import { avatarUrl, cleanText, displayName, displayNip05, profileIdentifier } from '$lib/ndk/format';
import { onboardingComplete } from '$lib/onboarding';

const NOSTR_CONNECT_RELAY = 'wss://relay.primal.net';

export type LoginMode = 'extension' | 'private-key' | 'remote';

type NostrConnectNdk = Parameters<typeof NDKNip46Signer.nostrconnect>[0];

export function hasNostrExtension(): boolean {
  return browser && typeof window !== 'undefined' && 'nostr' in window;
}

export function stopNostrConnectSigner(signer: NDKNip46Signer | null | undefined): void {
  signer?.stop();
}

export async function prepareRemoteSignerPairing(
  ndk: NostrConnectNdk
): Promise<{ signer: NDKNip46Signer; nostrConnectUri: string; qrCodeDataUrl: string }> {
  const signer = NDKNip46Signer.nostrconnect(ndk, NOSTR_CONNECT_RELAY, undefined, {
    name: APP_NAME
  });
  const nostrConnectUri = signer.nostrConnectUri || '';

  if (!nostrConnectUri) {
    stopNostrConnectSigner(signer);
    throw new Error("Couldn't create a connection QR code.");
  }

  const qrCodeDataUrl = await QRCode.toDataURL(nostrConnectUri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return { signer, nostrConnectUri, qrCodeDataUrl };
}

export async function fetchResolvedProfile(user: NDKUser): Promise<NDKUserProfile | undefined> {
  if (user.profile) {
    return user.profile;
  }

  try {
    return (await user.fetchProfile()) ?? user.profile ?? undefined;
  } catch {
    return user.profile ?? undefined;
  }
}

export function authUserLabel(profile: NDKUserProfile | undefined): string {
  return displayName(profile, '') || displayNip05(profile) || 'Account';
}

export function authUserMeta(profile: NDKUserProfile | undefined, npub: string): string {
  const nip05 = displayNip05(profile);
  if (nip05 && nip05 !== authUserLabel(profile)) {
    return nip05;
  }

  return 'Cascade account';
}

export function authUserInitials(profile: NDKUserProfile | undefined): string {
  const rawName =
    cleanText(profile?.displayName) ||
    cleanText(profile?.name) ||
    displayNip05(profile) ||
    'Cascade user';

  const parts = rawName
    .split(/[\s._-]+/)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'NU';

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'NU';
}

export function authUserAvatar(profile: NDKUserProfile | undefined): string | undefined {
  return avatarUrl(profile);
}

export function authProfileHref(profile: NDKUserProfile | undefined, npub: string): string {
  return `/p/${profileIdentifier(profile, npub)}`;
}

export function needsOnboarding(args: {
  user: NDKUser | null | undefined;
  profile: NDKUserProfile | undefined;
  isReadOnly: boolean;
}): boolean {
  if (!args.user || args.isReadOnly) {
    return false;
  }

  return !onboardingComplete({
    profile: args.profile
  });
}
