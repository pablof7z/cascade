import type { NDKEvent } from '@nostr-dev-kit/ndk';

export function mergeUniqueEvents(primary: NDKEvent[], secondary: NDKEvent[], limit?: number): NDKEvent[] {
  const merged: NDKEvent[] = [];
  const seen = new Set<string>();

  for (const ev of [...primary, ...secondary]) {
    const key = ev.id || ev.tagId();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    merged.push(ev);

    if (limit && merged.length >= limit) break;
  }

  return merged;
}
