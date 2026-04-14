import type { NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
import { APP_NAME, APP_TAGLINE } from '$lib/ndk/config';
import type { MarketRecord } from '$lib/ndk/cascade';
import {
  articleSummary,
  avatarUrl,
  cleanExcerptText,
  cleanText,
  displayNip05,
  displayName,
  noteExcerpt,
  noteTitle,
  truncate
} from '$lib/ndk/format';

export const SITE_NAME = APP_NAME;
export const DEFAULT_SOCIAL_IMAGE_PATH = '/og-default.png';
export const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
export const DEFAULT_SOCIAL_IMAGE_HEIGHT = 630;

export type SeoImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type SeoMetadata = {
  title: string;
  description: string;
  canonical: string;
  type?: string;
  image?: SeoImage;
  author?: string;
  username?: string;
  publishedTime?: string;
  robots?: string;
};

export function buildHomeSeo(url: URL): SeoMetadata {
  return {
    title: SITE_NAME,
    description: APP_TAGLINE,
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildPageSeo(args: {
  url: URL;
  title: string;
  description: string;
  robots?: string;
}): SeoMetadata {
  return {
    title: args.title.includes(SITE_NAME) ? args.title : `${args.title} • ${SITE_NAME}`,
    description: args.description,
    canonical: canonicalUrl(args.url),
    type: 'website',
    image: defaultImage(args.url, `${args.title} preview`),
    robots: args.robots
  };
}

export function buildMarketSeo(args: {
  url: URL;
  market: MarketRecord;
  summary?: string;
}): SeoMetadata {
  const description =
    cleanSnippet(args.summary) ||
    cleanSnippet(args.market.description) ||
    cleanSnippet(args.market.body) ||
    `${args.market.title} on ${SITE_NAME}.`;

  return {
    title: `${args.market.title} • ${SITE_NAME}`,
    description: description || `${args.market.title} on ${SITE_NAME}.`,
    canonical: canonicalUrl(args.url),
    type: 'article',
    image: {
      url: new URL(`/og/market/${encodeURIComponent(args.market.slug)}`, args.url.origin).toString(),
      alt: `${args.market.title} preview`,
      width: 1200,
      height: 630
    }
  };
}

export function buildAboutSeo(url: URL): SeoMetadata {
  return {
    title: `About ${SITE_NAME}`,
    description:
      'Cascade is a perpetual prediction market. Markets never close — mint LONG or SHORT tokens and exit at any time.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildOnboardingSeo(url: URL): SeoMetadata {
  return {
    title: `Set up your profile • ${SITE_NAME}`,
    description:
      'Create your Cascade profile and start trading predictions on any topic.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} onboarding preview`)
  };
}

export function buildProfileSeo(args: {
  url: URL;
  pubkey: string;
  profile?: NDKUserProfile;
}): SeoMetadata {
  const name = displayName(args.profile, 'Author');
  const about = cleanSnippet(args.profile?.about || args.profile?.bio);
  const imageUrl = avatarUrl(args.profile);

  return {
    title: `${name} • ${SITE_NAME}`,
    description: about || `${name}'s profile and recent writing on ${SITE_NAME}.`,
    canonical: canonicalUrl(args.url),
    type: 'profile',
    image: imageUrl
      ? {
          url: imageUrl,
          alt: `${name} profile picture`
        }
      : defaultImage(args.url, `${name} profile preview`),
    author: name,
    username: cleanText(args.profile?.name) || displayNip05(args.profile) || undefined
  };
}

export function buildNoteSeo(args: {
  url: URL;
  identifier: string;
  event: NostrEvent;
  authorPubkey: string;
  profile?: NDKUserProfile;
}): SeoMetadata {
  const authorName = displayName(args.profile, 'Author');
  const title = noteTitle(args.event);
  const previewCopy =
    args.event.kind === 30023
      ? previewSnippet(articleSummary(args.event, 220), noteExcerpt(args.event.content, 180))
      : previewSnippet(noteExcerpt(args.event.content, 220), 'A note shared over Nostr.');
  const description = truncate(`${authorName}: ${previewCopy}`, 190);

  return {
    title: `${title} • ${SITE_NAME}`,
    description,
    canonical: canonicalUrl(args.url),
    type: args.event.kind === 30023 ? 'article' : 'website',
    image: {
      url: noteImage(args.url, args.identifier),
      alt: `${title} preview`,
      width: DEFAULT_SOCIAL_IMAGE_WIDTH,
      height: DEFAULT_SOCIAL_IMAGE_HEIGHT
    },
    author: authorName,
    publishedTime: args.event.created_at
      ? new Date(args.event.created_at * 1000).toISOString()
      : undefined
  };
}

export function buildMissingSeo(url: URL, label: string): SeoMetadata {
  return {
    title: `${label} • ${SITE_NAME}`,
    description: 'The page you requested is not available right now.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${label} preview`),
    robots: 'noindex'
  };
}

function defaultImage(url: URL, alt: string): SeoImage {
  return {
    url: new URL(DEFAULT_SOCIAL_IMAGE_PATH, url.origin).toString(),
    alt,
    width: DEFAULT_SOCIAL_IMAGE_WIDTH,
    height: DEFAULT_SOCIAL_IMAGE_HEIGHT
  };
}

function noteImage(url: URL, identifier: string): string {
  return new URL(`/og/note/${encodeURIComponent(identifier)}`, url.origin).toString();
}

function canonicalUrl(url: URL): string {
  return new URL(url.pathname + url.search, url.origin).toString();
}

function cleanSnippet(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = cleanText(value);
  if (!normalized || normalized === '~' || normalized === '-' || normalized === '_') {
    return undefined;
  }
  return truncate(normalized, 180) || undefined;
}

function previewSnippet(value: string, fallback: string): string {
  const sanitized = cleanExcerptText(
    value
      .replace(/\(\s*https?:\/\/[^)]+\)/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\(\s*\)/g, ' ')
  );
  return sanitized || fallback;
}
