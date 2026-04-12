import type { Token, Tokens } from 'marked';
import { decodeNostrUri } from '../event-content/utils.js';

interface NostrMentionToken extends Tokens.Generic {
  type: 'nostr-mention';
  raw: string;
  bech32: string;
}

interface NostrEventRefToken extends Tokens.Generic {
  type: 'nostr-event-ref';
  raw: string;
  bech32: string;
}

interface NostrEmojiToken extends Tokens.Generic {
  type: 'nostr-emoji';
  raw: string;
  shortcode: string;
  url?: string;
}

interface NostrHashtagToken extends Tokens.Generic {
  type: 'nostr-hashtag';
  raw: string;
  tag: string;
}

export interface NostrExtensionsOptions {
  emojiTags?: string[][];
}

export function createNostrMarkdownExtensions(options: NostrExtensionsOptions = {}) {
  const emojiMap = new Map<string, string>();

  for (const [type, shortcode, url] of options.emojiTags ?? []) {
    if (type === 'emoji' && shortcode && url) {
      emojiMap.set(shortcode, url);
    }
  }

  const extensions: any[] = [
    {
      name: 'nostr-mention',
      level: 'inline' as const,
      start(src: string) {
        const index = src.indexOf('nostr:');
        if (index === -1) return -1;
        return /^nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/i.test(src.substring(index))
          ? index
          : -1;
      },
      tokenizer(src: string) {
        const match = /^nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+)/i.exec(src);
        if (!match) return undefined;

        const bech32 = match[1];
        const segment = decodeNostrUri(bech32);
        if (segment.type !== 'mention') return undefined;

        return {
          type: 'nostr-mention',
          raw: match[0],
          bech32
        } as NostrMentionToken;
      },
      renderer(token: Token) {
        const mentionToken = token as NostrMentionToken;
        return `<span class="nostr-mention" data-bech32="${mentionToken.bech32}">nostr:${mentionToken.bech32}</span>`;
      }
    },
    {
      name: 'nostr-event-ref',
      level: 'inline' as const,
      start(src: string) {
        const index = src.indexOf('nostr:');
        if (index === -1) return -1;
        return /^nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/i.test(
          src.substring(index)
        )
          ? index
          : -1;
      },
      tokenizer(src: string) {
        const match = /^nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/i.exec(src);
        if (!match) return undefined;

        const bech32 = match[1];
        const segment = decodeNostrUri(bech32);
        if (segment.type !== 'event-ref') return undefined;

        return {
          type: 'nostr-event-ref',
          raw: match[0],
          bech32
        } as NostrEventRefToken;
      },
      renderer(token: Token) {
        const eventToken = token as NostrEventRefToken;
        return `<span class="nostr-event-ref" data-bech32="${eventToken.bech32}">nostr:${eventToken.bech32}</span>`;
      }
    },
    {
      name: 'nostr-hashtag',
      level: 'inline' as const,
      start(src: string) {
        const index = src.search(/(?:^|\s)#/);
        return index === -1 ? -1 : index === 0 ? 0 : index + 1;
      },
      tokenizer(src: string) {
        const match = /^#([a-zA-Z0-9_\u0080-\uFFFF]+)(?=\s|$|[^\w])/u.exec(src);
        if (!match) return undefined;

        return {
          type: 'nostr-hashtag',
          raw: match[0],
          tag: match[1]
        } as NostrHashtagToken;
      },
      renderer(token: Token) {
        const hashtagToken = token as NostrHashtagToken;
        return `<span class="nostr-hashtag" data-tag="${hashtagToken.tag}">#${hashtagToken.tag}</span>`;
      }
    }
  ];

  if (emojiMap.size > 0) {
    extensions.push({
      name: 'nostr-emoji',
      level: 'inline' as const,
      start(src: string) {
        const match = src.match(/:([a-zA-Z0-9_]+):/);
        return match ? src.indexOf(match[0]) : -1;
      },
      tokenizer(src: string) {
        const match = /^:([a-zA-Z0-9_]+):/.exec(src);
        if (!match) return undefined;

        const shortcode = match[1];
        const url = emojiMap.get(shortcode);
        if (!url) return undefined;

        return {
          type: 'nostr-emoji',
          raw: match[0],
          shortcode,
          url
        } as NostrEmojiToken;
      },
      renderer(token: Token) {
        const emojiToken = token as NostrEmojiToken;
        return emojiToken.url
          ? `<img class="nostr-emoji" src="${emojiToken.url}" alt=":${emojiToken.shortcode}:" data-shortcode="${emojiToken.shortcode}" />`
          : '';
      }
    });
  }

  return extensions;
}
