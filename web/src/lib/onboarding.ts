import { NDKBlossomList, NDKInterestList, type NDKEvent, type NDKUserProfile } from '@nostr-dev-kit/ndk';
import { cleanText } from '$lib/ndk/format';

export const DEFAULT_BLOSSOM_SERVER = 'https://blossom.primal.net';

export const INTEREST_SUGGESTIONS = [
  'nostr',
  'bitcoin',
  'technology',
  'design',
  'science',
  'politics',
  'culture',
  'philosophy',
  'history',
  'economics',
  'art',
  'books'
];

export function parseBlossomServer(value: string | null | undefined): string | null {
  const candidate = cleanText(value);
  if (!candidate) return null;

  const withProtocol = /^[a-z]+:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function blossomServerFromEvent(event: NDKEvent | null | undefined): string {
  const servers =
    event instanceof NDKBlossomList
      ? event.servers
      : (event?.tags ?? []).filter((tag) => tag[0] === 'server').map((tag) => tag[1] ?? '');

  return uniqueStrings(servers.map((server) => parseBlossomServer(server)).filter(Boolean))[0] ?? DEFAULT_BLOSSOM_SERVER;
}

export function mergeBlossomServers(primary: string, existing: string[]): string[] {
  return uniqueStrings([primary, ...existing].map((server) => parseBlossomServer(server)).filter(Boolean));
}

export function normalizeInterestTag(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeInterestTags(values: string[]): string[] {
  return uniqueStrings(values.map((value) => normalizeInterestTag(value)).filter(Boolean));
}

export function interestTagsFromEvent(event: NDKEvent | null | undefined): string[] {
  if (event instanceof NDKInterestList) {
    return normalizeInterestTags(event.interests);
  }

  return normalizeInterestTags(
    (event?.tags ?? []).filter((tag) => tag[0] === 't').map((tag) => tag[1] ?? '')
  );
}

export function profileHasBasics(profile: NDKUserProfile | undefined): boolean {
  return Boolean(cleanText(profile?.displayName) || cleanText(profile?.name));
}

export function profileHasOnboardingDetails(profile: NDKUserProfile | undefined): boolean {
  return Boolean(
    cleanText(profile?.about || profile?.bio) ||
      cleanText(profile?.picture || profile?.image) ||
      cleanText(profile?.website) ||
      cleanText(profile?.nip05)
  );
}

export function onboardingComplete(args: {
  profile?: NDKUserProfile;
}): boolean {
  return profileHasBasics(args.profile) && profileHasOnboardingDetails(args.profile);
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}
