#!/usr/bin/env npx tsx

/**
 * Cascade Activity Simulator
 * 
 * Simulates real Nostr activity by publishing authentic events from hundreds of 
 * generated keypairs. All events are REAL Nostr events with real signatures.
 * 
 * Usage: npx tsx scripts/simulate.ts
 */

import { generateSecretKey, getPublicKey, finalizeEvent, getEventHash, Event, EventTemplate } from 'nostr-tools/pure';
import WebSocket from 'ws';

// ============================================================================
// Types
// ============================================================================

interface SimUser {
  privkey: string; // Stored as hex string for JSON persistence
  privkeyBytes: Uint8Array; // Raw bytes for signing
  pubkey: string;
  name: string;
  about: string;
  picture: string;
}

interface PublishedMarket {
  eventId: string;
  slug: string;
  title: string;
  creator: string;
  creatorName: string;
  category: string;
  createdAt: number;
}

interface PublishedPost {
  eventId: string;
  rootMarketId: string;
  author: string;
  authorName: string;
  stance: 'bull' | 'bear' | 'neutral';
  type: 'argument' | 'evidence' | 'rebuttal' | 'analysis';
  parentPostId?: string;
  parentAuthor?: string;
}

interface SimState {
  users: SimUser[];
  markets: PublishedMarket[];
  posts: PublishedPost[];
  lastProfileRefresh: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  userCount: parseInt(process.env.SIM_USER_COUNT || '200'),
  marketInterval: parseInt(process.env.SIM_MARKET_INTERVAL || '30') * 60 * 1000,
  postInterval: parseInt(process.env.SIM_POST_INTERVAL || '5') * 60 * 1000,
  reactionInterval: parseInt(process.env.SIM_REACTION_INTERVAL || '2') * 60 * 1000,
  tradeInterval: parseInt(process.env.SIM_TRADE_INTERVAL || '15') * 60 * 1000,
  bookmarkInterval: (30 + Math.random() * 30) * 60 * 1000,
  profileRefreshInterval: 24 * 60 * 60 * 1000,
  mintUrl: process.env.SIM_MINT_URL || 'https://mint.cascade.market',
  ollamaModel: process.env.SIM_OLLAMA_MODEL || 'qwen3.5',
  relays: (process.env.SIM_RELAYS || 'wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net,wss://relay.damus.io').split(','),
  persistPath: process.env.SIM_PERSIST || 'scripts/.sim-state.json',
  ollamaUrl: 'http://localhost:11434/api/generate',
};

const CATEGORIES = ['crypto', 'politics', 'tech', 'sports', 'science', 'culture'];
const STANCES: ('bull' | 'bear' | 'neutral')[] = ['bull', 'bear', 'neutral'];
const POST_TYPES: ('argument' | 'evidence' | 'rebuttal' | 'analysis')[] = ['argument', 'evidence', 'rebuttal', 'analysis'];

// ============================================================================
// Utility Functions
// ============================================================================

function timestamp(): string {
  const now = new Date();
  return `[${now.toTimeString().slice(0, 8)}]`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomJitter(ms: number, jitter: number = 0.3): number {
  const variation = ms * jitter * (Math.random() * 2 - 1);
  return Math.max(1000, ms + variation);
}

function shortPk(pubkey: string): string {
  return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

function generateSlug(category: string): string {
  const adjectives = ['volatile', 'stable', 'rising', 'falling', 'bullish', 'bearish', 'uncertain', 'momentum', 'breakout', 'consolidation'];
  const nouns = ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'ripple', 'cardano', 'polkadot', 'avalanche', 'chainlink', 'polygon'];
  const hex = Math.random().toString(16).slice(2, 6).padStart(4, '0');
  return `${category}-${randomItem(adjectives)}-${randomItem(nouns)}-${hex}`;
}

// ============================================================================
// State Management
// ============================================================================

let state: SimState = {
  users: [],
  markets: [],
  posts: [],
  lastProfileRefresh: Date.now(),
};

function getPersistPath(): string {
  if (CONFIG.persistPath.startsWith('/')) {
    return CONFIG.persistPath;
  }
  return `/Users/customer/Work/cascade-8f3k2m/${CONFIG.persistPath}`;
}

async function loadState(): Promise<boolean> {
  const path = getPersistPath();
  try {
    const { readFileSync, existsSync } = await import('fs');
    if (existsSync(path)) {
      const data = readFileSync(path, 'utf-8');
      const loaded = JSON.parse(data) as SimState;
      // Convert hex privkeys back to Uint8Array
      const users = (loaded.users || []).map((u: SimUser) => ({
        ...u,
        privkeyBytes: hexToUint8Array(u.privkey),
      }));
      state = {
        users,
        markets: loaded.markets || [],
        posts: loaded.posts || [],
        lastProfileRefresh: loaded.lastProfileRefresh || Date.now(),
      };
      console.log(`${timestamp()} 📦 Loaded state: ${state.users.length} users, ${state.markets.length} markets, ${state.posts.length} posts`);
      return true;
    }
  } catch (err) {
    console.log(`${timestamp()} ⚠️  Failed to load state: ${err}`);
  }
  return false;
}

async function saveState(): Promise<void> {
  const persistPath = getPersistPath();
  try {
    const { mkdirSync, writeFileSync, existsSync } = await import('fs');
    const { dirname } = await import('path');
    const dir = dirname(persistPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(persistPath, JSON.stringify(state, null, 2));
    console.log(`${timestamp()} 💾 State saved`);
  } catch (err) {
    console.log(`${timestamp()} ⚠️  Failed to save state: ${err}`);
  }
}

// ============================================================================
// Ollama Integration
// ============================================================================

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function ollamaGenerate(prompt: string, model?: string): Promise<string | null> {
  try {
    const response = await fetch(CONFIG.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || CONFIG.ollamaModel,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json() as OllamaResponse;
    return data.response.trim();
  } catch (err) {
    console.log(`${timestamp()} ⚠️  Ollama unavailable: ${err}`);
    return null;
  }
}

async function generateUsernames(count: number): Promise<string[]> {
  const prompt = `Generate ${count} unique usernames for a prediction market platform. Crypto-native, sharp, opinionated.
Format: one per line, lowercase, no spaces, 5-15 characters.
Examples: satstacker, defioracle, bearwhale, hodlprophet`;

  const result = await ollamaGenerate(prompt);
  if (!result) {
    return generateFallbackUsernames(count);
  }

  return result.split('\n').map(s => s.trim().toLowerCase()).filter(s => s.length >= 5 && s.length <= 15);
}

async function generateBios(count: number): Promise<string[]> {
  const prompt = `Generate ${count} short bios (1-2 sentences) for users on a prediction market platform. Crypto-savvy, opinionated, varying expertise levels.
Format: one per line. Be diverse and realistic.`;

  const result = await ollamaGenerate(prompt);
  if (!result) {
    return generateFallbackBios(count);
  }

  return result.split('\n').map(s => s.trim()).filter(s => s.length > 10 && s.length < 200);
}

function generateFallbackUsernames(count: number): string[] {
  const prefixes = ['satoshi', 'ninja', 'whale', 'bear', 'bull', 'crypto', 'defi', 'synth', 'yield', 'lever', 'hodl', 'stack', 'maxi', 'chad', 'alpha'];
  const suffixes = ['pro', 'ape', 'farmer', 'hunter', 'maxi', 'king', 'queen', 'lord', 'guru', 'wizard', 'degen', 'trader', 'analyst'];
  const usernames: string[] = [];
  for (let i = 0; i < count; i++) {
    usernames.push(`${randomItem(prefixes)}${randomItem(suffixes)}${Math.floor(Math.random() * 100)}`);
  }
  return usernames;
}

function generateFallbackBios(count: number): string[] {
  const bios = [
    'Early Bitcoin adopter. Been through multiple cycles. Still stacking.',
    'DeFi degem. Yield farming is my cardio.',
    'Technical analyst with a focus on on-chain metrics.',
    'Macro investor. Bonds, equities, and crypto. All connected.',
    'Former Wall Street, now fully on-chain.',
    'Predictions are just opinions. I track probabilities.',
    'Long-term thinker. Short-term trader.',
    'Building in Web3. Understanding protocols from the inside.',
    'Research driven. I read whitepapers for fun.',
    'Risk management is everything. Position sizing is survival.',
  ];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(randomItem(bios));
  }
  return result;
}

interface MarketContent {
  title: string;
  description: string;
  resolution: string;
  category: string;
}

async function generateMarketContent(category: string): Promise<MarketContent> {
  const prompt = `Create a prediction market about ${category}. 
Title (under 80 chars), description (2-3 sentences about the market), and resolution criteria.
Output as JSON with keys: title, description, resolution, category
Be specific and reference real events/topics when possible.`;

  const result = await ollamaGenerate(prompt);
  if (!result) {
    return generateFallbackMarketContent(category);
  }

  try {
    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as MarketContent;
    }
  } catch {
    console.log(`${timestamp()} ⚠️  Failed to parse Ollama market response`);
  }
  return generateFallbackMarketContent(category);
}

function generateFallbackMarketContent(category: string): MarketContent {
  const marketTemplates: Record<string, { title: string; description: string; resolution: string }[]> = {
    crypto: [
      { title: 'Will Bitcoin exceed $150,000 by end of 2025?', description: 'This market resolves YES if the price of Bitcoin exceeds $150,000 USD on any major exchange before December 31, 2025.', resolution: 'Price verified on CoinGecko or similar major data source.' },
      { title: 'Will Ethereum flip Bitcoin market cap in 2025?', description: 'This market resolves based on whether ETH market cap exceeds BTC market cap at any point in 2025.', resolution: 'Verified using market cap data from CoinGecko.' },
      { title: 'Will a major protocol launch a token in Q2?', description: 'Predicting token launches from major DeFi protocols or L2s.', resolution: 'Official announcement from the protocol team.' },
    ],
    tech: [
      { title: 'Will OpenAI release GPT-5 in 2025?', description: 'Official product announcement from OpenAI.', resolution: 'Press release or official API documentation.' },
      { title: 'Will Apple announce AR glasses this year?', description: 'Predicting Apples AR/VR product announcement.', resolution: 'Official Apple event or press release.' },
    ],
    politics: [
      { title: 'Will Fed cut rates 3+ times in 2025?', description: 'Number of Federal Reserve rate cuts in 2025.', resolution: 'FOMC official statements.' },
      { title: 'Will US pass comprehensive crypto regulation?', description: 'Federal legislation regulating digital assets.', resolution: 'Bill signed into law or definitive committee passage.' },
    ],
    sports: [
      { title: 'Will a crypto team win the Super Bowl?', description: 'A team with a major crypto sponsor wins the NFL championship.', resolution: 'Official NFL result.' },
    ],
    science: [
      { title: 'Will a major AI breakthrough happen this year?', description: 'Significant advancement in artificial general intelligence or scientific AI applications.', resolution: 'Published in peer-reviewed journal or major announcement.' },
    ],
    culture: [
      { title: 'Will Bitcoin appear in a major Hollywood film?', description: 'Featured prominently as part of the plot, not just a cameo.', resolution: 'Credit in theatrical release.' },
    ],
  };

  const templates = marketTemplates[category] || marketTemplates.crypto;
  const template = randomItem(templates);
  return { ...template, category };
}

async function generateDiscussionPost(marketTitle: string, stance: string, type: string): Promise<string> {
  const prompt = `You are a prediction market user with ${stance} stance on this market: "${marketTitle}".
Write a ${type} post (2-4 sentences) arguing your position. Be specific, opinionated, reference real events if possible. No Nostr jargon.`;

  const result = await ollamaGenerate(prompt);
  if (!result) {
    return generateFallbackPost(stance, type);
  }
  return result;
}

function generateFallbackPost(stance: string, type: string): string {
  const bullPosts = [
    'The fundamentals are stronger than ever. Adoption is accelerating and institutional interest is growing.',
    'Historical patterns suggest we are early in a major move. Accumulation phase is ending.',
    'Technical indicators are pointing to a breakout. Volume is confirming the move.',
  ];
  const bearPosts = [
    'The market is showing exhaustion signs. Profit taking is overdue.',
    'Macro conditions are not favorable. Risk assets will suffer.',
    'On-chain metrics suggest we are near a local top.',
  ];
  const neutralPosts = [
    'Need more data before forming a strong opinion. Waiting for confirmation.',
    'The market is too uncertain to make a directional bet right now.',
    'Balancing risk on both sides. Monitoring key levels.',
  ];

  const posts = stance === 'bull' ? bullPosts : stance === 'bear' ? bearPosts : neutralPosts;
  return randomItem(posts);
}

// ============================================================================
// Event Creation
// ============================================================================

function createProfileEvent(user: SimUser): Event {
  const content = JSON.stringify({
    name: user.name,
    about: user.about,
    picture: user.picture,
    nip05: `${user.name.toLowerCase().replace(/\s/g, '')}@cascade.market`,
  });

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 0,
    tags: [],
    content,
  };
}

function createMarketEvent(user: SimUser, slug: string, content: MarketContent): Event {
  const tags = [
    ['d', slug],
    ['title', content.title],
    ['description', content.description],
    ['mint', CONFIG.mintUrl],
    ['c', content.category],
  ];

  const resolution = `**Resolution Criteria:** ${content.resolution}`;
  const markdown = `# ${content.title}\n\n${content.description}\n\n${resolution}`;

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 982,
    tags,
    content: markdown,
  };
}

function createDiscussionPost(
  user: SimUser,
  market: PublishedMarket,
  stance: 'bull' | 'bear' | 'neutral',
  type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
  title: string,
  content: string,
  parentPost?: PublishedPost
): Event {
  const tags: string[][] = [
    ['e', market.eventId, '', 'root'],
    ['k', '982'],
    ['p', market.creator],
    ['stance', stance],
    ['type', type],
    ['subject', title],
  ];

  if (parentPost) {
    tags.push(['e', parentPost.eventId, '', 'reply']);
    tags.push(['k', '1111']);
    tags.push(['p', parentPost.author]);
  }

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1111,
    tags,
    content,
  };
}

function createReactionEvent(
  user: SimUser,
  targetPost: PublishedPost,
  positive: boolean
): Event {
  const tags: string[][] = [
    ['e', targetPost.eventId],
    ['p', targetPost.author],
    ['m', targetPost.rootMarketId],
  ];

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 7,
    tags,
    content: positive ? '+' : '-',
  };
}

function createPositionEvent(
  user: SimUser,
  market: PublishedMarket,
  direction: 'LONG' | 'SHORT',
  amount: number,
  price: number
): Event {
  const dTag = `cascade:position:${market.eventId}:${direction.toLowerCase()}`;
  
  const content = JSON.stringify({
    amount,
    price,
    timestamp: Math.floor(Date.now() / 1000),
  });

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 30078,
    tags: [['d', dTag]],
    content,
  };
}

function createBookmarkEvent(
  user: SimUser,
  markets: PublishedMarket[]
): Event {
  const tags: string[][] = markets.slice(0, 20).map(m => ['e', m.eventId]);

  return {
    id: '',
    sig: '',
    pubkey: user.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 10003,
    tags,
    content: '',
  };
}

// ============================================================================
// Relay Management
// ============================================================================

class RelayPool {
  private sockets: Map<string, WebSocket> = new Map();
  private pendingEvents: Map<string, Event[]> = new Map();
  private subscribedEvents: Set<string> = new Set();

  constructor(relays: string[]) {
    this.connect(relays);
  }

  private connect(relays: string[]): void {
    for (const relay of relays) {
      try {
        const ws = new WebSocket(relay, {
          handshakeTimeout: 10000,
        });

        ws.on('open', () => {
          console.log(`${timestamp()} 🔌 Connected to ${relay}`);
        });

        ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        ws.on('error', (err) => {
          console.log(`${timestamp()} ⚠️  Relay error ${relay}: ${err.message}`);
        });

        ws.on('close', () => {
          console.log(`${timestamp()} 🔌 Disconnected from ${relay}`);
          this.sockets.delete(relay);
          // Reconnect after delay
          setTimeout(() => this.connect([relay]), 5000);
        });

        this.sockets.set(relay, ws);
      } catch (err) {
        console.log(`${timestamp()} ⚠️  Failed to connect to ${relay}: ${err}`);
      }
    }
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[2]?.id) {
        this.subscribedEvents.add(msg[2].id);
      }
    } catch {
      // Ignore parse errors
    }
  }

  async publish(event: Event): Promise<boolean> {
    // Events are already signed by finalizeEvent in publish* functions
    const msg = JSON.stringify(['EVENT', event]);

    let success = false;
    for (const [relay, ws] of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg);
          success = true;
          // Simple rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.log(`${timestamp()} ⚠️  Failed to send to ${relay}: ${err}`);
        }
      }
    }
    return success;
  }

  close(): void {
    for (const ws of this.sockets.values()) {
      ws.close();
    }
    this.sockets.clear();
  }
}

// ============================================================================
// Relay pool instance
// ============================================================================

let relayPool: RelayPool;

// ============================================================================
// Publishing Functions
// ============================================================================

async function publishProfile(user: SimUser): Promise<void> {
  const event = createProfileEvent(user);
  // Sign the event before publishing
  const signedEvent = finalizeEvent(event, user.privkeyBytes);
  await relayPool.publish(signedEvent);
}

async function publishMarket(user: SimUser, slug: string, content: MarketContent): Promise<PublishedMarket | null> {
  const event = createMarketEvent(user, slug, content);
  
  // Use finalizeEvent to sign the event with nostr-tools
  const signedEvent = finalizeEvent(event, user.privkeyBytes);

  const success = await relayPool.publish(signedEvent);
  
  if (success) {
    const published: PublishedMarket = {
      eventId: signedEvent.id,
      slug,
      title: content.title,
      creator: user.pubkey,
      creatorName: user.name,
      category: content.category,
      createdAt: Date.now(),
    };
    
    console.log(`${timestamp()} 📊 Market: "${content.title}" by @${user.name}`);
    return published;
  }
  
  return null;
}

async function publishDiscussion(
  user: SimUser,
  market: PublishedMarket,
  stance: 'bull' | 'bear' | 'neutral',
  type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
  title: string,
  content: string,
  parentPost?: PublishedPost
): Promise<PublishedPost | null> {
  const event = createDiscussionPost(user, market, stance, type, title, content, parentPost);
  
  // Use finalizeEvent to sign the event with nostr-tools
  const signedEvent = finalizeEvent(event, user.privkeyBytes);

  const success = await relayPool.publish(signedEvent);
  
  if (success) {
    const post: PublishedPost = {
      eventId: signedEvent.id,
      rootMarketId: market.eventId,
      author: user.pubkey,
      authorName: user.name,
      stance,
      type,
      parentPostId: parentPost?.eventId,
      parentAuthor: parentPost?.author,
    };
    
    console.log(`${timestamp()} 💬 Post: "${title.slice(0, 50)}..." by @${user.name} (${stance} on ${market.slug})`);
    return post;
  }
  
  return null;
}

async function publishReaction(
  user: SimUser,
  targetPost: PublishedPost,
  positive: boolean
): Promise<void> {
  const event = createReactionEvent(user, targetPost, positive);
  
  // Use finalizeEvent to sign the event with nostr-tools
  const signedEvent = finalizeEvent(event, user.privkeyBytes);

  await relayPool.publish(signedEvent);
  
  const action = positive ? 'upvoted' : 'downvoted';
  console.log(`${timestamp()} ⬆️ Reaction: @${user.name} ${action} post by @${targetPost.authorName}`);
}

async function publishTrade(
  user: SimUser,
  market: PublishedMarket,
  direction: 'LONG' | 'SHORT',
  amount: number,
  price: number
): Promise<void> {
  const event = createPositionEvent(user, market, direction, amount, price);
  
  // Use finalizeEvent to sign the event with nostr-tools
  const signedEvent = finalizeEvent(event, user.privkeyBytes);

  await relayPool.publish(signedEvent);
  
  console.log(`${timestamp()} 📈 Trade: @${user.name} went ${direction} on "${market.title.slice(0, 40)}..." (${amount} sats @ ${price.toFixed(4)})`);
}

async function publishBookmark(
  user: SimUser,
  markets: PublishedMarket[]
): Promise<void> {
  if (markets.length === 0) return;
  
  const event = createBookmarkEvent(user, markets);
  
  // Use finalizeEvent to sign the event with nostr-tools
  const signedEvent = finalizeEvent(event, user.privkeyBytes);

  await relayPool.publish(signedEvent);
  
  console.log(`${timestamp()} 🔖 Bookmark: @${user.name} bookmarked ${markets.length} markets`);
}

// ============================================================================
// Main Actions
// ============================================================================

async function createNewMarket(): Promise<void> {
  if (state.users.length === 0) return;

  const user = randomItem(state.users);
  const category = randomItem(CATEGORIES);
  const slug = generateSlug(category);
  
  const content = await generateMarketContent(category);
  const published = await publishMarket(user, slug, content);
  
  if (published) {
    state.markets.push(published);
    await saveState();
  }
}

async function createNewPost(): Promise<void> {
  if (state.users.length === 0 || state.markets.length === 0) return;

  const market = randomItem(state.markets);
  const user = randomItem(state.users);
  const stance = randomItem(STANCES);
  const type = randomItem(POST_TYPES);
  
  const postTitle = `My ${type} on "${market.title.slice(0, 50)}"`;
  const content = await generateDiscussionPost(market.title, stance, type);
  
  // 30% chance to reply to existing post
  let parentPost: PublishedPost | undefined;
  if (state.posts.length > 0 && Math.random() < 0.3) {
    const rootPosts = state.posts.filter(p => p.rootMarketId === market.eventId);
    if (rootPosts.length > 0) {
      parentPost = randomItem(rootPosts);
    }
  }
  
  const published = await publishDiscussion(user, market, stance, type, postTitle, content, parentPost);
  
  if (published) {
    state.posts.push(published);
    await saveState();
  }
}

async function createNewReaction(): Promise<void> {
  if (state.users.length === 0 || state.posts.length === 0) return;

  const post = randomItem(state.posts);
  const user = randomItem(state.users);
  
  // Don't react to own posts
  if (user.pubkey === post.author) return;
  
  const positive = Math.random() > 0.2; // 80% positive
  await publishReaction(user, post, positive);
}

async function createNewTrade(): Promise<void> {
  if (state.users.length === 0 || state.markets.length === 0) return;

  const market = randomItem(state.markets);
  const user = randomItem(state.users);
  
  const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
  const amount = Math.floor(100 + Math.random() * 900); // 100-1000 sats
  const price = 0.3 + Math.random() * 0.4; // 0.3-0.7
  
  await publishTrade(user, market, direction, amount, price);
}

async function createNewBookmark(): Promise<void> {
  if (state.users.length === 0 || state.markets.length === 0) return;

  const user = randomItem(state.users);
  const bookmarkCount = Math.floor(1 + Math.random() * 5);
  const marketsToBookmark = [];
  
  // Pick random markets to bookmark
  const shuffled = [...state.markets].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(bookmarkCount, shuffled.length); i++) {
    marketsToBookmark.push(shuffled[i]);
  }
  
  await publishBookmark(user, marketsToBookmark);
}

async function refreshProfiles(): Promise<void> {
  if (state.users.length === 0) return;

  // Re-publish a batch of random profiles
  const batchSize = Math.min(20, state.users.length);
  const shuffled = [...state.users].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < batchSize; i++) {
    await publishProfile(shuffled[i]);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }
  
  state.lastProfileRefresh = Date.now();
  await saveState();
}

// ============================================================================
// Startup
// ============================================================================

async function generateUsers(count: number): Promise<SimUser[]> {
  console.log(`${timestamp()} 🔑 Generating ${count} keypairs...`);
  
  const users: SimUser[] = [];
  for (let i = 0; i < count; i++) {
    const privkeyBytes = generateSecretKey();
    const pubkey = getPublicKey(privkeyBytes);
    const privkeyHex = uint8ArrayToHex(privkeyBytes);
    
    users.push({
      privkey: privkeyHex,
      privkeyBytes,
      pubkey,
      name: `user${i}`,
      about: '',
      picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`,
    });
  }
  
  return users;
}

async function initializeUsers(): Promise<void> {
  // Load existing state or create new
  const loaded = await loadState();
  
  if (!loaded) {
    // Generate new users
    state.users = await generateUsers(CONFIG.userCount);
    
    // Generate usernames via Ollama (batch)
    console.log(`${timestamp()} 🤖 Generating usernames via Ollama...`);
    const batchSize = 50;
    for (let i = 0; i < state.users.length; i += batchSize) {
      const batch = state.users.slice(i, i + batchSize);
      const usernames = await generateUsernames(batch.length);
      batch.forEach((user, idx) => {
        user.name = usernames[idx] || `user${i + idx}`;
      });
      
      if ((i + batchSize) % 100 === 0) {
        console.log(`${timestamp()} 📝 Generated ${i + batchSize}/${state.users.length} usernames`);
      }
    }
    
    // Generate bios via Ollama (batch)
    console.log(`${timestamp()} 🤖 Generating bios via Ollama...`);
    for (let i = 0; i < state.users.length; i += batchSize) {
      const batch = state.users.slice(i, i + batchSize);
      const bios = await generateBios(batch.length);
      batch.forEach((user, idx) => {
        user.about = bios[idx] || '';
      });
    }
    
    console.log(`${timestamp()} ✅ Generated ${state.users.length} users`);
  }
  
  // Publish profiles (rate limited)
  console.log(`${timestamp()} 📤 Publishing profiles...`);
  for (let i = 0; i < state.users.length; i++) {
    await publishProfile(state.users[i]);
    
    if ((i + 1) % 50 === 0) {
      console.log(`${timestamp()} 📤 Published ${i + 1}/${state.users.length} profiles`);
    }
    
    // Rate limit: 1 per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(`${timestamp()} ✅ All profiles published`);
}

async function seedInitialMarkets(): Promise<void> {
  console.log(`${timestamp()} 🌱 Seeding initial markets...`);
  
  const initialCount = Math.min(5, Math.max(3, Math.floor(state.users.length * 0.05)));
  
  for (let i = 0; i < initialCount; i++) {
    await createNewMarket();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Space out initial markets
  }
}

// ============================================================================
// Main Loop
// ============================================================================

let running = true;

async function mainLoop(): Promise<void> {
  while (running) {
    // Schedule next market creation
    setTimeout(async () => {
      if (running) {
        await createNewMarket();
      }
    }, randomJitter(CONFIG.marketInterval));

    // Schedule next post
    setTimeout(async () => {
      if (running) {
        await createNewPost();
      }
    }, randomJitter(CONFIG.postInterval));

    // Schedule next reaction
    setTimeout(async () => {
      if (running) {
        await createNewReaction();
      }
    }, randomJitter(CONFIG.reactionInterval));

    // Schedule next trade
    setTimeout(async () => {
      if (running) {
        await createNewTrade();
      }
    }, randomJitter(CONFIG.tradeInterval));

    // Schedule bookmark update
    setTimeout(async () => {
      if (running) {
        await createNewBookmark();
      }
    }, randomJitter(CONFIG.bookmarkInterval));

    // Schedule profile refresh
    setTimeout(async () => {
      if (running) {
        await refreshProfiles();
      }
    }, CONFIG.profileRefreshInterval);

    // Wait a bit before logging status
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    if (running) {
      console.log(`${timestamp()} 📈 Status: ${state.users.length} users, ${state.markets.length} markets, ${state.posts.length} posts`);
    }
  }
}

// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Cascade Activity Simulator');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${timestamp()} ⚙️  Config:`);
  console.log(`  • Users: ${CONFIG.userCount}`);
  console.log(`  • Market interval: ${CONFIG.marketInterval / 60000} min`);
  console.log(`  • Post interval: ${CONFIG.postInterval / 60000} min`);
  console.log(`  • Reaction interval: ${CONFIG.reactionInterval / 60000} min`);
  console.log(`  • Trade interval: ${CONFIG.tradeInterval / 60000} min`);
  console.log(`  • Mint: ${CONFIG.mintUrl}`);
  console.log(`  • Ollama: ${CONFIG.ollamaModel}`);
  console.log(`  • Relays: ${CONFIG.relays.length}`);
  console.log('───────────────────────────────────────────────────────────');

  // Initialize relay pool
  relayPool = new RelayPool(CONFIG.relays);

  // Wait for relays to connect
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Initialize users
  await initializeUsers();

  // Seed initial markets if none exist
  if (state.markets.length < 3) {
    await seedInitialMarkets();
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log(`${timestamp()} 🚀 Starting main loop...`);
  console.log('═══════════════════════════════════════════════════════════');

  // Start main loop
  mainLoop().catch(console.error);
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(): Promise<void> {
  console.log(`${timestamp()} 🛑 Shutting down...`);
  running = false;
  
  await saveState();
  
  if (relayPool) {
    relayPool.close();
  }
  
  console.log(`${timestamp()} 👋 Goodbye!`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch(err => {
  console.error(`${timestamp()} 💥 Fatal error:`, err);
  process.exit(1);
});
