import { nip19 } from '@nostr-dev-kit/ndk';

export type ParsedNostrReference = {
  type: 'text' | 'mention' | 'event-ref';
  content: string;
  data?: string;
};

export function decodeNostrUri(uri: string): ParsedNostrReference {
  try {
    nip19.decode(uri);

    const prefix = uri.substring(0, uri.indexOf('1') + 1);
    if (prefix === 'npub1' || prefix === 'nprofile1') {
      return { type: 'mention', content: uri, data: uri };
    }

    if (prefix === 'note1' || prefix === 'nevent1' || prefix === 'naddr1') {
      return { type: 'event-ref', content: uri, data: uri };
    }
  } catch {
    // Fall back to plain text.
  }

  return { type: 'text', content: `nostr:${uri}` };
}
