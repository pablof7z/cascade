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

  type Step = 0 | 1 | 2 | 3;

  const examples = [
    'Will AGI emerge before 2030?',
    'Will Europe avoid a recession through 2027?',
    'Will open models overtake frontier closed models in daily usage?'
  ];
  const publicMarketRoutePollMs = 500;
  const publicMarketRouteTimeoutMs = 15_000;

  let { data }: PageProps = $props();
  const currentUser = $derived(ndk.$currentUser);

  let step = $state<Step>(0);
  let title = $state('');
  let description = $state('');
  let body = $state('');
  let category = $state('');
  let topics = $state('');
  let linkSearch = $state('');
  let linkedMarkets = $state<DraftLink[]>([]);
  let saving = $state(false);
  let errorMessage = $state('');
  let builderStatus = $state('');
  let seedAmount = $state('10000');
  let seedSide = $state<'long' | 'short'>('long');
  let pendingCreatorMarkets = $state<PendingCreatorMarketRecord[]>([]);

  const steps = [
    { label: 'Claim' },
    { label: 'Case' },
    { label: 'Links' },
    { label: 'Review' }
  ];

  const availableMarkets = $derived.by(() => {
    return publicReferenceMarkets;
  });

  const filteredMarkets = $derived.by(() => {
    const query = linkSearch.trim().toLowerCase();
    const selectedIds = new Set(linkedMarkets.map((item) => item.id));
    return availableMarkets
      .filter((market) => !selectedIds.has(market.id))
      .filter((market) => {
        if (!query) return true;
        return (
          market.title.toLowerCase().includes(query) ||
          market.description.toLowerCase().includes(query) ||
          market.slug.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  });

  const canAdvance = $derived.by(() => {
    if (step === 0) return Boolean(title.trim() && description.trim());
    if (step === 1) return Boolean(body.trim());
    return true;
  });
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const paperEdition = $derived(isPaperEdition(selectedEdition));
  const portfolioLabel = $derived(paperEdition ? 'practice portfolio' : 'portfolio');
  const parsedSeedAmount = $derived(Number.parseInt(seedAmount, 10) || 0);

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

  const publicCreatorMarketIds = $derived.by(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      publicReferenceMarkets
        .filter((market) => market.pubkey === currentUser.pubkey)
        .map((market) => market.id)
    );
  });

  const creatorMarkets = $derived.by(() => {
    const publicMarkets = creatorMarketFeed.events
      .map((event) => parseMarketEvent(event.rawEvent(), selectedEdition))
      .filter((market): market is MarketRecord => Boolean(market))
      .filter((market) => publicCreatorMarketIds.has(market.id))
      .map<AuthoredCreatorMarket>((market) => ({
        eventId: market.id,
        slug: market.slug,
        title: market.title,
        createdAt: market.createdAt
      }));

    return mergeCreatorMarkets(publicMarkets, pendingCreatorMarkets);
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

  function updateLinkDirection(id: string, direction: 'long' | 'short') {
    linkedMarkets = linkedMarkets.map((item) => (item.id === id ? { ...item, direction } : item));
  }

  function updateLinkNote(id: string, note: string) {
    linkedMarkets = linkedMarkets.map((item) => (item.id === id ? { ...item, note } : item));
  }

  function nextStep() {
    if (step < 3 && canAdvance) step = (step + 1) as Step;
  }

  function previousStep() {
    if (step > 0) step = (step - 1) as Step;
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
      errorMessage = 'Enter a launch spend greater than zero.';
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

    const slug = slugify(title);
    if (!slug) {
      errorMessage = 'A market title is required.';
      return;
    }

    saving = true;
    try {
      const marketEvent = new NDKEvent(ndk);
      marketEvent.kind = eventKinds.market;
      marketEvent.content = body.trim();
      marketEvent.tags = buildMarketEventTags({
        title,
        slug,
        description,
        category,
        topics,
        linkedMarkets
      });

      await ensureClientNdk();

      const publishRelayUrls = DEFAULT_RELAYS.filter((r) => !r.includes('purplepag.es'));
      const targetUrls = publishRelayUrls.length ? publishRelayUrls : DEFAULT_RELAYS;

      // Wait until at least one publish relay is CONNECTED before handing off
      // to NDK's per-relay publisher. ensureClientNdk() is cached and may have
      // resolved on an earlier page load; relays can disconnect in the interim.
      // Allow 15 s — generous enough for cold WebSocket handshakes without
      // blocking the UI indefinitely on a broken network.
      await waitForAnyRelayConnected(targetUrls, 15_000);

      const publishRelays = NDKRelaySet.fromRelayUrls(targetUrls, ndk);

      // Use a 10-second per-relay timeout. The NDK default (2500ms) is too short
      // for initial WebSocket connections to public relays in CI/test environments.
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
        title: title.trim(),
        createdAt: rawEvent.created_at ?? Math.floor(Date.now() / 1000),
        rawEvent,
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

<div class="grid gap-8 w-[min(calc(100%-2.5rem),68rem)] mx-auto py-8 pb-16">
  <header class="grid gap-3">
    <div class="eyebrow">Create Market</div>
    <h1 class="text-[2rem] tracking-[-0.04em]">Create Market</h1>
    <p class="max-w-[48rem] text-base-content/70">
      Publish the claim, the case, and the surrounding context. Linked markets are informational only. They do not
      move each other.
    </p>
  </header>

  <nav class="grid grid-cols-4 gap-px bg-base-300" aria-label="Builder steps">
    {#each steps as item, index}
      <div class="flex items-center gap-3 px-4 py-3 bg-base-100 {index === step ? 'text-white' : 'text-base-content/50'}">
        <span class="font-mono text-sm">{index + 1}</span>
        <strong class="text-sm font-medium">{item.label}</strong>
      </div>
    {/each}
  </nav>

  <div class="grid gap-6">
    {#if step === 0}
      <div class="grid gap-6">
        <input
          bind:value={title}
          class="input input-bordered rounded-none px-0 shadow-none min-h-0 pb-4 text-[clamp(2.2rem,4vw,3.2rem)] tracking-[-0.05em]"
          placeholder="Market title"
          type="text"
        />

        <div class="grid gap-3">
          <span class="text-base-content/70 text-sm">Examples</span>
          <div class="flex flex-wrap gap-3">
            {#each examples as example}
              <button class="btn btn-outline btn-sm" onclick={() => (title = example)} type="button">
                {example}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid gap-3">
          <span class="text-base-content/70 text-sm">Summary</span>
          <textarea
            bind:value={description}
            class="textarea textarea-bordered min-h-[10rem] resize-y"
            placeholder="What is this market tracking, and why should someone care?"
          ></textarea>
        </div>

        <div class="pt-4 border-t border-base-300 text-sm text-base-content/70">
          Markets stay open. Price changes as people buy or sell.
        </div>
      </div>
    {/if}

    {#if step === 1}
      <div class="grid gap-6">
        <div class="grid gap-3">
          <h2 class="text-xl">Make your claim</h2>
          <p class="text-base-content/70">
            This is your public argument. Write it as if the other side is already reading and looking for weak links.
          </p>
        </div>

        <textarea
          bind:value={body}
          class="textarea textarea-bordered min-h-[10rem] resize-y"
          placeholder="Lay out the logic, the evidence, and the path you expect reality to take."
        ></textarea>
      </div>
    {/if}

    {#if step === 2}
      <div class="grid gap-6">
        <div class="grid gap-3">
          <h2 class="text-xl">Link related markets</h2>
          <p class="text-base-content/70">
            Attach related markets that strengthen or challenge the case. These are references for readers, not
            pricing dependencies.
          </p>
        </div>

        <input
          class="input input-bordered"
          bind:value={linkSearch}
          placeholder="Search markets to add as references"
          type="text"
        />

        <div class="border-t border-base-300">
          {#if filteredMarkets.length > 0}
            {#each filteredMarkets as market (market.id)}
              <button class="grid gap-1 w-full text-left py-4 border-b border-base-300 hover:text-white" onclick={() => addLink(market)} type="button">
                <strong class="text-white text-sm">{market.title}</strong>
                <span class="text-base-content/70 text-sm">{market.description || market.slug}</span>
              </button>
            {/each}
          {:else}
            <div class="py-4 text-base-content/70 text-sm border-b border-base-300">No matching markets found.</div>
          {/if}
        </div>

        <div class="border-t border-base-300">
          {#if linkedMarkets.length > 0}
            {#each linkedMarkets as item (item.id)}
              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(20rem,1.5fr)] gap-4 py-4 border-b border-base-300">
                <div>
                  <strong class="text-white text-sm">{item.title}</strong>
                  <p class="text-base-content/70 text-sm mt-1">{item.slug}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-[10rem_minmax(0,1fr)_auto] gap-3 items-center">
                  <select
                    class="select select-bordered"
                    bind:value={item.direction}
                    onchange={(event) =>
                      updateLinkDirection(
                        item.id,
                        (event.currentTarget as HTMLSelectElement).value as 'long' | 'short'
                      )}
                  >
                    <option value="long">Supports LONG</option>
                    <option value="short">Supports SHORT</option>
                  </select>
                  <input
                    class="input input-bordered"
                    oninput={(event) => updateLinkNote(item.id, (event.currentTarget as HTMLInputElement).value)}
                    placeholder="Why this link matters"
                    type="text"
                    value={item.note}
                  />
                  <button class="btn btn-ghost" onclick={() => removeLink(item.id)} type="button">Remove</button>
                </div>
              </div>
            {/each}
          {:else}
            <div class="py-4 text-base-content/70 text-sm border-b border-base-300">
              No references yet. You can still publish the market without linked context.
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="grid gap-2">
            <span class="eyebrow">Categories</span>
            <input class="input input-bordered" bind:value={category} placeholder="ai, economics" type="text" />
          </label>
          <label class="grid gap-2">
            <span class="eyebrow">Topics</span>
            <input class="input input-bordered" bind:value={topics} placeholder="agents, labor, energy" type="text" />
          </label>
        </div>
      </div>
    {/if}

    {#if step === 3}
      <div class="grid gap-6">
        <div class="grid gap-3">
          <h2 class="text-xl">Review</h2>
          <p class="text-base-content/70">Review how this will appear before you go live.</p>
        </div>

        {#each [
          { label: 'Title', content: title || '-', bold: true },
          { label: 'Summary', content: description || '-' },
          { label: 'Case', content: body || '-' },
          { label: 'Linked markets', content: linkedMarkets.length > 0 ? linkedMarkets.map((item) => item.title).join(' · ') : 'None attached.' },
        ] as block}
          <div class="grid gap-1 py-4 border-t border-base-300">
            <span class="eyebrow">{block.label}</span>
            {#if block.bold}
              <strong class="text-white">{block.content}</strong>
            {:else}
              <p class="text-base-content/70">{block.content}</p>
            {/if}
          </div>
        {/each}

        {#if paperEdition}
          <div class="grid gap-4 py-4 border-t border-base-300">
            <span class="eyebrow">Opening stake</span>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="grid gap-2">
                <span class="eyebrow">Initial funding</span>
                <input
                  aria-label="Initial funding"
                  class="input input-bordered"
                  bind:value={seedAmount}
                  min="100"
                  step="100"
                  type="number"
                />
              </label>
              <label class="grid gap-2">
                <span class="eyebrow">Your position</span>
                <select aria-label="Your position" class="select select-bordered" bind:value={seedSide}>
                  <option value="long">LONG</option>
                  <option value="short">SHORT</option>
                </select>
              </label>
            </div>
            <p class="text-base-content/70 text-sm">{formatUsdMinor(parsedSeedAmount)} total spend. Fees stay inside that amount.</p>
          </div>
        {/if}
      </div>
    {/if}

    {#if errorMessage}
      <p class="text-error">{errorMessage}</p>
    {/if}
    {#if builderStatus}
      <p class="text-base-content/70">{builderStatus}</p>
    {/if}

    {#if paperEdition && creatorMarkets.length > 0}
      <div class="grid gap-6">
        <div class="grid gap-3">
          <h2 class="text-xl">Your markets</h2>
          <p class="text-base-content/70">Your market goes live with the first trade.</p>
        </div>

        <div class="border-t border-base-300">
          {#each creatorMarkets as market (market.event_id)}
            <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(20rem,1.5fr)] gap-4 py-4 border-b border-base-300">
              <div>
                <strong class="text-white text-sm">{market.title}</strong>
                <p class="text-base-content/70 text-sm mt-1">{market.visibility === 'public' ? 'Public' : 'Pending'}</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center">
                <input class="input input-bordered" readonly type="text" value={market.slug} />
                {#if market.visibility === 'public'}
                  <a class="btn btn-outline" href={`/market/${market.slug}`}>Open market</a>
                {:else}
                  <button class="btn btn-outline" disabled={saving || parsedSeedAmount <= 0} onclick={() => void seedPendingMarket(market.event_id, market.slug, market.rawEvent)} type="button">
                    Seed now
                  </button>
                  <a class="btn btn-outline" href="/portfolio">Fund portfolio</a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex items-center gap-3 flex-wrap">
      {#if step > 0}
        <button class="btn btn-outline" onclick={previousStep} type="button">Back</button>
      {/if}

      {#if step < 3}
        <button class="btn btn-primary" disabled={!canAdvance} onclick={nextStep} type="button">Continue</button>
      {:else}
        <button class="btn btn-primary" disabled={saving} onclick={publishMarket} type="button">
          {saving ? 'Publishing...' : 'Create Market'}
        </button>
      {/if}

      <a class="btn btn-ghost" href="/">Back to Markets</a>
    </div>
  </div>
</div>
