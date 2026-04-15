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
  import { NDKEvent, type NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { getProductApiUrl, isPaperEdition } from '$lib/cascade/config';
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
  import { ensureClientNdk, ndk } from '$lib/ndk/client';
  import { parseMarketEvent, parseTradeEvent, type MarketRecord } from '$lib/ndk/cascade';
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
  const paperEdition = $derived(isPaperEdition());
  const portfolioLabel = $derived(paperEdition ? 'practice portfolio' : 'portfolio');
  const parsedSeedAmount = $derived(Number.parseInt(seedAmount, 10) || 0);

  const creatorMarketFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition || !currentUser) return undefined;
    return { filters: [{ kinds: [982], authors: [currentUser.pubkey], limit: 200 }] };
  });

  const publicMarketFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition) return undefined;
    return { filters: [{ kinds: [982], limit: 240 }] };
  });

  const publicTradeFeed = ndk.$subscribe(() => {
    if (!browser || !paperEdition) return undefined;
    return { filters: [{ kinds: [983], limit: 480 }] };
  });

  const seededPublicMarketIds = $derived.by(() => {
    return new Set((data.markets ?? []).map((event) => event.id).filter(Boolean));
  });

  const publicTradeMarketIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const event of publicTradeFeed.events) {
      const trade = parseTradeEvent(event.rawEvent());
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
      .map(parseMarketEvent)
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
      .map((event) => parseMarketEvent(event.rawEvent()))
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
    return getProductApiUrl().replace(/\/+$/, '');
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
      (candidate as { kind?: unknown }).kind === 982
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
        { kinds: [982 as NDKKind], ids: [eventId], limit: 1 },
        { closeOnEose: true }
      );
      const directRawEvent = Array.from(directMatch)
        .map((event) => event.rawEvent() as NostrEvent)
        .find((event) => event.id === eventId);
      if (directRawEvent) return directRawEvent;

      const authoredMatch = await ndk.fetchEvents(
        {
          kinds: [982 as NDKKind],
          '#d': [slug],
          authors: currentUser ? [currentUser.pubkey] : undefined,
          limit: 12
        },
        { closeOnEose: true }
      );
      return (
        Array.from(authoredMatch)
          .map((event) => event.rawEvent() as NostrEvent)
          .find((event) => event.id === eventId || parseMarketEvent(event)?.slug === slug) ?? undefined
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
      marketEvent.kind = 982;
      marketEvent.content = body.trim();
      marketEvent.tags = buildMarketEventTags({
        title,
        slug,
        description,
        category,
        topics,
        linkedMarkets
      });

      if (!paperEdition) {
        await marketEvent.publish();
        await navigateToMarket(slug);
        return;
      }

      await marketEvent.sign();
      builderStatus = 'Publishing market.';
      await marketEvent.publish();
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

<section class="builder-page">
  <header class="builder-header">
    <div class="eyebrow">Create Market</div>
    <h1>Create Market</h1>
    <p>
      Publish the claim, the case, and the surrounding context. Linked markets are informational only. They do not
      move each other.
    </p>
  </header>

  <nav class="builder-steps" aria-label="Builder steps">
    {#each steps as item, index}
      <div class:active={index === step}>
        <span>{index + 1}</span>
        <strong>{item.label}</strong>
      </div>
    {/each}
  </nav>

  <section class="builder-shell">
    {#if step === 0}
      <div class="builder-section">
        <input
          bind:value={title}
          class="builder-title input input-bordered rounded-none px-0 shadow-none"
          placeholder="Market title"
          type="text"
        />

        <div class="builder-subsection">
          <span>Examples</span>
          <div class="builder-chip-row">
            {#each examples as example}
              <button class="builder-chip btn btn-outline btn-sm" onclick={() => (title = example)} type="button">
                {example}
              </button>
            {/each}
          </div>
        </div>

        <div class="builder-subsection">
          <span>Summary</span>
          <textarea
            bind:value={description}
            class="builder-summary textarea textarea-bordered"
            placeholder="What is this market tracking, and why should someone care?"
          ></textarea>
        </div>

        <div class="builder-note">
          Markets stay open. Price changes as people buy or sell.
        </div>
      </div>
    {/if}

    {#if step === 1}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Make your claim</h2>
          <p>
            This is your public argument. Write it as if the other side is already reading and looking for weak links.
          </p>
        </div>

        <textarea
          bind:value={body}
          class="builder-body textarea textarea-bordered"
          placeholder="Lay out the logic, the evidence, and the path you expect reality to take."
        ></textarea>
      </div>
    {/if}

    {#if step === 2}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Link related markets</h2>
          <p>
            Attach related markets that strengthen or challenge the case. These are references for readers, not
            pricing dependencies.
          </p>
        </div>

        <div class="builder-search">
          <input
            class="input input-bordered"
            bind:value={linkSearch}
            placeholder="Search markets to add as references"
            type="text"
          />
        </div>

        <div class="builder-link-results">
          {#if filteredMarkets.length > 0}
            {#each filteredMarkets as market (market.id)}
              <button class="builder-result" onclick={() => addLink(market)} type="button">
                <strong>{market.title}</strong>
                <span>{market.description || market.slug}</span>
              </button>
            {/each}
          {:else}
            <div class="builder-empty">No matching markets found.</div>
          {/if}
        </div>

        <div class="builder-selected">
          {#if linkedMarkets.length > 0}
            {#each linkedMarkets as item (item.id)}
              <div class="builder-selected-row">
                <div class="builder-selected-copy">
                  <strong>{item.title}</strong>
                  <p>{item.slug}</p>
                </div>

                <div class="builder-selected-controls">
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
            <div class="builder-empty">
              No references yet. You can still publish the market without linked context.
            </div>
          {/if}
        </div>

        <div class="builder-meta-grid">
          <label class="builder-field">
            <span class="text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase">Categories</span>
            <input class="input input-bordered" bind:value={category} placeholder="ai, economics" type="text" />
          </label>
          <label class="builder-field">
            <span class="text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase">Topics</span>
            <input class="input input-bordered" bind:value={topics} placeholder="agents, labor, energy" type="text" />
          </label>
        </div>
      </div>
    {/if}

    {#if step === 3}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Review</h2>
          <p>Review how this will appear before you go live.</p>
        </div>

        <div class="review-block">
          <span>Title</span>
          <strong>{title || '-'}</strong>
        </div>
        <div class="review-block">
          <span>Summary</span>
          <p>{description || '-'}</p>
        </div>
        <div class="review-block">
          <span>Case</span>
          <p>{body || '-'}</p>
        </div>
        <div class="review-block">
          <span>Linked markets</span>
          <p>{linkedMarkets.length > 0 ? linkedMarkets.map((item) => item.title).join(' · ') : 'None attached.'}</p>
        </div>
        {#if paperEdition}
          <div class="review-block">
            <span>Opening stake</span>
            <div class="builder-launch-grid">
              <label class="builder-field">
                <span class="text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase">Initial funding</span>
                <input
                  aria-label="Initial funding"
                  class="input input-bordered"
                  bind:value={seedAmount}
                  min="100"
                  step="100"
                  type="number"
                />
              </label>
              <label class="builder-field">
                <span class="text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase">Your position</span>
                <select aria-label="Your position" class="select select-bordered" bind:value={seedSide}>
                  <option value="long">LONG</option>
                  <option value="short">SHORT</option>
                </select>
              </label>
            </div>
            <p>{formatUsdMinor(parsedSeedAmount)} total spend. Fees stay inside that amount.</p>
          </div>
        {/if}
      </div>
    {/if}

    {#if errorMessage}
      <p class="negative">{errorMessage}</p>
    {/if}
    {#if builderStatus}
      <p class="builder-status">{builderStatus}</p>
    {/if}

    {#if paperEdition && creatorMarkets.length > 0}
      <section class="builder-section">
        <div class="builder-copy">
          <h2>Your markets</h2>
          <p>Your market goes live with the first trade.</p>
        </div>

        <div class="builder-selected">
          {#each creatorMarkets as market (market.event_id)}
            <div class="builder-selected-row">
              <div class="builder-selected-copy">
                <strong>{market.title}</strong>
                <p>{market.visibility === 'public' ? 'Public' : 'Pending'}</p>
              </div>
              <div class="builder-selected-controls">
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
      </section>
    {/if}

    <div class="builder-actions">
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
  </section>
</section>

<style>
  .builder-page {
    display: grid;
    gap: 2rem;
    width: min(calc(100% - 2.5rem), 68rem);
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }

  .builder-header h1 {
    font-size: 2rem;
    letter-spacing: -0.04em;
  }

  .builder-header p {
    max-width: 48rem;
    margin-top: 0.7rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .builder-steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .builder-steps div {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.9rem 1rem;
    background: var(--color-base-100);
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
  }

  .builder-steps div.active {
    color: white;
  }

  .builder-steps span {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .builder-steps strong {
    font-size: 0.92rem;
    font-weight: 500;
  }

  .builder-shell {
    display: grid;
    gap: 1.5rem;
  }

  .builder-section {
    display: grid;
    gap: 1.5rem;
  }

  .builder-title {
    min-height: auto;
    padding-left: 0;
    padding-right: 0;
    padding-bottom: 1rem;
    font-size: clamp(2.2rem, 4vw, 3.2rem);
    letter-spacing: -0.05em;
  }

  .builder-summary,
  .builder-body {
    min-height: 10rem;
    resize: vertical;
  }

  .builder-subsection,
  .builder-copy {
    display: grid;
    gap: 0.65rem;
  }

  .builder-subsection span,
  .builder-copy p,
  .builder-note,
  .builder-result span,
  .builder-selected-copy p,
  .builder-empty,
  .review-block span,
  .review-block p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .builder-copy h2 {
    font-size: 1.25rem;
  }

  .builder-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .builder-result:hover {
    border-color: var(--color-neutral);
    color: white;
  }

  .builder-note {
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    padding-top: 1rem;
    font-size: 0.88rem;
  }

  .builder-link-results,
  .builder-selected {
    display: grid;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .builder-result,
  .builder-selected-row {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .builder-result {
    border-left: 0;
    border-right: 0;
    background: transparent;
    text-align: left;
  }

  .builder-selected-row {
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 1.5fr);
    gap: 1rem;
  }

  .builder-selected-controls {
    display: grid;
    grid-template-columns: 10rem minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
  }

  .builder-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .builder-launch-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .builder-field {
    display: grid;
    gap: 0.45rem;
  }

  .builder-field span,
  .review-block span {
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .review-block {
    display: grid;
    gap: 0.35rem;
    padding: 1rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .review-block strong {
    color: white;
    font-size: 1rem;
  }

  .builder-status {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .builder-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .builder-steps,
    .builder-meta-grid,
    .builder-launch-grid {
      grid-template-columns: 1fr;
    }

    .builder-selected-row,
    .builder-selected-controls {
      grid-template-columns: 1fr;
    }
  }
</style>
