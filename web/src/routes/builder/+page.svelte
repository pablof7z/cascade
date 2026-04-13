<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
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
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { formatUsdMinor } from '$lib/cascade/format';
  import { getProductApiUrl, isPaperEdition } from '$lib/cascade/config';
  import {
    attachTradeReceiptQuoteId,
    clearTradeReceipt,
    listTradeReceipts,
    markTradeReceiptTradeId,
    trackTradeReceipt
  } from '$lib/cascade/recovery';
  import { ndk } from '$lib/ndk/client';
  import { parseMarketEvent, type MarketRecord } from '$lib/ndk/cascade';
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

  type DraftLink = {
    id: string;
    slug: string;
    title: string;
    direction: 'yes' | 'no';
    note: string;
  };

  type Step = 0 | 1 | 2 | 3;
  type CreatorMarket = {
    event_id: string;
    slug: string;
    title: string;
    visibility: string;
    volume_minor: number;
    trade_count: number;
  };

  const examples = [
    'Will AGI emerge before 2030?',
    'Will Europe avoid a recession through 2027?',
    'Will open models overtake frontier closed models in daily usage?'
  ];

  const currentUser = $derived(ndk.$currentUser);
  const marketFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [982], limit: 200 }] };
  });

  let step = $state<Step>(0);
  let title = $state('');
  let description = $state('');
  let body = $state('');
  let category = $state('');
  let topics = $state('');
  let mintUrl = $state(env.PUBLIC_CASCADE_MINT_URL || '');
  let mintPubkey = $state(env.PUBLIC_CASCADE_MINT_PUBKEY || '');
  let linkSearch = $state('');
  let linkedMarkets = $state<DraftLink[]>([]);
  let saving = $state(false);
  let errorMessage = $state('');
  let builderStatus = $state('');
  let seedAmount = $state('10000');
  let seedSide = $state<'yes' | 'no'>('yes');
  let creatorMarkets = $state<CreatorMarket[]>([]);
  let publicReferenceMarkets = $state<MarketRecord[]>([]);

  const steps = [
    { label: 'Claim' },
    { label: 'Case' },
    { label: 'Links' },
    { label: 'Review' }
  ];

  const availableMarkets = $derived.by(() => {
    if (paperEdition) {
      return publicReferenceMarkets;
    }

    const items: MarketRecord[] = [];
    const seen = new Set<string>();
    for (const event of marketFeed.events) {
      const market = parseMarketEvent(event.rawEvent());
      if (!market || seen.has(market.id)) continue;
      seen.add(market.id);
      items.push(market);
    }
    return items;
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
  const portfolioLabel = $derived(paperEdition ? 'signet portfolio' : 'portfolio');
  const parsedSeedAmount = $derived(Number.parseInt(seedAmount, 10) || 0);

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
        direction: 'yes',
        note: ''
      }
    ];
    linkSearch = '';
  }

  function removeLink(id: string) {
    linkedMarkets = linkedMarkets.filter((item) => item.id !== id);
  }

  function updateLinkDirection(id: string, direction: 'yes' | 'no') {
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

  function availableLocalUsdMinor(): number {
    return localProofBalance(proofMintUrl(), 'usd');
  }

  function marketUnitForSide(marketSlug: string, side: 'yes' | 'no'): string {
    return side === 'yes' ? `long_${marketSlug}` : `short_${marketSlug}`;
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
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.issuedPreparation, issued.signatures)
        : await restorePreparedOutputs(proofMintUrl(), receipt.issuedPreparation)
      : [];
    const changeProofs = receipt.changePreparation
      ? change
        ? await unblindPreparedOutputs(proofMintUrl(), receipt.changePreparation, change.signatures)
        : await restorePreparedOutputs(proofMintUrl(), receipt.changePreparation)
      : [];

    if (!issuedProofs.length && !changeProofs.length) {
      throw new Error('seed_proofs_missing');
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

  async function seedPendingMarket(eventId: string, slug: string) {
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

      const quoteResponse = await quoteBuyTrade({
        eventId,
        side: seedSide,
        spendMinor: parsedSeedAmount
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
        throw new Error(`Your ${portfolioLabel} no longer has enough local proofs for this seed.`);
      }
      const issuedUnit = marketUnitForSide(slug, (quote.side as 'yes' | 'no') ?? seedSide);
      const { outputs: issuedOutputs, preparation: issuedPreparation } = await prepareProofOutputs(
        proofMintUrl(),
        issuedUnit,
        quote.quantity_minor
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
        side: seedSide,
        spentUnit: 'usd',
        spentProofs: spendProofs,
        issuedPreparation,
        changePreparation
      });

      const seed = await buyMarketPosition({
        eventId,
        pubkey: currentUser.pubkey,
        side: (quote.side as 'yes' | 'no') ?? seedSide,
        spendMinor: quote.spend_minor,
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
        builderStatus = 'Market seeded and now public.';
      } else {
        builderStatus = 'Market seed submitted. Waiting for settlement.';
      }
      await loadCreatorMarkets();
      await navigateToMarket(slug);
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
      marketEvent.tags = [
        ['title', title.trim()],
        ['d', slug],
        ['description', description.trim()],
        ['status', 'open'],
        ...category
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .map((item) => ['c', item] as string[]),
        ...topics
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .map((item) => ['t', item] as string[]),
        ...(mintUrl.trim() ? ([['mint', mintUrl.trim()]] as string[][]) : []),
        ...(mintPubkey.trim() ? ([['mint-pubkey', mintPubkey.trim()]] as string[][]) : []),
        ...linkedMarkets.flatMap((item) => {
          const tags: string[][] = [
            ['e', item.id, '', 'reference'],
            ['signal-direction', item.id, item.direction]
          ];
          if (item.note.trim()) tags.push(['signal-note', item.id, item.note.trim()]);
          return tags;
        })
      ];

      if (!paperEdition) {
        await marketEvent.publish();
        await navigateToMarket(slug);
        return;
      }

      await marketEvent.sign();
      const rawEvent = marketEvent.rawEvent();
      const eventId = rawEvent.id || marketEvent.id;
      if (!eventId) {
        throw new Error('Published market is missing an event id.');
      }

      builderStatus = 'Market published. Registering it with the mint.';
      const created = await fetch(`${getProductApiUrl()}/api/product/markets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: title.trim(),
          description: description.trim(),
          slug,
          body: body.trim(),
          creator_pubkey: currentUser.pubkey,
          raw_event: rawEvent,
          b: 10.0
        })
      });

      if (!created.ok && created.status !== 409) {
        const payload = (await created.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || 'Failed to register market with the mint.');
      }

      void marketEvent.publish().catch((error) => {
        console.warn('Best-effort market publish failed in signet mode', error);
      });

      await loadCreatorMarkets();

      const availableMinor = availableLocalUsdMinor();
      if (availableMinor < parsedSeedAmount) {
        builderStatus = `Market is pending. Fund your ${portfolioLabel}, then seed the market from this page.`;
        errorMessage = `Your ${portfolioLabel} has ${formatUsdMinor(availableMinor)}. Add at least ${formatUsdMinor(parsedSeedAmount)} to launch this market publicly.`;
        return;
      }

      await seedPendingMarket(eventId, slug);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to publish market.';
    } finally {
      if (saving) {
        saving = false;
      }
    }
  }

  async function loadCreatorMarkets() {
    if (!browser || !paperEdition || !currentUser) return;
    const response = await fetch(`${getProductApiUrl()}/api/product/markets/creator/${currentUser.pubkey}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { markets?: CreatorMarket[] };
    creatorMarkets = payload.markets ?? [];
  }

  async function loadPublicReferenceMarkets() {
    if (!browser || !paperEdition) return;
    const response = await fetch(`${getProductApiUrl()}/api/product/feed`);
    if (!response.ok) return;
    const payload = (await response.json()) as { markets?: NostrEvent[] };
    publicReferenceMarkets = (payload.markets ?? [])
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market));
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
          await loadCreatorMarkets();
          await navigateToMarket(payload.market.slug);
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
            await loadCreatorMarkets();
            await navigateToMarket(tradePayload.market.slug);
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
          await loadCreatorMarkets();
          await navigateToMarket(tradePayload.market.slug);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  $effect(() => {
    if (!browser || !paperEdition || !currentUser) return;
    void (async () => {
      await loadCreatorMarkets();
      await reconcileSeedRequests();
    })();
  });

  $effect(() => {
    if (!browser || !paperEdition) return;
    void loadPublicReferenceMarkets();
  });
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
          class="builder-title"
          placeholder="Market title"
          type="text"
        />

        <div class="builder-subsection">
          <span>Examples</span>
          <div class="builder-chip-row">
            {#each examples as example}
              <button class="builder-chip" onclick={() => (title = example)} type="button">{example}</button>
            {/each}
          </div>
        </div>

        <div class="builder-subsection">
          <span>Summary</span>
          <textarea
            bind:value={description}
            class="builder-summary"
            placeholder="What is this market tracking, and why should someone care?"
          ></textarea>
        </div>

        <div class="builder-note">
          Markets stay open. Price changes as people mint into a side or withdraw at a new level.
        </div>
      </div>
    {/if}

    {#if step === 1}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Go on record</h2>
          <p>
            This is your public argument. Write it as if the other side is already reading and looking for weak links.
          </p>
        </div>

        <textarea
          bind:value={body}
          class="builder-body"
          placeholder="Lay out the logic, the evidence, and the path you expect reality to take."
        ></textarea>
      </div>
    {/if}

    {#if step === 2}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Map the context</h2>
          <p>
            Attach related markets that strengthen or challenge the case. These are references for readers, not
            pricing dependencies.
          </p>
        </div>

        <div class="builder-search">
          <input bind:value={linkSearch} placeholder="Search markets to add as references" type="text" />
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
                  <select bind:value={item.direction} onchange={(event) => updateLinkDirection(item.id, (event.currentTarget as HTMLSelectElement).value as 'yes' | 'no')}>
                    <option value="yes">Supports LONG</option>
                    <option value="no">Supports SHORT</option>
                  </select>
                  <input
                    oninput={(event) => updateLinkNote(item.id, (event.currentTarget as HTMLInputElement).value)}
                    placeholder="Why this link matters"
                    type="text"
                    value={item.note}
                  />
                  <button class="button-ghost" onclick={() => removeLink(item.id)} type="button">Remove</button>
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
            <span>Categories</span>
            <input bind:value={category} placeholder="ai, economics" type="text" />
          </label>
          <label class="builder-field">
            <span>Topics</span>
            <input bind:value={topics} placeholder="agents, labor, energy" type="text" />
          </label>
          <label class="builder-field">
            <span>Mint URL</span>
            <input bind:value={mintUrl} placeholder="https://mint.example.com" type="text" />
          </label>
          <label class="builder-field">
            <span>Mint Pubkey</span>
            <input bind:value={mintPubkey} placeholder="Optional" type="text" />
          </label>
        </div>
      </div>
    {/if}

    {#if step === 3}
      <div class="builder-section">
        <div class="builder-copy">
          <h2>Review</h2>
          <p>Check the public framing before you publish.</p>
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
            <span>Launch spend</span>
            <div class="builder-launch-grid">
              <label class="builder-field">
                <span>Seed spend</span>
                <input bind:value={seedAmount} min="100" step="100" type="number" />
              </label>
              <label class="builder-field">
                <span>Opening side</span>
                <select bind:value={seedSide}>
                  <option value="yes">LONG</option>
                  <option value="no">SHORT</option>
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
          <p>Pending markets stay private until the mint records the first trade.</p>
        </div>

        <div class="builder-selected">
          {#each creatorMarkets as market (market.event_id)}
            <div class="builder-selected-row">
              <div class="builder-selected-copy">
                <strong>{market.title}</strong>
                <p>{market.visibility === 'public' ? 'Public' : 'Pending'} · {formatUsdMinor(market.volume_minor)} volume · {market.trade_count} trades</p>
              </div>
              <div class="builder-selected-controls">
                <input readonly type="text" value={market.slug} />
                {#if market.visibility === 'public'}
                  <a class="button-secondary" href={`/market/${market.slug}`}>Open market</a>
                {:else}
                  <button class="button-secondary" disabled={saving || parsedSeedAmount <= 0} onclick={() => void seedPendingMarket(market.event_id, market.slug)} type="button">
                    Seed now
                  </button>
                  <a class="button-secondary" href="/portfolio">Fund portfolio</a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <div class="builder-actions">
      {#if step > 0}
        <button class="button-secondary" onclick={previousStep} type="button">Back</button>
      {/if}

      {#if step < 3}
        <button class="button-primary" disabled={!canAdvance} onclick={nextStep} type="button">Continue</button>
      {:else}
        <button class="button-primary" disabled={saving} onclick={publishMarket} type="button">
          {saving ? 'Publishing...' : 'Create Market'}
        </button>
      {/if}

      <a class="button-ghost" href="/">Back to Markets</a>
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
    color: var(--text-muted);
  }

  .builder-steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .builder-steps div {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.9rem 1rem;
    background: var(--bg);
    color: var(--text-faint);
  }

  .builder-steps div.active {
    color: var(--text-strong);
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

  .builder-title,
  .builder-summary,
  .builder-body,
  .builder-search input,
  .builder-field input,
  .builder-selected-controls input,
  .builder-selected-controls select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-subtle);
    background: var(--bg);
    color: var(--text-strong);
    padding: 0.85rem 0.95rem;
  }

  .builder-title {
    border-width: 0 0 1px;
    padding: 0 0 1rem;
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
    color: var(--text-muted);
  }

  .builder-copy h2 {
    font-size: 1.25rem;
  }

  .builder-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .builder-chip {
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text);
    padding: 0.5rem 0.8rem;
  }

  .builder-chip:hover,
  .builder-result:hover {
    border-color: var(--border);
    color: var(--text-strong);
  }

  .builder-note {
    border-top: 1px solid var(--border-subtle);
    padding-top: 1rem;
    font-size: 0.88rem;
  }

  .builder-link-results,
  .builder-selected {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .builder-result,
  .builder-selected-row {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
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
    border-top: 1px solid var(--border-subtle);
  }

  .review-block strong {
    color: var(--text-strong);
    font-size: 1rem;
  }

  .builder-status {
    color: var(--text-muted);
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
