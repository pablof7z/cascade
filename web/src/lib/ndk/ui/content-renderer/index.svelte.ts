import type { NDKEvent, NDKUser } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { Component } from 'svelte';

export type NDKWrapper = {
  kinds?: number[];
  from?: (event: NDKEvent) => NDKEvent;
};

export type HandlerInfo = {
  component: Component<{
    ndk: NDKSvelte;
    event: NDKEvent;
  }>;
  wrapper: NDKWrapper | null;
  priority: number;
};

export type MentionComponent = Component<{
  ndk: NDKSvelte;
  bech32: string;
  onclick?: (user: NDKUser) => void;
  class?: string;
}>;

export type HashtagComponent = Component<{
  ndk: NDKSvelte;
  tag: string;
  onclick?: (tag: string) => void;
  class?: string;
}>;

export type LinkComponent = Component<{
  url: string;
  onclick?: (url: string) => void;
  class?: string;
}>;

export type MediaComponent = Component<{
  url: string[];
  type?: string;
  onclick?: (urls: string[], clickedIndex: number) => void;
  class?: string;
}>;

export type UserClickCallback = (user: NDKUser) => void;
export type EventClickCallback = (event: NDKEvent) => void;
export type HashtagClickCallback = (tag: string) => void;
export type LinkClickCallback = (url: string) => void;
export type MediaClickCallback = (urls: string[], clickedIndex: number) => void;

export class ContentRenderer {
  blockNsfw = true;
  mentionComponent: MentionComponent | null = null;
  hashtagComponent: HashtagComponent | null = null;
  linkComponent: LinkComponent | null = null;
  mediaComponent: MediaComponent | null = null;
  fallbackComponent: Component<{
    ndk: NDKSvelte;
    event: NDKEvent;
    class?: string;
  }> | null = null;

  onUserClick?: UserClickCallback;
  onEventClick?: EventClickCallback;
  onHashtagClick?: HashtagClickCallback;
  onLinkClick?: LinkClickCallback;
  onMediaClick?: MediaClickCallback;

  private handlers = new Map<number, HandlerInfo>();
  private mentionPriority = 0;
  private hashtagPriority = 0;
  private linkPriority = 0;
  private mediaPriority = 0;
  private fallbackPriority = 0;

  addKind(target: NDKWrapper | number[], component: Component<any>, priority = 1): void {
    if (Array.isArray(target)) {
      for (const kind of target) {
        const existing = this.handlers.get(kind);
        if (!existing || priority >= existing.priority) {
          this.handlers.set(kind, { component, wrapper: null, priority });
        }
      }
      return;
    }

    const kinds = target.kinds || [];
    const wrapper = target.from ? target : null;

    for (const kind of kinds) {
      const existing = this.handlers.get(kind);
      if (!existing || priority >= existing.priority) {
        this.handlers.set(kind, { component, wrapper, priority });
      }
    }
  }

  setMentionComponent(component: MentionComponent | null, priority = 1): void {
    if (priority >= this.mentionPriority) {
      this.mentionComponent = component;
      this.mentionPriority = priority;
    }
  }

  setHashtagComponent(component: HashtagComponent | null, priority = 1): void {
    if (priority >= this.hashtagPriority) {
      this.hashtagComponent = component;
      this.hashtagPriority = priority;
    }
  }

  setLinkComponent(component: LinkComponent | null, priority = 1): void {
    if (priority >= this.linkPriority) {
      this.linkComponent = component;
      this.linkPriority = priority;
    }
  }

  setMediaComponent(component: MediaComponent | null, priority = 1): void {
    if (priority >= this.mediaPriority) {
      this.mediaComponent = component;
      this.mediaPriority = priority;
    }
  }

  setFallbackComponent(component: Component<any> | null, priority = 1): void {
    if (priority >= this.fallbackPriority) {
      this.fallbackComponent = component;
      this.fallbackPriority = priority;
    }
  }

  getKindHandler(kind: number | undefined): HandlerInfo | undefined {
    if (kind === undefined) return undefined;
    return this.handlers.get(kind);
  }
}

export const defaultContentRenderer = new ContentRenderer();
