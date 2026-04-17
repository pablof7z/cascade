/**
 * Blog post store.
 *
 * To add a new post:
 * 1. Add a new object to the POSTS array below.
 * 2. Give it a unique `slug` — this becomes the URL (/blog/your-slug).
 * 3. Fill in the metadata (title, date, category, excerpt).
 * 4. Write the body as HTML in the `body` field.
 *
 * Posts are sorted by date (newest first) automatically.
 * No build step, no CMS, no markdown pipeline. Just this file.
 */

export type BlogCategory = 'product' | 'markets' | 'thinking' | 'company';

export interface BlogPost {
  slug: string;
  title: string;
  date: string; // ISO 8601: "2025-04-17"
  category: BlogCategory;
  excerpt: string; // One or two sentences shown in listing
  body: string; // HTML — use <p>, <h2>, <h3>, <blockquote>, <ul>, <ol>, <strong>, <em>
}

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  product: 'Product',
  markets: 'Markets',
  thinking: 'Thinking',
  company: 'Company'
};

// ─────────────────────────────────────────────
// POSTS — add new posts here, newest date first
// ─────────────────────────────────────────────

const POSTS: BlogPost[] = [
  {
    slug: 'polymarket-has-it-backwards',
    title: 'Polymarket Has It Backwards',
    date: '2025-04-17',
    category: 'thinking',
    excerpt:
      'Prediction markets built around event resolution are solving the wrong problem. The most important questions don\'t have end dates.',
    body: `
<p>Every mainstream prediction market runs the same way. Someone poses a question. It has a resolution date. On that date, an oracle — a trusted source, a committee, an API — declares a winner. Shares pay out. The market closes. Everyone moves on.</p>

<p>This is fine if you want to bet on election night. It is useless if you want to price beliefs.</p>

<h2>The resolution problem</h2>

<p>Consider a market: <em>Will AI replace 50% of white-collar jobs by 2030?</em></p>

<p>Under the standard model, you need:</p>

<ul>
  <li>A resolution date (December 31, 2030)</li>
  <li>A definition of "replace" that an oracle can verify</li>
  <li>A trusted party to make the call</li>
  <li>A mechanism to pay out</li>
</ul>

<p>Each of these is a failure point. The definition of "replace" is contested. The trusted party has an incentive to rule one way or another. The date is arbitrary — the question doesn't become more or less interesting because of the calendar. And the payout mechanism has regulatory exposure in most jurisdictions.</p>

<p>So platforms punt. They run markets on <em>Will this specific bill pass by this specific date?</em> Questions with clean binaries, clear oracles, short timeframes. Questions that are easy to administer.</p>

<p>Questions, in other words, that don't matter much.</p>

<h2>What markets are actually for</h2>

<p>The original insight behind prediction markets was elegant: prices aggregate dispersed information. A market price on a question reflects everything its participants know and believe, weighted by how much they're willing to stake on it.</p>

<p>That's powerful. But it only works if the market prices the questions worth pricing. And the questions worth pricing are the long-horizon, contested, structurally important ones: Will nuclear power make a comeback? Will the dollar lose reserve currency status? Will autonomous vehicles be mainstream before 2040?</p>

<p>These questions can't be resolved by an oracle. They don't have clean endpoints. They're live debates that evolve as evidence accumulates.</p>

<p>The right model isn't a contract that expires. It's a running market that reflects the current state of informed opinion — and moves as that opinion moves.</p>

<h2>What we built instead</h2>

<p>Cascade markets never close. There is no resolution date, no oracle, no trusted party making a call.</p>

<p>When you take a position, you're not entering a contract that pays on a binary event. You're buying a share of a continuously-priced belief. If the market moves in your direction — because new evidence emerges, because the argument shifts, because you were right earlier than everyone else — you can exit at a profit.</p>

<p>The price is the product. It's a running record of what informed traders believe right now, on the questions that actually matter.</p>

<p>Polymarket built a better horse race. We're building something else.</p>
    `.trim()
  },

  {
    slug: 'the-price-of-a-belief',
    title: 'The Price of a Belief',
    date: '2025-04-10',
    category: 'product',
    excerpt:
      'What does it mean to put a price on an opinion? A lot more than most people think — and a lot less than prediction market evangelists claim.',
    body: `
<p>People have strong opinions. They share them constantly. Twitter, Substack, podcasts, group chats — the volume of stated belief is enormous. The quality of that belief is harder to assess.</p>

<p>Putting money behind an opinion does something useful: it forces calibration. When you have to stake actual funds, you confront the gap between what you believe and how confident you actually are. Most people discover they're less certain than they sounded in the group chat.</p>

<p>This is the original promise of prediction markets. And it's real.</p>

<h2>But prices are not truth</h2>

<p>The temptation — especially among prediction market enthusiasts — is to treat market prices as ground truth. "The market says 34%." Full stop.</p>

<p>This is a mistake for several reasons.</p>

<p>First, markets price <em>what participants believe</em>, not what is actually true. If a market is thin — ten active traders — it's pricing the views of ten people, not humanity's best estimate. Cascade markets show you the price and the volume. Treat a low-liquidity market as a starting point, not a verdict.</p>

<p>Second, markets are subject to the same biases as their participants. A market dominated by tech optimists will price AI breakthroughs higher than it should. A market full of gold bugs will price dollar collapse scenarios higher than the evidence warrants. Diverse participation improves calibration. Homogeneous participation amplifies bias.</p>

<p>Third, the framing of a question shapes its price. <em>Will AI replace most knowledge workers?</em> and <em>Will AI augment most knowledge workers?</em> are different questions, but they overlap substantially. Both can trade at 60% simultaneously — not because traders are irrational, but because the framing makes them feel like different claims.</p>

<h2>What prices are good for</h2>

<p>Despite these caveats, prices do something no other mechanism does well: they surface disagreement with skin in the game.</p>

<p>When a market trades at 40% on a claim that most commentators treat as inevitable, that's information. Either the market participants know something the pundits don't, or the market is thin and miscalibrated. Both are worth knowing.</p>

<p>The discussion thread attached to every Cascade market is there for this reason. Arguments move prices. When someone posts a compelling counterargument and the price shifts, that's the mechanism working as intended. The case and the price live together, so you can evaluate both.</p>

<h2>Use it accordingly</h2>

<p>Don't come to Cascade for certainty. Come to Cascade to find out what the crowd believes about hard questions, see the argument behind the price, and put your own view on the table.</p>

<p>If you're right before the market catches up, you'll profit. If you're wrong, you'll learn something. Either outcome beats another Twitter thread that costs nothing and changes nothing.</p>
    `.trim()
  },

  {
    slug: 'markets-that-dont-close',
    title: 'Markets That Don\'t Close',
    date: '2025-04-03',
    category: 'product',
    excerpt:
      'Most prediction market positions expire worthless or pay out in a lump sum. Ours work differently — and that difference turns out to matter a lot.',
    body: `
<p>When you trade on Polymarket, you're buying a share that pays $1 if a condition is met by a deadline, and $0 if it isn't. It's a binary bet with an expiration date.</p>

<p>This model has a problem that's rarely discussed: it destroys information.</p>

<h2>What expiration costs you</h2>

<p>Imagine you took a position in January 2024 on a market about AI capabilities by end of year. Through the year, new models shipped. Benchmarks moved. The probability of the target condition shifted — sometimes up, sometimes down — as evidence accumulated.</p>

<p>But you couldn't partially exit. You couldn't move your position as the evidence changed. You were locked in to the original binary: it happens or it doesn't.</p>

<p>This is a poor model for tracking belief over time. Real opinions aren't binary. They shift continuously as evidence accumulates. The price in September should be different from the price in January, and someone who updated in September should be able to profit from that update.</p>

<h2>How Cascade works</h2>

<p>In Cascade, every market is continuously priced. There is no expiration.</p>

<p>When you take a position, you receive shares — YES or NO — priced at the current market odds. Those shares have a value at any moment based on current market prices. You can exit whenever you want at current prices.</p>

<p>This means:</p>

<ul>
  <li>If you took YES at 30¢ and new evidence pushes it to 55¢, you can exit at a profit now. You don't have to wait for a resolution event.</li>
  <li>If you took NO at 60¢ and it falls to 40¢, you can exit and take your loss without waiting for the market to expire worthless.</li>
  <li>If nothing has changed and you still hold the same view, you hold your position and wait.</li>
</ul>

<p>The market price is a running answer to the question: <em>what do active traders believe right now?</em></p>

<h2>What this means for questions that matter</h2>

<p>The biggest questions — geopolitical, technological, economic — don't resolve cleanly. Will the dollar lose reserve currency status? There's no date when that definitively happens or doesn't. It's a gradual process reflected in prices, trade patterns, and policy over years.</p>

<p>A binary expiration market on that question is nearly worthless. A continuously-priced market that tracks the evolution of informed opinion over years is genuinely useful.</p>

<p>This is what Cascade is designed for. The markets that matter most are the ones that don't close.</p>
    `.trim()
  }
];

// ─────────────────────────────────────────────
// Accessors — don't modify these
// ─────────────────────────────────────────────

/** All posts sorted newest first. */
export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Single post by slug. Returns undefined if not found. */
export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Posts filtered by category. */
export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

/** Format date for display: "April 17, 2025" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
