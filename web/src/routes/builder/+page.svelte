<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import {
    buyMarketPosition,
    extractTradeBlindSignatureBundles,
    fetchTradeQuoteStatus,
    quoteBuyTrade,
    fetchTradeRequestStatus,
    fetchTradeStatus,
    hasCompletedTradeSettlement,
    parseJson,
    type ProductTradeQuote,
    type ProductTradeExecution,
    type ProductTradeRequestStatus,
    type ProductTradeStatus
  } from '$lib/cascade/api';
  import { NDKEvent, NDKRelaySet, type NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { getCascadeEdition, getProductApiUrl, isPaperEdition } from '$lib/cascade/config';
  import { normalizeProductTradeSide } from '$lib/cascade/tradeSide';
  import {
    clearPendingCreatorMarket,
    attachTradeReceiptQuoteId,
    clearTradeReceipt,
    listPendingCreatorMarkets,
    listTradeReceipts,
    markTradeReceiptTradeId,
    trackPendingCreatorMarket,
    trackTradeReceipt,
    type PendingCreatorMarketRecord
  } from '$lib/cascade/recovery';
  import {
    mergeCreatorMarkets,
    prunePendingCreatorMarkets,
    type AuthoredCreatorMarket
  } from '$lib/cascade/builderMarkets';
  import { buildMarketEventTags } from '$lib/cascade/marketEventTags';
  import { ensureClientNdk, ndk, waitForAnyRelayConnected } from '$lib/ndk/client';
  import { DEFAULT_RELAYS } from '$lib/ndk/config';
  import {
    getCascadeEventKinds,
    parseMarketEvent,
    parseTradeEvent,
    type MarketRecord
  } from '$lib/ndk/cascade';
  import {
    addLocalProofs,
    localProofBalance,
    removeLocalProofs,
    selectLocalProofsForAmount
  } from '$lib/wallet/localProofs';
  import {
    prepareProofOutputs,
    restorePreparedOutputs,
    unblindPreparedOutputs
  } from '$lib/wallet/cashuMint';
  import { applyLocalPositionTradeFromPayload } from '$lib/wallet/localPositionBook';
  import type { PageProps } from './$types';

  type DraftLink = {
    id: string;
    slug: string;
    title: string;
    direction: 'long' | 'short';
    note: string;
  };

  type Step = 1 | 2 | 3 | 4;

  const categories = [
    'Crypto',
    'AI',
    'Science',
    'Policy',
    'Markets',
    'Geopolitics',
    'Sports',
    'Culture'
  ];
  const suggestedTags = ['macro', 'rates', 'halving', 'ETF', 'elections', 'AGI', 'regulation', 'labor'];
  // Minor-cent denominations for quick-pick seed amounts ($25/$50/$100/$250/$500).
  const quickAmounts: number[] = [2500, 5000, 10000, 25000, 50000];
  const publicMarketRoutePollMs = 500;
  const publicMarketRouteTimeoutMs = 15_000;

  let { data }: PageProps = $props();
  const currentUser = $derived(ndk.$currentUser);

  let currentStep = $state<Step>(1);
  let claim = $state('');
  let summary = $state('');
  let caseText = $state('');
  let category = $state('');
  let tags = $state<string[]>([]);
  let tagInput = $state('');
  let imageMode = $state<'gradient' | 'url'>('gradient');
  let imageUrl = $state('');
  let linkSearch = $state('');
  let linkedMarkets = $state<DraftLink[]>([]);
  let saving = $state(false);
  let errorMessage = $state('');
  let builderStatus = $state('');
  let seedAmount = $state(10000);
  let seedSide = $state<'long' | 'short'>('long');
  let pendingCreatorMarkets = $state<PendingCreatorMarketRecord[]>([]);

  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const paperEdition = $derived(isPaperEdition(selectedEdition));
  const portfolioLabel = $derived(paperEdition ? 'practice portfolio' : 'portfolio');
  const parsedSeedAmount = $derived(seedAmount > 0 ? Math.floor(seedAmount) : 0);
  const seedDollars = $derived(Math.round(parsedSeedAmount / 100));

  const claimCharCount = $derived(claim.length);
  const caseWordCount = $derived(caseText.trim() ? caseText.trim().split(/\s+/).length : 0);

  // Advisory hints on the claim — not blocking. Spec: "✓ specific price · ✓ specific window · ✓ unambiguously resolvable".
  const hintHasNumber = $derived(/\d/.test(claim));
  const hintHasWindow = $derived(
    /(20\d\d|by |before |end of|Q[1-4]|H[12]|month|year|by end|within)/i.test(claim)
  );
  const hintResolvable = $derived(claim.trim().length >= 40);

  const canPublish = $derived(!!claim.trim() && !!category && !!caseText.trim());
  const canAdvance = $derived.by(() => {
    if (currentStep === 1) return !!claim.trim() && !!category;
    if (currentStep === 2) return !!caseText.trim();
    return true;
  });
  const isLastStep = $derived(currentStep === 4);

  const creatorMarketFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition || !currentUser) return undefined;
    return { filters: [{ kinds: [eventKinds.market], authors: [currentUser.pubkey], limit: 200 }] };
  });

  const publicMarketFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition) return undefined;
    return { filters: [{ kinds: [eventKinds.market], limit: 240 }] };
  });

  const publicTradeFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition) return undefined;
    return { filters: [{ kinds: [eventKinds.trade], limit: 480 }] };
  });

  const seededPublicMarketIds = $derived.by(() => {
    return new Set((data.markets ?? []).map((event) => event.id).filter(Boolean));
  });

  const publicTradeMarketIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const event of publicTradeFeed.events) {
      const trade = parseTradeEvent(event.rawEvent(), selectedEdition);
      if (trade?.marketId) ids.add(trade.marketId);
    }
    return ids;
  });

  const publicReferenceMarkets = $derived.by(() => {
    const merged = mergeRawEvents(data.markets ?? [], [
      ...publicMarketFeed.events,
      ...creatorMarketFeed.events
    ]);

    return merged
      .map((event) => parseMarketEvent(event, selectedEdition))
      .filter((market): market is MarketRecord => Boolean(market))
      .filter(
        (market) => seededPublicMarketIds.has(market.id) || publicTradeMarketIds.has(market.id)
      )
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const filteredMarkets = $derived.by(() => {
    const query = linkSearch.trim().toLowerCase();
    const selectedIds = new Set(linkedMarkets.map((item) => item.id));
    return publicReferenceMarkets
      .filter((market) => !selectedIds.has(market.id))
      .filter((market) => {
        if (!query) return false;
        return (
          market.title.toLowerCase().includes(query) ||
          market.description.toLowerCase().includes(query) ||
          market.slug.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  });

  // Proactive duplicate detection — simple token overlap on title keywords (≥4 chars).
  const similarMarkets = $derived.by(() => {
    const text = claim.trim().toLowerCase();
    if (text.length < 12) return [] as MarketRecord[];
    const tokens = new Set(
      text
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4)
    );
    if (tokens.size === 0) return [];
    const scored = publicReferenceMarkets
      .map((market) => {
        const haystack = `${market.title} ${market.description}`.toLowerCase();
        const hits = [...tokens].filter((token) => haystack.includes(token)).length;
        return { market, hits };
      })
      .filter((row) => row.hits >= 2)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map((row) => row.market);
    return scored;
  });

  // Local LMSR-ish estimate for the live seed math block. The real quote runs
  // server-side at publish time; these numbers are approximations so the UI
  // visibly reacts while the author sizes the seed.
  const seedMath = $derived.by(() => {
    const dollars = Math.max(seedDollars, 1);
    const liquidity = 40;
    const impliedPct = Math.min(99, Math.max(1, Math.round((dollars / (dollars + liquidity)) * 100)));
    const sidePct = seedSide === 'long' ? impliedPct : 100 - impliedPct;
    const otherPct = 100 - sidePct;
    // Approximate average fill (between 50¢ start and impliedPct end).
    const avgPct = Math.max(1, Math.round((50 + sidePct) / 2));
    const shares = Math.floor((dollars * 100) / avgPct);
    return {
      longPct: impliedPct,
      shortPct: 100 - impliedPct,
      sidePct,
      otherPct,
      avgPct,
      shares,
      liquidity: dollars
    };
  });

  const creatorMarkets = $derived.by(() => {
    const publicCreatorIds = new Set(
      publicReferenceMarkets
        .filter((market) => currentUser && market.pubkey === currentUser.pubkey)
        .map((market) => market.id)
    );
    const publicMarkets = creatorMarketFeed.events
      .map((event) => parseMarketEvent(event.rawEvent(), selectedEdition))
      .filter((market): market is MarketRecord => Boolean(market))
      .filter((market) => publicCreatorIds.has(market.id))
      .map<AuthoredCreatorMarket>((market) => ({
        eventId: market.id,
        slug: market.slug,
        title: market.title,
        createdAt: market.createdAt
      }));

    return mergeCreatorMarkets(publicMarkets, pendingCreatorMarkets);
  });

  const publicCreatorMarketIds = $derived.by(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      publicReferenceMarkets
        .filter((market) => market.pubkey === currentUser.pubkey)
        .map((market) => market.id)
    );
  });

  function proofMintUrl(): string {
    return getProductApiUrl(selectedEdition).replace(/\/+$/, '');
  }

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function addLink(market: MarketRecord) {
    linkedMarkets = [
      ...linkedMarkets,
      {
        id: market.id,
        slug: market.slug,
        title: market.title,
        direction: 'long',
        note: ''
      }
    ];
    linkSearch = '';
  }

  function removeLink(id: string) {
    linkedMarkets = linkedMarkets.filter((item) => item.id !== id);
  }

  function addTagFromInput() {
    const token = tagInput.trim().toLowerCase().replace(/^#+/, '');
    if (!token) return;
    if (!tags.includes(token)) tags = [...tags, token];
    tagInput = '';
  }

  function removeTag(token: string) {
    tags = tags.filter((item) => item !== token);
  }

  function toggleSuggestedTag(token: string) {
    const normalized = token.toLowerCase();
    tags = tags.includes(normalized)
      ? tags.filter((item) => item !== normalized)
      : [...tags, normalized];
  }

  function regenerateSummary() {
    const source = caseText.trim();
    if (!source) {
      summary = '';
      return;
    }
    const firstSentence = source.split(/[.!?]\s/)[0]?.trim() ?? source;
    summary = firstSentence.length > 220 ? firstSentence.slice(0, 217) + '...' : firstSentence;
  }

  function goStep(next: Step) {
    currentStep = next;
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nextStep() {
    if (currentStep < 4) {
      goStep((currentStep + 1) as Step);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      goStep((currentStep - 1) as Step);
    }
  }

  async function navigateToMarket(slug: string) {
    const destination = `/market/${slug}`;
    await goto(destination).catch(() => undefined);

    if (browser && window.location.pathname !== destination) {
      window.location.assign(destination);
    }
  }

  async function waitForPublicMarketRoute(slug: string): Promise<boolean> {
    if (!browser) return true;

    const destination = `/market/${slug}`;
    const deadline = Date.now() + publicMarketRouteTimeoutMs;

    while (Date.now() <= deadline) {
      try {
        const response = await fetch(destination, { cache: 'no-store' });
        if (response.ok) return true;
        if (response.status !== 404) return false;
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, publicMarketRoutePollMs));
    }

    return false;
  }

  async function openPublicMarketWhenReady(slug: string) {
    if (await waitForPublicMarketRoute(slug)) {
      await navigateToMarket(slug);
    }
  }

  function availableLocalUsdMinor(): number {
    return localProofBalance(proofMintUrl(), 'usd');
  }

  function refreshPendingCreatorMarkets() {
    pendingCreatorMarkets = currentUser ? listPendingCreatorMarkets(currentUser.pubkey) : [];
  }

  function isSignedMarketRawEvent(candidate: unknown, eventId: string): candidate is NostrEvent {
    return (
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      'kind' in candidate &&
      (candidate as { id?: unknown }).id === eventId &&
      (candidate as { kind?: unknown }).kind === eventKinds.market
    );
  }

  async function resolveBootstrapRawEvent(
    eventId: string,
    slug: string,
    rawEvent?: unknown
  ): Promise<NostrEvent | undefined> {
    if (isSignedMarketRawEvent(rawEvent, eventId)) {
      return rawEvent;
    }

    if (currentUser) {
      const pendingRawEvent = listPendingCreatorMarkets(currentUser.pubkey).find(
        (market) => market.eventId === eventId
      )?.rawEvent;
      if (isSignedMarketRawEvent(pendingRawEvent, eventId)) {
        return pendingRawEvent;
      }
    }

    const feedMatch = creatorMarketFeed.events
      .map((event) => event.rawEvent() as NostrEvent)
      .find((event) => event.id === eventId);
    if (feedMatch) return feedMatch;

    try {
      await ensureClientNdk();
      const directMatch = await ndk.fetchEvents(
        { kinds: [eventKinds.market as NDKKind], ids: [eventId], limit: 1 },
        { closeOnEose: true }
      );
      const directRawEvent = Array.from(directMatch)
        .map((event) => event.rawEvent() as NostrEvent)
        .find((event) => event.id === eventId);
      if (directRawEvent) return directRawEvent;

      const authoredMatch = await ndk.fetchEvents(
        {
          kinds: [eventKinds.market as NDKKind],
          '#d': [slug],
          authors: currentUser ? [currentUser.pubkey] : undefined,
          limit: 12
        },
        { closeOnEose: true }
      );
      return (
        Array.from(authoredMatch)
          .map((event) => event.rawEvent() as NostrEvent)
          .find(
            (event) =>
              event.id === eventId || parseMarketEvent(event, selectedEdition)?.slug === slug
          ) ?? undefined
      );
    } catch {
      return undefined;
    }
  }

  function marketUnitForSide(marketSlug: string, side: 'long' | 'short'): string {
    return side === 'long' ? `long_${marketSlug}` : `short_${marketSlug}`;
  }

  async function applyRecoveredSeedProofs(
    receipt: ReturnType<typeof listTradeReceipts>[number],
    payload: ProductTradeExecution | ProductTradeStatus
  ) {
    const { issued, change } =
      'issued' in payload
        ? extractTradeBlindSignatureBundles(payload)
        : { issued: null, change: null };
    const issuedProofs = receipt.issuedPreparation
      ? issued
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.issuedPreparation, issued.signatures, {
            marketEventId: receipt.eventId
          })
        : await restorePreparedOutputs(proofMintUrl(), receipt.issuedPreparation, {
            marketEventId: receipt.eventId
          })
      : [];
    const changeProofs = receipt.changePreparation
      ? change
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.changePreparation, change.signatures, {
            marketEventId: receipt.eventId
          })
        : await restorePreparedOutputs(proofMintUrl(), receipt.changePreparation, {
            marketEventId: receipt.eventId
          })
      : [];

    if (!issuedProofs.length && !changeProofs.length) {
      throw new Error("We couldn't restore the market launch on this device.");
    }

    if (receipt.spentUnit && receipt.spentProofs?.length) {
      removeLocalProofs(proofMintUrl(), receipt.spentUnit, receipt.spentProofs);
    }

    if (receipt.changePreparation && changeProofs.length) {
      addLocalProofs(proofMintUrl(), receipt.changePreparation.unit, changeProofs);
    }

    if (receipt.issuedPreparation && issuedProofs.length) {
      addLocalProofs(proofMintUrl(), receipt.issuedPreparation.unit, issuedProofs);
    }

    applyLocalPositionTradeFromPayload(proofMintUrl(), payload, receipt.action, receipt.side);
  }

  function createSeedRequestId(eventId: string): string {
    if (browser && typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${eventId}-${Date.now()}`;
  }

  async function seedPendingMarket(eventId: string, slug: string, rawEvent?: unknown) {
    if (!currentUser) {
      errorMessage = 'Sign in before seeding a market.';
      return;
    }

    if (parsedSeedAmount <= 0) {
      errorMessage = 'Enter a seed greater than zero.';
      return;
    }

    saving = true;
    errorMessage = '';
    builderStatus = `Checking portfolio balance for ${formatUsdMinor(parsedSeedAmount)}.`;

    try {
      const availableMinor = availableLocalUsdMinor();

      if (availableMinor < parsedSeedAmount) {
        builderStatus = `Market is pending. Fund your ${portfolioLabel}, then seed it from here.`;
        errorMessage = `Your ${portfolioLabel} has ${formatUsdMinor(availableMinor)}. Add at least ${formatUsdMinor(parsedSeedAmount)} to launch this market publicly.`;
        return;
      }

      builderStatus = `Seeding ${seedSide.toUpperCase()} with ${formatUsdMinor(parsedSeedAmount)}.`;
      const requestId = createSeedRequestId(eventId);
      const bootstrapEvent = await resolveBootstrapRawEvent(eventId, slug, rawEvent);
      if (!bootstrapEvent) {
        throw new Error('This market is still processing. Try launching it again in a moment.');
      }

      const quoteResponse = await quoteBuyTrade({
        eventId,
        side: seedSide,
        spendMinor: parsedSeedAmount,
        rawEvent: bootstrapEvent
      });
      const quote = await parseJson<ProductTradeQuote>(
        quoteResponse,
        'Failed to lock the seed quote.'
      );
      if (!quote.quote_id) {
        throw new Error('Seed quote is missing a quote id.');
      }
      const lockedQuoteId = quote.quote_id;
      const spendProofs = selectLocalProofsForAmount(proofMintUrl(), 'usd', quote.spend_minor);
      if (!spendProofs.length) {
        throw new Error(`Your ${portfolioLabel} no longer has enough local funds for this seed.`);
      }
      const tradeSide = normalizeProductTradeSide(quote.side, seedSide);
      const issuedUnit = marketUnitForSide(slug, tradeSide);
      const { outputs: issuedOutputs, preparation: issuedPreparation } = await prepareProofOutputs(
        proofMintUrl(),
        issuedUnit,
        quote.quantity_minor,
        undefined,
        { marketEventId: eventId }
      );
      const changeMinor = spendProofs.reduce((sum, proof) => sum + proof.amount, 0) - quote.spend_minor;
      const changeBundle =
        changeMinor > 0 ? await prepareProofOutputs(proofMintUrl(), 'usd', changeMinor) : null;
      const changeOutputs = changeBundle?.outputs ?? [];
      const changePreparation = changeBundle?.preparation;

      trackTradeReceipt({
        id: requestId,
        quoteId: lockedQuoteId,
        pubkey: currentUser.pubkey,
        eventId,
        marketSlug: slug,
        action: 'seed',
        side: tradeSide,
        spentUnit: 'usd',
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      const seed = await buyMarketPosition({
        eventId,
        pubkey: currentUser.pubkey,
        side: tradeSide,
        spendMinor: quote.spend_minor,
        rawEvent: bootstrapEvent,
        proofs: spendProofs,
        issuedOutputs,
        changeOutputs,
        quoteId: lockedQuoteId,
        requestId
      });
      const payload = await parseJson<ProductTradeExecution>(seed, 'Failed to seed the market.');
      const tradeId = typeof payload.trade.id === 'string' ? payload.trade.id : null;
      if (tradeId) {
        markTradeReceiptTradeId(requestId, tradeId);
      } else {
        attachTradeReceiptQuoteId(requestId, lockedQuoteId);
      }

      await applyRecoveredSeedProofs(
        {
          id: requestId,
          pubkey: currentUser.pubkey,
          eventId,
          marketSlug: slug,
          action: 'seed',
          side: seedSide,
          spentUnit: 'usd',
          spentProofs: spendProofs,
          issuedPreparation,
          changePreparation,
          createdAt: Date.now()
        },
        payload
      );

      if (hasCompletedTradeSettlement(payload)) {
        clearTradeReceipt(requestId);
        clearPendingCreatorMarket(eventId, currentUser.pubkey);
        refreshPendingCreatorMarkets();
        builderStatus = 'Market seeded and now public.';
        await openPublicMarketWhenReady(slug);
      } else {
        builderStatus = 'Market seed submitted. Waiting for settlement.';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to seed the market.';
    } finally {
      saving = false;
    }
  }

  async function publishMarket() {
    errorMessage = '';
    builderStatus = '';

    if (!currentUser) {
      errorMessage = 'Sign in before publishing a market.';
      return;
    }

    if (!canPublish) {
      errorMessage = 'Fill in the claim, category, and case before launching.';
      return;
    }

    const slug = slugify(claim);
    if (!slug) {
      errorMessage = 'A market title is required.';
      return;
    }

    saving = true;
    try {
      const marketEvent = new NDKEvent(ndk);
      marketEvent.kind = eventKinds.market;
      marketEvent.content = caseText.trim();
      marketEvent.tags = buildMarketEventTags({
        title: claim,
        slug,
        description: summary || deriveFallbackSummary(),
        category,
        topics: tags.join(','),
        linkedMarkets
      });

      if (imageMode === 'url' && imageUrl.trim()) {
        marketEvent.tags.push(['image', imageUrl.trim()]);
      }

      await ensureClientNdk();

      const publishRelayUrls = DEFAULT_RELAYS.filter((r) => !r.includes('purplepag.es'));
      const targetUrls = publishRelayUrls.length ? publishRelayUrls : DEFAULT_RELAYS;

      await waitForAnyRelayConnected(targetUrls, 15_000);

      const publishRelays = NDKRelaySet.fromRelayUrls(targetUrls, ndk);
      const publishTimeoutMs = 10_000;

      if (!paperEdition) {
        await marketEvent.publish(publishRelays, publishTimeoutMs);
        await navigateToMarket(slug);
        return;
      }

      await marketEvent.sign();
      builderStatus = 'Publishing market.';
      await marketEvent.publish(publishRelays, publishTimeoutMs);
      const rawEvent = marketEvent.rawEvent();
      const eventId = rawEvent.id || marketEvent.id;
      if (!eventId) {
        throw new Error("We couldn't finish publishing this market. Try again.");
      }

      trackPendingCreatorMarket({
        eventId,
        pubkey: currentUser.pubkey,
        slug,
        title: claim.trim(),
        createdAt: rawEvent.created_at ?? Math.floor(Date.now() / 1000),
        rawEvent
      });
      refreshPendingCreatorMarkets();

      const availableMinor = availableLocalUsdMinor();
      if (availableMinor < parsedSeedAmount) {
        builderStatus = `Market is pending. Fund your ${portfolioLabel}, then seed the market from this page.`;
        errorMessage = `Your ${portfolioLabel} has ${formatUsdMinor(availableMinor)}. Add at least ${formatUsdMinor(parsedSeedAmount)} to launch this market publicly.`;
        return;
      }

      await seedPendingMarket(eventId, slug, rawEvent);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to publish market.';
    } finally {
      if (saving) {
        saving = false;
      }
    }
  }

  function deriveFallbackSummary(): string {
    const source = caseText.trim() || claim.trim();
    if (!source) return '';
    const firstSentence = source.split(/[.!?]\s/)[0]?.trim() ?? source;
    return firstSentence.length > 220 ? firstSentence.slice(0, 217) + '...' : firstSentence;
  }

  async function reconcileSeedRequests() {
    if (!browser || !paperEdition || !currentUser) return;

    const receipts = listTradeReceipts(currentUser.pubkey).filter((receipt) => receipt.action === 'seed');
    if (!receipts.length) return;

    for (const receipt of receipts) {
      try {
        if (receipt.tradeId) {
          const response = await fetchTradeStatus(receipt.tradeId);
          const payload = await parseJson<ProductTradeStatus>(
            response,
            'Failed to recover the seeded market.'
          );
          if (!hasCompletedTradeSettlement(payload)) {
            builderStatus = `Recovered pending settlement for ${receipt.marketSlug}.`;
            continue;
          }
          await applyRecoveredSeedProofs(receipt, payload);
          clearTradeReceipt(receipt.id);
          builderStatus = 'Recovered seeded market and now public.';
          clearPendingCreatorMarket(receipt.eventId, currentUser.pubkey);
          refreshPendingCreatorMarkets();
          await openPublicMarketWhenReady(payload.market.slug);
          return;
        }

        const response = await fetchTradeRequestStatus(receipt.id);
        if (!response.ok) {
          if (!receipt.quoteId) {
            clearTradeReceipt(receipt.id);
            continue;
          }

          const quoteResponse = await fetchTradeQuoteStatus(receipt.quoteId);
          if (!quoteResponse.ok) {
            clearTradeReceipt(receipt.id);
            continue;
          }

          const quotePayload = await parseJson<ProductTradeQuote>(
            quoteResponse,
            'Failed to recover the locked seed quote.'
          );

          if (quotePayload.status === 'executed' && quotePayload.trade_id) {
            markTradeReceiptTradeId(receipt.id, quotePayload.trade_id);
            const tradeResponse = await fetchTradeStatus(quotePayload.trade_id);
            const tradePayload = await parseJson<ProductTradeStatus>(
              tradeResponse,
              'Failed to recover the completed seed.'
            );
            if (!hasCompletedTradeSettlement(tradePayload)) {
              builderStatus = `Recovered pending settlement for ${receipt.marketSlug}.`;
              continue;
            }
            await applyRecoveredSeedProofs(receipt, tradePayload);
            clearTradeReceipt(receipt.id);
            builderStatus = 'Recovered seeded market and now public.';
            clearPendingCreatorMarket(receipt.eventId, currentUser.pubkey);
            refreshPendingCreatorMarkets();
            await openPublicMarketWhenReady(tradePayload.market.slug);
            return;
          }

          clearTradeReceipt(receipt.id);
          errorMessage =
            quotePayload.status === 'expired'
              ? `Recovered expired seed quote for ${receipt.marketSlug}. Retry seeding the market.`
              : `Recovered open seed quote for ${receipt.marketSlug}. Retry seeding the market.`;
          continue;
        }

        const payload = await parseJson<ProductTradeRequestStatus>(
          response,
          'Failed to recover the seed request.'
        );

        if (payload.status === 'pending') {
          builderStatus = `Recovered pending seed for ${receipt.marketSlug}.`;
          continue;
        }

        if (payload.status === 'failed') {
          clearTradeReceipt(receipt.id);
          errorMessage = payload.error || `Recovered failed seed for ${receipt.marketSlug}.`;
          continue;
        }

        const tradeId = typeof payload.trade?.id === 'string' ? payload.trade.id : null;
        if (tradeId) {
          markTradeReceiptTradeId(receipt.id, tradeId);
          const tradeResponse = await fetchTradeStatus(tradeId);
          const tradePayload = await parseJson<ProductTradeStatus>(
            tradeResponse,
            'Failed to recover the completed seed.'
          );
          if (!hasCompletedTradeSettlement(tradePayload)) {
            builderStatus = `Recovered pending settlement for ${receipt.marketSlug}.`;
            continue;
          }
          await applyRecoveredSeedProofs(receipt, tradePayload);
          clearTradeReceipt(receipt.id);
          builderStatus = 'Recovered seeded market and now public.';
          clearPendingCreatorMarket(receipt.eventId, currentUser.pubkey);
          refreshPendingCreatorMarkets();
          await openPublicMarketWhenReady(tradePayload.market.slug);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  $effect(() => {
    if (!browser || !paperEdition || !currentUser) {
      pendingCreatorMarkets = [];
      return;
    }

    refreshPendingCreatorMarkets();
    void reconcileSeedRequests();
  });

  $effect(() => {
    if (!browser || !paperEdition || !currentUser || pendingCreatorMarkets.length === 0) return;

    const { remaining, removed } = prunePendingCreatorMarkets(
      pendingCreatorMarkets,
      publicCreatorMarketIds
    );
    if (removed.length === 0) return;

    for (const eventId of removed) {
      clearPendingCreatorMarket(eventId, currentUser.pubkey);
    }
    pendingCreatorMarkets = remaining;
  });

  $effect(() => {
    if (!browser || !paperEdition) return;
    refreshPendingCreatorMarkets();
  });

  function mergeRawEvents(seed: NostrEvent[], live: NDKEvent[]): NostrEvent[] {
    const map = new Map<string, NostrEvent>();

    for (const event of live) {
      const raw = event.rawEvent() as NostrEvent;
      if (raw.id) map.set(raw.id, raw);
    }

    for (const event of seed) {
      if (event.id && !map.has(event.id)) map.set(event.id, event);
    }

    return [...map.values()];
  }
</script>

<div class="composer">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span class="cur">Write a claim</span>
  </nav>

  {#if currentStep === 1}
    <section class="step-head">
      <h1 class="tight">What's your claim?</h1>
    </section>

    <section class="field">
      <div class="claim-field">
        <textarea
          bind:value={claim}
          class="claim-textarea serif"
          maxlength="280"
          placeholder="Bitcoin trades above $150,000 at any point in 2026."
          rows="3"
        ></textarea>
        <div class="claim-meta">
          <div class="rule-hints">
            <span class="hint" class:ok={hintHasNumber}>
              <span aria-hidden="true">{hintHasNumber ? '✓' : '○'}</span>
              <span>specific number</span>
            </span>
            <span class="hint" class:ok={hintHasWindow}>
              <span aria-hidden="true">{hintHasWindow ? '✓' : '○'}</span>
              <span>specific window</span>
            </span>
            <span class="hint" class:ok={hintResolvable}>
              <span aria-hidden="true">{hintResolvable ? '✓' : '○'}</span>
              <span>unambiguous</span>
            </span>
          </div>
          <span class="char-count mono">
            <span class="on">{claimCharCount}</span> / 280
          </span>
        </div>
      </div>
    </section>

    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Category</h2>
      </div>
      <div class="cat-tabs" role="tablist">
        {#each categories as item}
          <button
            class="cat-tab"
            class:on={category === item}
            onclick={() => (category = item)}
            role="tab"
            aria-selected={category === item}
            type="button"
          >
            {item}
          </button>
        {/each}
      </div>
    </section>

    {#if similarMarkets.length > 0}
      <section class="field">
        <div class="similar">
          <div class="sim-head">
            <span class="lbl">{similarMarkets.length} similar claim{similarMarkets.length === 1 ? '' : 's'} already live</span>
            <span class="aux mono">Pick one up · or keep going</span>
          </div>
          <div class="sim-rows">
            {#each similarMarkets as market (market.id)}
              <a class="sim-row" href={`/market/${market.slug}`}>
                <span class="t serif">{market.title}</span>
                <span class="arrow">→</span>
              </a>
            {/each}
          </div>
        </div>
      </section>
    {/if}
  {/if}

  {#if currentStep === 2}
    <section class="step-head">
      <h1 class="tight">Make your case.</h1>
    </section>

    <section class="field">
      <div class="case-wrap">
        <textarea
          bind:value={caseText}
          class="case-ta serif"
          placeholder="Start with the mechanism. Why is this claim more likely than the crowd says?"
        ></textarea>
        <div class="case-meta mono">
          <span>{caseWordCount} word{caseWordCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </section>

    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Linked markets</h2>
        <span class="field-aux mono">Informational only · links don't move price</span>
      </div>

      {#if linkedMarkets.length > 0}
        <div class="linked-list">
          {#each linkedMarkets as item (item.id)}
            <div class="linked-row">
              <div>
                <div class="t serif">{item.title}</div>
                <div class="m mono">{item.slug}</div>
              </div>
              <button class="rm" onclick={() => removeLink(item.id)} title="Remove" type="button">✕</button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="linked-search">
        <input
          bind:value={linkSearch}
          placeholder="+ Link another market…"
          type="text"
        />
      </div>

      {#if linkSearch.trim() && filteredMarkets.length > 0}
        <div class="linked-results">
          {#each filteredMarkets as market (market.id)}
            <button class="linked-result" onclick={() => addLink(market)} type="button">
              <span class="t serif">{market.title}</span>
              <span class="m mono">{market.slug}</span>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if currentStep === 3}
    <section class="step-head">
      <h1 class="tight">Details.</h1>
      <p class="step-sub">All optional. The market launches fine without any of this.</p>
    </section>

    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Image</h2>
      </div>
      <div class="img-up">
        <div class="img-preview" class:is-gradient={imageMode === 'gradient'}>
          {#if imageMode === 'gradient'}
            <span class="img-cat mono">{category || 'Category'}</span>
          {:else if imageUrl.trim()}
            <img src={imageUrl} alt="Market preview" />
          {:else}
            <span class="img-empty mono">paste a URL</span>
          {/if}
        </div>
        <div class="img-options">
          <button
            class="img-opt"
            class:on={imageMode === 'gradient'}
            onclick={() => (imageMode = 'gradient')}
            type="button"
          >
            <span>✓ Use {category || 'category'} gradient</span>
            <span class="desc">Default</span>
          </button>
          <button
            class="img-opt"
            class:on={imageMode === 'url'}
            onclick={() => (imageMode = 'url')}
            type="button"
          >
            <span>Use from URL</span>
            <span class="desc">Nostr imeta</span>
          </button>
          {#if imageMode === 'url'}
            <input
              bind:value={imageUrl}
              class="url-input mono"
              placeholder="https://…"
              type="url"
            />
          {/if}
        </div>
      </div>
    </section>

    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Summary</h2>
        <button class="regen mono" onclick={regenerateSummary} type="button">↻ Regenerate</button>
      </div>
      <p class="field-help">This appears in link previews and share cards. Edit if it needs a different angle.</p>
      <textarea
        bind:value={summary}
        class="summary-ta serif"
        placeholder="One paragraph, summarizing the case for link previews."
        rows="3"
      ></textarea>
    </section>

    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Tags</h2>
      </div>
      <div class="tag-chips">
        {#each tags as tag (tag)}
          <span class="tag-chip mono">
            {tag}
            <button class="x" onclick={() => removeTag(tag)} title="Remove" type="button">✕</button>
          </span>
        {/each}
        <input
          bind:value={tagInput}
          class="tag-input mono"
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTagFromInput();
            }
          }}
          placeholder="+ add tag"
          type="text"
        />
      </div>
      <div class="tag-chips suggest-row">
        {#each suggestedTags as suggestion}
          <button
            class="tag-chip suggest mono"
            class:on={tags.includes(suggestion.toLowerCase())}
            onclick={() => toggleSuggestedTag(suggestion)}
            type="button"
          >
            + {suggestion}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if currentStep === 4}
    <section class="step-head">
      <h1 class="tight">Launch the market.</h1>
    </section>

    <section class="field">
      <p class="seed-explainer serif">
        A market goes live when <strong>you put real money on it.</strong> Pick a side, size it,
        and you're the first trade. This is what gives the claim its price — and it's why we don't
        have a resolution oracle: you're here to argue, the crowd's here to disagree, and nobody
        needs a referee.
      </p>
    </section>

    <section class="field">
      <div class="seed-controls">
        <div class="side-toggle">
          <button
            class="side-btn"
            class:on={seedSide === 'long'}
            data-side="long"
            onclick={() => (seedSide = 'long')}
            type="button"
          >
            <span>Back LONG</span>
            <span class="p mono">{seedMath.longPct}¢</span>
          </button>
          <button
            class="side-btn"
            class:on={seedSide === 'short'}
            data-side="short"
            onclick={() => (seedSide = 'short')}
            type="button"
          >
            <span>Back SHORT</span>
            <span class="p mono">{seedMath.shortPct}¢</span>
          </button>
        </div>

        <label class="amount-input">
          <span class="currency mono">$</span>
          <input
            aria-label="Seed amount in dollars"
            min="1"
            oninput={(event) => {
              const dollars = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
              seedAmount = Number.isFinite(dollars) && dollars > 0 ? dollars * 100 : 0;
            }}
            type="number"
            value={seedDollars || ''}
          />
        </label>

        <div class="quick-picks">
          {#each quickAmounts as amount}
            <button
              class="qp mono"
              class:on={seedAmount === amount}
              onclick={() => (seedAmount = amount)}
              type="button"
            >
              ${Math.round(amount / 100)}
            </button>
          {/each}
        </div>

        <div class="live-math mono">
          <span class="k">you'll buy</span>
          <span>{seedMath.shares.toLocaleString()} {seedSide.toUpperCase()}</span>
          <span class="sep">·</span>
          <span class="k">avg</span>
          <span>{seedMath.avgPct}¢</span>
          <br />
          <span class="k">opening crowd price</span>
          <span>{seedMath.sidePct}¢ {seedSide.toUpperCase()}</span>
          <span class="sep">·</span>
          <span class="k">market liquidity</span>
          <span>${seedDollars}</span>
        </div>

        <p class="reassure">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>
            You're not paying a fee. This is capital you control — the market holds it as your opening
            {seedSide.toUpperCase()} position. Withdraw anytime.
          </span>
        </p>
      </div>
    </section>
  {/if}

  {#if builderStatus}
    <p class="status-msg mono">{builderStatus}</p>
  {/if}
  {#if errorMessage}
    <p class="error-msg">{errorMessage}</p>
  {/if}

  {#if paperEdition && creatorMarkets.length > 0 && currentStep === 4}
    <section class="field">
      <div class="field-head">
        <h2 class="field-label">Your markets</h2>
      </div>
      <div class="your-markets">
        {#each creatorMarkets as market (market.event_id)}
          <div class="your-market">
            <div>
              <div class="t serif">{market.title}</div>
              <div class="m mono">{market.visibility === 'public' ? 'Public' : 'Pending'} · {market.slug}</div>
            </div>
            {#if market.visibility === 'public'}
              <a class="your-market-btn" href={`/market/${market.slug}`}>Open</a>
            {:else}
              <button
                class="your-market-btn"
                disabled={saving || parsedSeedAmount <= 0}
                onclick={() => void seedPendingMarket(market.event_id, market.slug, market.rawEvent)}
                type="button"
              >
                Seed now
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <div class="wizard-foot">
    <div class="foot-inner">
      <button class="back-btn" disabled={currentStep === 1} onclick={prevStep} type="button">← Back</button>
      <div class="spacer"></div>
      <div class="foot-dots" role="tablist" aria-label="Progress">
        {#each [1, 2, 3, 4] as n}
          <button
            class="fd mono"
            class:active={currentStep === n}
            class:done={currentStep > n}
            onclick={() => goStep(n as Step)}
            type="button"
            aria-label={`Step ${n}`}
          >
            {currentStep > n ? '✓' : n}
          </button>
        {/each}
      </div>
      <div class="spacer"></div>
      {#if currentStep === 3}
        <button class="skip" onclick={nextStep} type="button">Skip</button>
      {/if}
      {#if isLastStep}
        <button
          class="cont launch tight"
          disabled={saving || !canPublish}
          onclick={publishMarket}
          type="button"
        >
          {saving ? 'Launching…' : `Launch market · $${seedDollars} →`}
        </button>
      {:else}
        <button class="cont tight" disabled={!canAdvance} onclick={nextStep} type="button">
          Continue →
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .composer {
    --bg: var(--color-base-100);
    --surface: var(--color-base-200);
    --elev: #1a1814;
    --border: var(--color-base-300);
    --border-strong: var(--color-neutral);
    --text: var(--color-base-content);
    --text-2: var(--color-neutral-content);
    --text-3: #5c5849;
    --text-4: #3a362d;
    --ink: var(--color-primary);
    --yes: var(--color-success);
    --yes-dim: rgba(62, 196, 138, 0.12);
    --yes-line: rgba(62, 196, 138, 0.45);
    --no: var(--color-error);
    --no-dim: rgba(232, 93, 122, 0.12);
    --no-line: rgba(232, 93, 122, 0.45);

    max-width: 720px;
    margin: 0 auto;
    padding: 0 0 8rem;
    display: grid;
    gap: 0;
  }

  .composer :global(.mono) {
    font-family: var(--font-mono);
    font-feature-settings: 'tnum' 1;
    letter-spacing: -0.01em;
  }

  .composer :global(.serif) {
    font-family: var(--font-serif);
  }

  .composer :global(.tight) {
    font-family: var(--font-tight);
    letter-spacing: -0.02em;
  }

  .crumbs {
    padding: 0 0 1rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-3);
    letter-spacing: 0.06em;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .crumbs a { color: var(--text-2); }
  .crumbs a:hover { color: var(--text); }
  .crumbs .sep { color: var(--text-4); }
  .crumbs .cur { color: var(--text-3); text-transform: uppercase; }

  .step-head {
    padding: 0.8rem 0 1.2rem;
    display: grid;
    gap: 0.5rem;
  }
  .step-head h1 {
    font-family: var(--font-tight);
    font-weight: 700;
    font-size: 1.75rem;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: 0;
  }
  .step-sub {
    color: var(--text-3);
    font-size: 0.92rem;
    max-width: 52ch;
  }

  .field {
    padding: 1.3rem 0;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 0.7rem;
  }
  .field:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .field-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }
  .field-label {
    margin: 0;
    font-family: var(--font-tight);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-2);
  }
  .field-aux {
    font-size: 0.7rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }
  .field-help {
    font-size: 0.87rem;
    color: var(--text-3);
    line-height: 1.5;
    max-width: 60ch;
  }

  .claim-field {
    padding: 0.6rem 0 0.5rem;
    display: grid;
    gap: 0.65rem;
  }
  .claim-textarea {
    width: 100%;
    resize: none;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--border-strong);
    padding: 0.3rem 0 1rem;
    font-size: 2rem;
    line-height: 1.3;
    color: var(--text);
    letter-spacing: -0.005em;
    min-height: 6rem;
    outline: none;
  }
  .claim-textarea:focus {
    border-bottom-color: var(--ink);
  }
  .claim-textarea::placeholder {
    color: var(--text-4);
    font-style: italic;
  }
  .claim-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .char-count {
    font-size: 0.74rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }
  .char-count .on {
    color: var(--text);
  }
  .rule-hints {
    display: flex;
    gap: 0.8rem;
    font-size: 0.72rem;
    color: var(--text-3);
    letter-spacing: 0.02em;
    flex-wrap: wrap;
  }
  .rule-hints .hint {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-mono);
  }
  .rule-hints .hint.ok {
    color: var(--yes);
  }

  .cat-tabs {
    display: flex;
    gap: 1.1rem;
    flex-wrap: wrap;
    font-size: 0.95rem;
  }
  .cat-tab {
    color: var(--text-3);
    padding: 0.35rem 0;
    border: 0;
    border-bottom: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
  }
  .cat-tab:hover {
    color: var(--text);
  }
  .cat-tab.on {
    color: var(--ink);
    border-bottom-color: var(--ink);
    font-weight: 600;
  }

  .similar {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    overflow: hidden;
  }
  .sim-head {
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .sim-head .lbl {
    font-family: var(--font-tight);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
  }
  .sim-head .aux {
    font-size: 0.68rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }
  .sim-rows {
    border-top: 1px solid var(--border);
    display: grid;
  }
  .sim-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
    color: inherit;
  }
  .sim-row:first-child {
    border-top: 0;
  }
  .sim-row:hover {
    background: var(--elev);
  }
  .sim-row .t {
    font-size: 0.95rem;
    color: var(--text);
    line-height: 1.35;
  }
  .sim-row .arrow {
    color: var(--text-3);
  }

  .case-wrap {
    display: grid;
    gap: 0.55rem;
  }
  .case-ta {
    width: 100%;
    resize: vertical;
    min-height: 320px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.15rem 1.3rem;
    font-size: 1.02rem;
    line-height: 1.65;
    color: var(--text);
    outline: none;
  }
  .case-ta:focus {
    border-color: var(--border-strong);
  }
  .case-ta::placeholder {
    color: var(--text-4);
    font-style: italic;
  }
  .case-meta {
    display: flex;
    justify-content: flex-end;
    font-size: 0.7rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .linked-list {
    display: grid;
    gap: 0.5rem;
  }
  .linked-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 0.95rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .linked-row .t {
    font-size: 0.95rem;
    color: var(--text);
  }
  .linked-row .m {
    font-size: 0.75rem;
    color: var(--text-3);
    padding-top: 0.15rem;
  }
  .linked-row button.rm {
    color: var(--text-3);
    font-size: 1.1rem;
    padding: 0.2rem 0.5rem;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .linked-row button.rm:hover {
    color: var(--no);
  }
  .linked-search {
    margin-top: 0.3rem;
  }
  .linked-search input {
    width: 100%;
    background: transparent;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    padding: 0.7rem 0.95rem;
    font-size: 0.92rem;
    color: var(--text);
    outline: none;
  }
  .linked-search input::placeholder {
    color: var(--text-3);
  }
  .linked-results {
    display: grid;
    gap: 0.4rem;
  }
  .linked-result {
    text-align: left;
    padding: 0.6rem 0.9rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: grid;
    gap: 0.2rem;
    cursor: pointer;
    color: inherit;
  }
  .linked-result:hover {
    border-color: var(--border-strong);
    background: var(--elev);
  }
  .linked-result .t {
    font-size: 0.92rem;
  }
  .linked-result .m {
    font-size: 0.72rem;
    color: var(--text-3);
  }

  .img-up {
    display: grid;
    grid-template-columns: 176px 1fr;
    gap: 1.1rem;
    align-items: start;
  }
  .img-preview {
    aspect-ratio: 4 / 5;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    display: grid;
    place-items: center;
  }
  .img-preview.is-gradient {
    background: linear-gradient(135deg, #b4846a 0%, #84746e 30%, #5a6a84 70%, #4a4a64 100%);
  }
  .img-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .img-preview .img-cat {
    position: absolute;
    top: 0.7rem;
    left: 0.7rem;
    font-size: 0.58rem;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .img-preview .img-empty {
    font-size: 0.75rem;
    color: var(--text-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .img-options {
    display: grid;
    gap: 0.5rem;
  }
  .img-opt {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    padding: 0.6rem 0.9rem;
    border-radius: 8px;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    font-size: 0.88rem;
    cursor: pointer;
    font-family: inherit;
  }
  .img-opt:hover {
    border-color: var(--border-strong);
    background: var(--elev);
  }
  .img-opt.on {
    border-color: var(--ink);
    color: var(--ink);
  }
  .img-opt .desc {
    color: var(--text-3);
    font-size: 0.8rem;
  }
  .url-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    color: var(--text);
    font-size: 0.85rem;
    outline: none;
  }
  .url-input:focus {
    border-color: var(--ink);
  }

  .summary-ta {
    width: 100%;
    resize: vertical;
    min-height: 6rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.95rem 1.1rem;
    font-size: 0.98rem;
    line-height: 1.55;
    color: var(--text);
    outline: none;
  }
  .summary-ta:focus {
    border-color: var(--border-strong);
  }
  .summary-ta::placeholder {
    color: var(--text-4);
    font-style: italic;
  }
  .regen {
    font-size: 0.7rem;
    color: var(--text-3);
    letter-spacing: 0.04em;
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .regen:hover {
    color: var(--text);
    border-color: var(--text-3);
  }

  .tag-chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .tag-chips.suggest-row {
    padding-top: 0.25rem;
  }
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.75rem;
    color: var(--text);
    background: var(--surface);
  }
  .tag-chip.suggest {
    border-style: dashed;
    color: var(--text-3);
    cursor: pointer;
  }
  .tag-chip.suggest:hover {
    border-color: var(--ink);
    color: var(--ink);
    border-style: solid;
  }
  .tag-chip.suggest.on {
    border-color: var(--ink);
    color: var(--ink);
    border-style: solid;
  }
  .tag-chip button.x {
    color: var(--text-3);
    font-size: 0.85rem;
    padding: 0 0 0 0.2rem;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .tag-chip button.x:hover {
    color: var(--no);
  }
  .tag-input {
    min-width: 8rem;
    flex: 1;
    background: transparent;
    border: 1px dashed var(--border-strong);
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    color: var(--text);
    font-size: 0.78rem;
    outline: none;
  }
  .tag-input:focus {
    border-color: var(--ink);
    border-style: solid;
  }

  .seed-explainer {
    padding: 1rem 1.2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text);
    max-width: 62ch;
  }
  .seed-explainer strong {
    color: var(--ink);
    font-weight: 600;
  }

  .seed-controls {
    display: grid;
    gap: 1rem;
    padding: 1.25rem 1.4rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .side-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.35rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .side-btn {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-family: var(--font-tight);
    font-weight: 600;
    font-size: 0.94rem;
    color: var(--text-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .side-btn.on[data-side='long'] {
    background: var(--yes-dim);
    color: var(--yes);
    border-color: var(--yes-line);
  }
  .side-btn.on[data-side='short'] {
    background: var(--no-dim);
    color: var(--no);
    border-color: var(--no-line);
  }
  .side-btn .p {
    font-size: 0.82rem;
  }

  .amount-input {
    position: relative;
    display: block;
  }
  .amount-input .currency {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-3);
    font-size: 1.2rem;
  }
  .amount-input input {
    width: 100%;
    padding: 0.95rem 1rem 0.95rem 2rem;
    font-family: var(--font-mono);
    font-size: 1.35rem;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    color: var(--text);
    outline: none;
    letter-spacing: -0.01em;
  }
  .amount-input input:focus {
    border-color: var(--ink);
  }

  .quick-picks {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .qp {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 6px;
    font-size: 0.82rem;
    color: var(--text-2);
    cursor: pointer;
    font-family: var(--font-mono);
  }
  .qp:hover {
    border-color: var(--text-3);
    color: var(--text);
  }
  .qp.on {
    border-color: var(--ink);
    color: var(--ink);
  }

  .live-math {
    padding: 0.85rem 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.82rem;
    color: var(--text);
    line-height: 1.7;
    letter-spacing: -0.005em;
  }
  .live-math .k {
    color: var(--text-3);
  }
  .live-math .sep {
    color: var(--text-4);
    padding: 0 0.35rem;
  }

  .reassure {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    font-size: 0.85rem;
    color: var(--text-2);
    line-height: 1.5;
    margin: 0;
  }
  .reassure svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    stroke: var(--yes);
    fill: none;
    stroke-width: 1.8;
    margin-top: 0.14rem;
  }

  .your-markets {
    display: grid;
    gap: 0.5rem;
  }
  .your-market {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 0.8rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .your-market .t {
    font-size: 0.95rem;
    color: var(--text);
  }
  .your-market .m {
    font-size: 0.72rem;
    color: var(--text-3);
    padding-top: 0.15rem;
  }
  .your-market-btn {
    padding: 0.4rem 0.85rem;
    font-size: 0.85rem;
    color: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
  }
  .your-market-btn:hover:enabled {
    background: var(--ink);
    color: var(--color-primary-content);
  }
  .your-market-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .status-msg {
    font-size: 0.8rem;
    color: var(--text-2);
    padding-top: 0.75rem;
  }
  .error-msg {
    font-size: 0.88rem;
    color: var(--no);
    padding-top: 0.5rem;
  }

  .wizard-foot {
    position: sticky;
    bottom: 1rem;
    margin-top: 2rem;
    z-index: 20;
  }
  .wizard-foot .foot-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.75rem 0.85rem 0.75rem 1.15rem;
    background: rgba(19, 18, 15, 0.96);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .back-btn {
    font-size: 0.88rem;
    color: var(--text-2);
    padding: 0.4rem 0.7rem;
    border-radius: 999px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .back-btn:hover:enabled {
    color: var(--text);
  }
  .back-btn:disabled {
    opacity: 0.35;
    pointer-events: none;
  }
  .spacer {
    flex: 1;
  }
  .foot-dots {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .fd {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--text-3);
    display: grid;
    place-items: center;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }
  .fd:hover {
    color: var(--text);
    border-color: var(--text-3);
  }
  .fd.active {
    background: var(--ink);
    color: var(--color-primary-content);
    border-color: var(--ink);
  }
  .fd.done {
    background: var(--yes-dim);
    color: var(--yes);
    border-color: var(--yes-line);
  }
  .skip {
    color: var(--text-3);
    font-size: 0.85rem;
    padding: 0.4rem 0.7rem;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .skip:hover {
    color: var(--text-2);
  }
  .cont {
    padding: 0.65rem 1.3rem;
    background: var(--ink);
    color: var(--color-primary-content);
    font-weight: 700;
    font-size: 0.95rem;
    border-radius: 999px;
    border: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  .cont:hover:enabled {
    background: #fff8ec;
  }
  .cont:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cont.launch {
    padding-left: 1.5rem;
  }

  @media (max-width: 640px) {
    .img-up {
      grid-template-columns: 1fr;
    }
    .composer {
      padding-bottom: 6rem;
    }
  }
</style>
