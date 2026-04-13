type LinkedMarketTagInput = {
  id: string;
  direction: 'long' | 'short';
  note: string;
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function buildMarketEventTags(input: {
  title: string;
  slug: string;
  description: string;
  category: string;
  topics: string;
  linkedMarkets: LinkedMarketTagInput[];
}): string[][] {
  return [
    ['title', input.title.trim()],
    ['d', input.slug],
    ['description', input.description.trim()],
    ['status', 'open'],
    ...splitList(input.category).map((item) => ['c', item] as string[]),
    ...splitList(input.topics).map((item) => ['t', item] as string[]),
    ...input.linkedMarkets.flatMap((item) => {
      const tags: string[][] = [
        ['e', item.id, '', 'reference'],
        ['signal-direction', item.id, item.direction]
      ];
      if (item.note.trim()) {
        tags.push(['signal-note', item.id, item.note.trim()]);
      }
      return tags;
    })
  ];
}
