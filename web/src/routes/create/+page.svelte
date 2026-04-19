<script lang="ts">
	import { onMount } from 'svelte';

	// Step definitions
	const STEPS = [
		{ number: 1, label: 'Title & category' },
		{ number: 2, label: 'Make your case' },
		{ number: 3, label: 'Details' },
		{ number: 4, label: 'Launch' }
	];

	const CATEGORIES = [
		'Crypto',
		'Politics',
		'Economics',
		'Science',
		'Culture',
		'Sports',
		'Technology',
		'World'
	];

	// State
	let currentStep = $state(1);
	let form = $state({
		claim: '',
		category: '',
		caseText: '',
		linkedMarkets: [] as string[]
	});

	// Step 3: Details state
	let imageMode = $state<'gradient' | 'upload' | 'url'>('gradient');
	let imageUrl = $state('');
	let summaryText = $state('');

	// Step 3: Tags state
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	const suggestedTags = ['bullish', 'bearish', 'macro', 'crypto', 'tech', 'prediction'];

	// Step 4: Launch state
	let seedSide = $state<'yes' | 'no'>('yes');
	let seedAmount = $state(100);
	let invites = $state<string[]>([]);
	let published = $state(false);
	let publishedMarket = $state<{ slug: string; eventId: string } | null>(null);

	// Quick pick amounts for seed
	const quickAmounts = [25, 50, 100, 250, 500];

	// Derived: auto-generate summary from caseText
	$effect(() => {
		if (!summaryText && form.caseText) {
			// Take first sentence or first 160 chars
			const firstSentence = form.caseText.split(/[.!?]/)[0]?.trim() || '';
			summaryText = firstSentence.length > 160 ? firstSentence.slice(0, 157) + '...' : firstSentence;
		}
	});

	// Derived: seed math
	const seedMath = $derived.by(() => {
		// LMSR pricing: p = 1 / (1 + e^(-b/c)) where b = backing, c = liquidity constant
		// For simplicity, use a fixed liquidity constant of $100
		const liquidityConstant = 100;
		const backing = seedAmount;
		const price = backing / (backing + liquidityConstant);
		const priceCents = Math.round(price * 100);
		const shares = Math.round((backing / price) * 100) / 100;

		return {
			shares: seedSide === 'yes' ? shares : shares,
			avgPrice: priceCents,
			openingPrice: Math.round(price * 100),
			liquidity: seedAmount
		};
	});

	// Tag functions
	function addTag(tag: string) {
		const normalized = tag.trim().toLowerCase();
		if (normalized && !tags.includes(normalized)) {
			tags = [...tags, normalized];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag(tagInput);
		}
	}

	// Navigation
	function goToStep(step: number) {
		if (step >= 1 && step <= 4) {
			currentStep = step;
		}
	}

	function nextStep() {
		if (currentStep < 4) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function skipDetails() {
		nextStep();
	}

	async function launchMarket() {
		// Submit form data to server action
		const formData = new FormData();
		formData.append('claim', form.claim);
		formData.append('category', form.category);
		formData.append('caseText', form.caseText);
		formData.append('imageUrl', imageMode === 'url' ? imageUrl : '');
		formData.append('summaryText', summaryText);
		formData.append('tags', JSON.stringify(tags));
		formData.append('seedSide', seedSide);
		formData.append('seedAmount', String(seedAmount));

		try {
			const response = await fetch('?/createMarket', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success' && result.data?.success) {
				published = true;
				publishedMarket = result.data.market;
				currentStep = 5; // Show success state
			} else {
				// Show error from server
				errorMessage = result.data?.error || 'Failed to launch market. Please try again.';
			}
		} catch (err) {
			errorMessage = 'Network error. Please check your connection and try again.';
		}
	}

	// Error message state
	let errorMessage = $state('');

	// Step 1: Category selection
	function selectCategory(cat: string) {
		form.category = cat;
	}

	// Step 2: Linked markets
	let newMarketUrl = $state('');

	function addLinkedMarket() {
		if (newMarketUrl.trim() && !form.linkedMarkets.includes(newMarketUrl.trim())) {
			form.linkedMarkets = [...form.linkedMarkets, newMarketUrl.trim()];
			newMarketUrl = '';
		}
	}

	function removeLinkedMarket(url: string) {
		form.linkedMarkets = form.linkedMarkets.filter((m) => m !== url);
	}

	// Character count
	let claimLength = $derived(form.claim.length);
	let caseLength = $derived(form.caseText.length);

	// ── Autosave ──────────────────────────────────────────────────────────────
	const DRAFT_KEY = 'cascade-create-draft';
	let savedAt = $state<number | null>(null);
	let savedAgo = $state(0);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function saveDraft() {
		if (typeof localStorage === 'undefined') return;
		const data = {
			step: currentStep,
			claim: form.claim,
			category: form.category,
			caseText: form.caseText,
			imageMode,
			imageUrl,
			summaryText,
			tags,
			seedSide,
			seedAmount,
			linkedMarkets: form.linkedMarkets,
			savedAt: Date.now()
		};
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
		savedAt = data.savedAt;
		savedAgo = 0;
	}

	function clearDraft() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(DRAFT_KEY);
		}
		savedAt = null;
	}

	// Debounce autosave on field changes
	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(saveDraft, 5000);
	}

	// Watch all form fields
	$effect(() => {
		// Access all fields to track them
		form.claim; form.category; form.caseText; imageMode; imageUrl;
		summaryText; tags; seedSide; seedAmount; form.linkedMarkets;
		if (!published) scheduleSave();
	});

	// Clear draft when published
	$effect(() => {
		if (published) clearDraft();
	});

	onMount(() => {
		// Restore draft
		const raw = localStorage?.getItem(DRAFT_KEY);
		if (raw) {
			try {
				const d = JSON.parse(raw);
				// Don't restore if draft is older than 7 days
				if (d.savedAt && Date.now() - d.savedAt < 7 * 24 * 60 * 60 * 1000) {
					currentStep = d.step ?? 1;
					form.claim = d.claim ?? '';
					form.category = d.category ?? '';
					form.caseText = d.caseText ?? '';
					imageMode = d.imageMode ?? 'gradient';
					imageUrl = d.imageUrl ?? '';
					summaryText = d.summaryText ?? '';
					tags = d.tags ?? [];
					seedSide = d.seedSide ?? 'yes';
					seedAmount = d.seedAmount ?? 100;
					form.linkedMarkets = d.linkedMarkets ?? [];
					savedAt = d.savedAt ?? null;
					savedAgo = savedAt ? Math.floor((Date.now() - savedAt) / 1000) : 0;
				}
			} catch {
				// ignore corrupt draft
			}
		}

		// Tick saved-ago counter every second
		const interval = setInterval(() => {
			if (savedAt) {
				savedAgo = Math.floor((Date.now() - savedAt) / 1000);
			}
		}, 1000);

		return () => {
			clearInterval(interval);
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	// ── Copy helpers ──────────────────────────────────────────────────────────
	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
	}

	// ── Post-publish toolkit state ─────────────────────────────────────────────
	let copyTab = $state<'punchy' | 'thoughtful' | 'direct'>('punchy');
	let embedTab = $state<'iframe' | 'markdown' | 'html'>('iframe');

	// Build market URL from slug
	const marketUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/market/${publishedMarket?.slug ?? ''}`
			: `/market/${publishedMarket?.slug ?? ''}`
	);

	// Copy text drafts
	const copyTexts = $derived({
		punchy: `I put ${seedAmount} down that ${form.claim}. The crowd's at ${seedMath.openingPrice}¢ ${seedSide.toUpperCase()}. If you disagree, take the other side — the market's open. ${marketUrl}`,
		thoughtful: `Been thinking about this one: "${form.claim}". Put ${seedAmount} on it — market's live at ${seedMath.openingPrice}¢ ${seedSide.toUpperCase()}. Curious what the odds look like to you. ${marketUrl}`,
		direct: `"${form.claim}" — market is live. Current price: ${seedMath.openingPrice}¢ ${seedSide.toUpperCase()}. Seed: ${seedAmount}. ${marketUrl}`
	});

	// Embed codes
	const embedCodes = $derived({
		iframe: `<iframe src="${marketUrl}/embed" width="600" height="400" frameborder="0"></iframe>`,
		markdown: `[![${form.claim}](${marketUrl}/preview.png)](${marketUrl})`,
		html: `<a href="${marketUrl}">${form.claim}</a>`
	});

	// QR code: generate a simple SVG data URL using a QR library approach
	// We'll use a data URL with a QR code API for simplicity
	const qrCodeUrl = $derived(
		`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(marketUrl)}`
	);

	// Twitter share URL
	function getTwitterShareUrl() {
		return `https://twitter.com/intent/tweet?text=${encodeURIComponent(copyTexts.punchy)}`;
	}

	// LinkedIn share URL
	function getLinkedInShareUrl() {
		return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(marketUrl)}`;
	}

	// Format seed amount for display
	const seedDisplay = $derived(`${seedAmount} of your own capital behind it at ${seedMath.openingPrice}¢ ${seedSide.toUpperCase()}`);
</script>

<div class="create-page">
	<!-- Stepper -->
	<nav class="stepper" aria-label="Progress">
		{#if savedAt !== null}
			<span class="draft-indicator" title="Draft auto-saved">
				<span class="draft-dot"></span>
				Draft saved · {savedAgo < 60 ? `${savedAgo}s ago` : savedAgo < 3600 ? `${Math.floor(savedAgo / 60)}m ago` : `${Math.floor(savedAgo / 3600)}h ago`}
			</span>
		{/if}
		{#each STEPS as step, index}
			<button
				class="stepper-step"
				class:active={currentStep === step.number}
				class:completed={currentStep > step.number}
				onclick={() => goToStep(step.number)}
				aria-current={currentStep === step.number ? 'step' : undefined}
			>
				<span class="step-dot">
					{#if currentStep > step.number}
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M3 8l3.5 3.5L13 5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{:else}
						{step.number}
					{/if}
				</span>
				<span class="step-label">{step.label}</span>
			</button>
			{#if index < STEPS.length - 1}
				<div
					class="stepper-connector"
					class:completed={currentStep > step.number}
				></div>
			{/if}
		{/each}
	</nav>

	<!-- Step content -->
	<div class="step-content">
		{#if currentStep === 1}
			<!-- Step 1: Title & Category -->
			<div class="step-1">
				<header class="step-header">
					<p class="eyebrow">Step 1 of 4</p>
					<h1>Write your claim</h1>
					<p class="step-description">
						State the outcome you believe will happen. Be specific and measurable.
					</p>
				</header>

				<div class="claim-field">
					<textarea
						class="claim-textarea"
						bind:value={form.claim}
						placeholder="e.g. Bitcoin breaks $150,000 before end of 2026"
						maxlength="280"
						rows="3"
					></textarea>
					<div class="claim-meta">
						<span class="char-count">{claimLength} / 280</span>
					</div>
				</div>

				<div class="category-section">
					<h2 class="section-label">Category</h2>
					<div class="category-tabs" role="tablist">
						{#each CATEGORIES as cat}
							<button
								class="category-tab"
								class:selected={form.category === cat}
								role="tab"
								aria-selected={form.category === cat}
								onclick={() => selectCategory(cat)}
							>
								{cat}
							</button>
						{/each}
					</div>
				</div>

				<div class="duplicate-section">
					<h2 class="section-label">Similar markets</h2>
					<p class="empty-state">
						Start writing your claim above to see similar markets already live.
					</p>
				</div>
			</div>
		{:else if currentStep === 2}
			<!-- Step 2: Make your case -->
			<div class="step-2">
				<header class="step-header">
					<p class="eyebrow">Step 2 of 4</p>
					<h1>Make your case</h1>
					<p class="step-description">
						Write the argument for your claim. Links to related markets are informational only.
					</p>
				</header>

				<div class="case-field">
					<textarea
						class="case-textarea"
						bind:value={form.caseText}
						placeholder="Explain your reasoning. Why do you believe this outcome will happen? What evidence supports your view?"
						rows="12"
					></textarea>
					<div class="case-meta">
						<span class="word-count">{caseLength > 0 ? Math.round(caseLength / 5) : 0} words</span>
					</div>
				</div>

				<div class="linked-section">
					<h2 class="section-label">Related markets</h2>
					<p class="linked-note">
						Links are informational only — links don't move price.
					</p>

					{#if form.linkedMarkets.length > 0}
						<ul class="linked-list">
							{#each form.linkedMarkets as market}
								<li class="linked-item">
									<span class="linked-url">{market}</span>
									<button
										class="linked-remove"
										onclick={() => removeLinkedMarket(market)}
										aria-label="Remove linked market"
									>
										<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
											<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
										</svg>
									</button>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="linked-add">
						<input
							type="url"
							class="linked-input"
							bind:value={newMarketUrl}
							placeholder="Paste market URL..."
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addLinkedMarket();
								}
							}}
						/>
						<button class="linked-add-btn" onclick={addLinkedMarket} disabled={!newMarketUrl.trim()}>
							Add
						</button>
					</div>
				</div>
			</div>
		{:else if currentStep === 3}
			<!-- Step 3: Details -->
			<div class="step-3">
				<header class="step-header">
					<p class="eyebrow">Step 3 of 4</p>
					<h1>Add details</h1>
					<p class="step-description">
						Optional: add an image, summary, and tags to help readers understand your claim.
					</p>
				</header>

				<!-- Image block -->
				<div class="detail-block">
					<h2 class="section-label">Image</h2>
					<div class="image-layout">
						<div class="image-preview">
							{#if imageMode === 'gradient'}
								<div class="gradient-preview" style="background: linear-gradient(135deg, hsl({form.category.length * 30}, 70%, 50%), hsl({form.category.length * 30 + 60}, 70%, 40%))">
									<span class="gradient-category">{form.category || 'Category'}</span>
								</div>
							{:else if imageMode === 'url' && imageUrl}
								<img src={imageUrl} alt="Market preview" class="url-preview" />
							{:else}
								<div class="no-preview">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
										<rect x="3" y="3" width="18" height="18" rx="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
									<span>Add image URL</span>
								</div>
							{/if}
						</div>
						<div class="image-options">
							<label class="radio-option">
								<input type="radio" bind:group={imageMode} value="gradient" />
								<span class="radio-label">Use {form.category || 'Category'} gradient</span>
							</label>
							<label class="radio-option">
								<input type="radio" bind:group={imageMode} value="upload" />
								<span class="radio-label">Upload image</span>
								<span class="radio-hint">(coming soon)</span>
							</label>
							<label class="radio-option">
								<input type="radio" bind:group={imageMode} value="url" />
								<span class="radio-label">Use from URL</span>
							</label>
							{#if imageMode === 'url'}
								<input
									type="url"
									class="url-input"
									bind:value={imageUrl}
									placeholder="https://..."
								/>
							{/if}
						</div>
					</div>
				</div>

				<!-- Summary block -->
				<div class="detail-block">
					<h2 class="section-label">Summary</h2>
					<p class="block-hint">This appears in link previews and share cards.</p>
					<textarea
						class="summary-textarea"
						bind:value={summaryText}
						placeholder="Briefly describe your market..."
						rows="3"
						maxlength="280"
					></textarea>
					<div class="summary-meta">
						<button class="regenerate-btn" type="button" onclick={() => {
							// Regenerate from caseText
							const firstSentence = form.caseText.split(/[.!?]/)[0]?.trim() || '';
							summaryText = firstSentence.length > 160 ? firstSentence.slice(0, 157) + '...' : firstSentence;
						}}>
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M13 2.5A6 6 0 1 1 3.5 8" stroke-linecap="round" />
								<path d="M13 2.5V6h-3.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
							Regenerate
						</button>
						<span class="char-count">{summaryText.length} / 280</span>
					</div>
				</div>

				<!-- Tags block -->
				<div class="detail-block">
					<h2 class="section-label">Tags</h2>
					<div class="tags-input-wrapper">
						{#each tags as tag}
							<span class="tag">
								{tag}
								<button class="tag-remove" onclick={() => removeTag(tag)} aria-label="Remove tag">
									<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
									</svg>
								</button>
							</span>
						{/each}
						<input
							type="text"
							class="tag-input"
							bind:value={tagInput}
							placeholder="Add tag..."
							onkeydown={handleTagKeydown}
						/>
					</div>
					<div class="suggested-tags">
						<span class="suggested-label">Suggested:</span>
						{#each suggestedTags as tag}
							<button
								class="suggested-tag"
								class:selected={tags.includes(tag)}
								onclick={() => tags.includes(tag) ? removeTag(tag) : addTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else if currentStep === 4}
			<!-- Step 4: Launch -->
			<div class="step-4">
				<header class="step-header">
					<p class="eyebrow">Step 4 of 4</p>
					<h1>Launch your market</h1>
					<p class="step-description">
						Seed your market with real capital to bring it live.
					</p>
				</header>

				<!-- Seed explainer -->
				<div class="seed-explainer">
					<p class="seed-explainer-text">
						A market goes live when you put real money on it. Pick a side, size it, and you're the first trade.
						This is what gives the claim its opening price.
					</p>
				</div>

				<!-- Opening position controls -->
				<div class="seed-block">
					<h2 class="section-label">Opening position</h2>

					<!-- YES/NO toggle -->
					<div class="side-toggle">
						<button
							class="side-btn side-yes"
							class:active={seedSide === 'yes'}
							onclick={() => seedSide = 'yes'}
						>
							YES
						</button>
						<button
							class="side-btn side-no"
							class:active={seedSide === 'no'}
							onclick={() => seedSide = 'no'}
						>
							NO
						</button>
					</div>

					<!-- Amount input -->
					<div class="amount-section">
						<label class="amount-label">Seed amount</label>
						<div class="amount-input-wrapper">
							<span class="amount-prefix">$</span>
							<input
								type="number"
								class="amount-input"
								bind:value={seedAmount}
								min="1"
								max="100000"
							/>
						</div>
						<div class="quick-amounts">
							{#each quickAmounts as amt}
								<button
									class="quick-amount"
									class:active={seedAmount === amt}
									onclick={() => seedAmount = amt}
								>
									${amt}
								</button>
							{/each}
						</div>
					</div>

					<!-- Live math -->
					<div class="seed-math">
						<div class="math-row">
							<span class="math-label">You'll buy</span>
							<span class="math-value">{seedMath.shares.toFixed(0)} {seedSide.toUpperCase()}</span>
						</div>
						<div class="math-row">
							<span class="math-label">Avg. price</span>
							<span class="math-value">{seedMath.avgPrice}¢</span>
						</div>
						<div class="math-row">
							<span class="math-label">Opening price</span>
							<span class="math-value highlight">{seedMath.openingPrice}¢</span>
						</div>
						<div class="math-row">
							<span class="math-label">Market liquidity</span>
							<span class="math-value">${seedMath.liquidity}</span>
						</div>
					</div>

					<p class="seed-reassurance">
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
							<circle cx="8" cy="8" r="6" />
							<path d="M8 5v3M8 10.5v.5" stroke-linecap="round" />
						</svg>
						You're not paying a fee. This is capital you control.
					</p>
				</div>

				<!-- Invite people (optional) -->
				<div class="invite-block">
					<h2 class="section-label">Bring your people</h2>
					<p class="block-hint">Invite specific readers to trade this market at the opening price.</p>

					<div class="invite-search">
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
							<circle cx="6.5" cy="6.5" r="4" />
							<path d="M10 10l3 3" stroke-linecap="round" />
						</svg>
						<input
							type="text"
							class="invite-input"
							placeholder="Search for people..."
						/>
					</div>

					{#if invites.length > 0}
						<div class="invite-list">
							{#each invites as invite}
								<span class="invite-chip">
									{invite}
									<button onclick={() => invites = invites.filter(i => i !== invite)}>
										<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
										</svg>
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Error message -->
				{#if errorMessage}
					<div class="error-message">
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
							<circle cx="8" cy="8" r="6" />
							<path d="M8 5v3M8 10.5v.5" stroke-linecap="round" />
						</svg>
						{errorMessage}
					</div>
				{/if}
			</div>
		{:else if currentStep === 5 && publishedMarket}
			<!-- Post-publish toolkit -->
			<div class="toolkit">

				<!-- Hero -->
				<div class="toolkit-hero">
					<div class="toolkit-hero-content">
						<span class="live-eyebrow">
							<span class="status-dot"></span>
							YOUR CLAIM IS LIVE
						</span>
						<h1 class="toolkit-title">Now help it find its readers.</h1>
						<p class="toolkit-lede">
							Your claim sits at {seedMath.openingPrice}¢ {seedSide.toUpperCase()} with {seedDisplay}.
							Here's how to spread the word.
						</p>
						<div class="toolkit-hero-actions">
							<button class="btn-primary" onclick={() => copyToClipboard(marketUrl)}>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
									<rect x="5" y="5" width="8" height="8" rx="1.5" />
									<path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" stroke-linecap="round" />
								</svg>
								Copy sharing link
							</button>
							<a href="/market/{publishedMarket.slug}" class="btn-secondary">
								View live market
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</a>
						</div>
					</div>
					<!-- Portrait card preview -->
					<div class="portrait-card">
						<div class="portrait-inner">
							<div class="portrait-category">{form.category || 'Market'}</div>
							<div class="portrait-claim">{form.claim || 'Your claim here'}</div>
							<div class="portrait-price">
								<span class="portrait-price-value">{seedMath.openingPrice}¢</span>
								<span class="portrait-price-side {seedSide}">{seedSide.toUpperCase()}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Share buttons -->
				<div class="toolkit-section">
					<h2 class="toolkit-section-title">Share</h2>
					<div class="share-grid">
						<button class="social-btn copy-link" onclick={() => copyToClipboard(marketUrl)}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
								<rect x="9" y="9" width="13" height="13" rx="2" />
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round" />
							</svg>
							<span class="social-btn-label">Copy link</span>
						</button>
						<a href={getTwitterShareUrl()} target="_blank" rel="noopener" class="social-btn twitter">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
							</svg>
							<span class="social-btn-label">X / Twitter</span>
						</a>
						<a href={getLinkedInShareUrl()} target="_blank" rel="noopener" class="social-btn linkedin">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
							</svg>
							<span class="social-btn-label">LinkedIn</span>
						</a>
					</div>
				</div>

				<!-- Copy · three tones -->
				<div class="toolkit-section">
					<h2 class="toolkit-section-title">Copy · three tones</h2>
					<div class="tab-bar">
						<button class="tab-btn" class:active={copyTab === 'punchy'} onclick={() => copyTab = 'punchy'}>Punchy</button>
						<button class="tab-btn" class:active={copyTab === 'thoughtful'} onclick={() => copyTab = 'thoughtful'}>Thoughtful</button>
						<button class="tab-btn" class:active={copyTab === 'direct'} onclick={() => copyTab = 'direct'}>Direct</button>
					</div>
					<div class="copy-preview">
						<p class="copy-text">{copyTexts[copyTab]}</p>
						<button class="btn-copy" onclick={() => copyToClipboard(copyTexts[copyTab])}>
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
								<rect x="5" y="5" width="8" height="8" rx="1.5" />
								<path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" stroke-linecap="round" />
							</svg>
							Copy
						</button>
					</div>
				</div>

				<!-- Embed code -->
				<div class="toolkit-section">
					<h2 class="toolkit-section-title">Embed code</h2>
					<div class="tab-bar">
						<button class="tab-btn" class:active={embedTab === 'iframe'} onclick={() => embedTab = 'iframe'}>iframe</button>
						<button class="tab-btn" class:active={embedTab === 'markdown'} onclick={() => embedTab = 'markdown'}>Markdown</button>
						<button class="tab-btn" class:active={embedTab === 'html'} onclick={() => embedTab = 'html'}>HTML</button>
					</div>
					<div class="embed-preview">
						<code class="embed-code">{embedCodes[embedTab]}</code>
						<button class="btn-copy" onclick={() => copyToClipboard(embedCodes[embedTab])}>
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
								<rect x="5" y="5" width="8" height="8" rx="1.5" />
								<path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" stroke-linecap="round" />
							</svg>
							Copy
						</button>
					</div>
				</div>

				<!-- QR code -->
				<div class="toolkit-section">
					<h2 class="toolkit-section-title">QR code</h2>
					<div class="qr-section">
						<img src={qrCodeUrl} alt="QR code for {publishedMarket.slug}" class="qr-image" />
						<a href={qrCodeUrl} download="market-qr.png" class="btn-secondary">
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
								<path d="M2 14l4-4M8 4l4 4M2 10h4M10 6h4M2 6h4" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
							Download
						</a>
					</div>
				</div>

				<!-- What usually happens next -->
				<div class="toolkit-section">
					<h2 class="toolkit-section-title">What usually happens next</h2>
					<div class="next-cards">
						<div class="next-card">
							<span class="next-card-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							</span>
							<span class="next-card-title">Watch</span>
							<span class="next-card-desc">Check who's on the other side as traders weigh in.</span>
						</div>
						<div class="next-card">
							<span class="next-card-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</span>
							<span class="next-card-title">Write</span>
							<span class="next-card-desc">Publish a Note riffing on the claim or your reasoning.</span>
						</div>
						<div class="next-card">
							<span class="next-card-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M18 20V10M12 20V4M6 20v-6" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</span>
							<span class="next-card-title">Track</span>
							<span class="next-card-desc">Set a price-move alert to know when things shift.</span>
						</div>
					</div>
				</div>

			</div>
		{/if}
	</div>

	<!-- Footer navigation -->
	<footer class="page-footer" class:hidden={currentStep === 5}>
		<button
			class="footer-btn footer-back"
			onclick={prevStep}
			disabled={currentStep === 1 || currentStep === 5}
		>
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
				<path d="M10 3L5 8l5 5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Back
		</button>

		<span class="footer-step-indicator">Step {currentStep} of 4</span>

		{#if currentStep === 4}
			<button class="footer-btn footer-launch" onclick={launchMarket}>
				Launch market · ${seedAmount}
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
					<path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		{:else if currentStep === 3}
			<button class="footer-btn footer-skip" onclick={skipDetails}>
				Skip
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
					<path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		{:else}
			<button class="footer-btn footer-continue" onclick={nextStep}>
				Continue
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
					<path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		{/if}
	</footer>
</div>

<style>
	:where(.create-page) {
		--footer-shadow-rgb: 0, 0, 0;
		--footer-shadow-alpha: 0.3;
		--footer-shadow: rgba(var(--footer-shadow-rgb), var(--footer-shadow-alpha));
		--shadow: 0 8px 32px oklch(0 0 0 / 0.2);
	}

	.create-page {
		display: flex;
		flex-direction: column;
		min-height: calc(100vh - 2rem);
		padding-bottom: 5rem;
	}

	/* Stepper */
	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--color-base-300);
	}

	.stepper-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		color: var(--color-neutral-content);
		transition: color 0.15s ease;
	}

	.stepper-step:hover {
		color: var(--color-base-content);
	}

	.stepper-step.active {
		color: var(--color-ink);
	}

	.stepper-step.completed {
		color: var(--color-yes);
	}

	.step-dot {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: var(--font-mono);
		border: 2px solid currentColor;
		transition: all 0.15s ease;
	}

	.stepper-step.active .step-dot {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-primary-content);
	}

	.stepper-step.completed .step-dot {
		background: var(--color-yes);
		border-color: var(--color-yes);
		color: var(--color-primary-content);
	}

	.stepper-step:not(.active):not(.completed) .step-dot {
		background: transparent;
	}

	.step-dot svg {
		width: 14px;
		height: 14px;
	}

	.step-label {
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.stepper-connector {
		flex: 1;
		height: 2px;
		min-width: 2rem;
		max-width: 4rem;
		background: var(--color-base-300);
		margin-bottom: 1.25rem;
		transition: background 0.15s ease;
	}

	.stepper-connector.completed {
		background: var(--color-yes);
	}

	/* Step content */
	.step-content {
		flex: 1;
		max-width: 680px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
	}

	.step-header {
		margin-bottom: 2rem;
	}

	.step-header h1 {
		font-family: var(--font-tight);
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0.5rem 0;
		color: var(--color-base-content);
	}

	.step-description {
		color: var(--color-neutral-content);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	/* Claim textarea (Step 1) */
	.claim-field {
		margin-bottom: 2rem;
	}

	.claim-textarea {
		width: 100%;
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--color-base-300);
		color: var(--color-base-content);
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.4;
		padding: 0.75rem 0;
		resize: none;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.claim-textarea::placeholder {
		color: var(--color-neutral-content);
		font-weight: 400;
	}

	.claim-textarea:focus {
		border-bottom-color: var(--color-ink);
	}

	.claim-meta {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.char-count {
		font-size: 0.8rem;
		font-family: var(--font-mono);
		color: var(--color-neutral-content);
	}

	/* Category tabs */
	.category-section {
		margin-bottom: 2rem;
	}

	.section-label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-neutral-content);
		margin-bottom: 0.75rem;
	}

	.category-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-base-300);
		padding-bottom: 0;
	}

	.category-tab {
		background: none;
		border: none;
		padding: 0.6rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-neutral-content);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: all 0.15s ease;
	}

	.category-tab:hover {
		color: var(--color-base-content);
	}

	.category-tab.selected {
		color: var(--color-ink);
		border-bottom-color: var(--color-ink);
	}

	/* Duplicate detection (Step 1) */
	.duplicate-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-base-300);
	}

	.empty-state {
		color: var(--color-neutral-content);
		font-size: 0.9rem;
		padding: 1rem 0;
	}

	/* Case textarea (Step 2) */
	.case-field {
		margin-bottom: 2rem;
	}

	.case-textarea {
		width: 100%;
		min-height: 320px;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		color: var(--color-base-content);
		font-family: var(--font-serif);
		font-size: 1rem;
		line-height: 1.7;
		padding: 1rem;
		resize: vertical;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.case-textarea::placeholder {
		color: var(--color-neutral-content);
	}

	.case-textarea:focus {
		border-color: var(--color-ink);
	}

	.case-meta {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.word-count {
		font-size: 0.8rem;
		font-family: var(--font-mono);
		color: var(--color-neutral-content);
	}

	/* Linked markets (Step 2) */
	.linked-section {
		margin-top: 2rem;
	}

	.linked-note {
		font-size: 0.85rem;
		color: var(--color-neutral-content);
		margin-bottom: 1rem;
		font-style: italic;
	}

	.linked-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.linked-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.75rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
	}

	.linked-url {
		font-size: 0.85rem;
		font-family: var(--font-mono);
		color: var(--color-base-content);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.linked-remove {
		background: none;
		border: none;
		padding: 0.25rem;
		cursor: pointer;
		color: var(--color-neutral-content);
		transition: color 0.15s ease;
		flex-shrink: 0;
	}

	.linked-remove:hover {
		color: var(--color-error);
	}

	.linked-remove svg {
		width: 16px;
		height: 16px;
	}

	.linked-add {
		display: flex;
		gap: 0.5rem;
	}

	.linked-input {
		flex: 1;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		color: var(--color-base-content);
		font-size: 0.9rem;
		padding: 0.6rem 0.75rem;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.linked-input::placeholder {
		color: var(--color-neutral-content);
	}

	.linked-input:focus {
		border-color: var(--color-ink);
	}

	.linked-add-btn {
		background: transparent;
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		color: var(--color-base-content);
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.6rem 1rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.linked-add-btn:hover:not(:disabled) {
		background: var(--color-base-200);
		border-color: var(--color-ink);
	}

	.linked-add-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Step 3: Details blocks */
	.detail-block {
		margin-bottom: 2rem;
	}

	/* Image block */
	.image-layout {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	.image-preview {
		aspect-ratio: 4 / 5;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--color-base-300);
	}

	.gradient-preview {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gradient-category {
		font-family: var(--font-tight);
		font-weight: 700;
		font-size: 0.9rem;
		color: white;
		text-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
		padding: 0.5rem;
		text-align: center;
	}

	.url-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-preview {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--color-base-200);
		color: var(--color-neutral-content);
		font-size: 0.75rem;
	}

	.no-preview svg {
		width: 32px;
		height: 32px;
		opacity: 0.5;
	}

	.image-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.radio-option input[type="radio"] {
		width: 16px;
		height: 16px;
		accent-color: var(--color-ink);
	}

	.radio-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-base-content);
	}

	.radio-hint {
		font-size: 0.8rem;
		color: var(--color-neutral-content);
		font-style: italic;
	}

	.url-input {
		margin-top: 0.5rem;
		width: 100%;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		color: var(--color-base-content);
		font-size: 0.85rem;
		padding: 0.5rem 0.75rem;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.url-input:focus {
		border-color: var(--color-ink);
	}

	.url-input::placeholder {
		color: var(--color-neutral-content);
	}

	/* Summary block */
	.block-hint {
		font-size: 0.85rem;
		color: var(--color-neutral-content);
		margin-bottom: 0.75rem;
	}

	.summary-textarea {
		width: 100%;
		min-height: 80px;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		color: var(--color-base-content);
		font-family: var(--font-serif);
		font-size: 0.95rem;
		line-height: 1.6;
		padding: 0.75rem;
		resize: vertical;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.summary-textarea:focus {
		border-color: var(--color-ink);
	}

	.summary-textarea::placeholder {
		color: var(--color-neutral-content);
	}

	.summary-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.5rem;
	}

	.regenerate-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		color: var(--color-neutral-content);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.regenerate-btn:hover {
		color: var(--color-ink);
		background: var(--color-base-300);
	}

	.regenerate-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Tags block */
	.tags-input-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 6px;
		min-height: 44px;
		align-items: center;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.5rem;
		background: var(--color-base-300);
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-base-content);
	}

	.tag-remove {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--color-neutral-content);
		display: flex;
		align-items: center;
		transition: color 0.15s ease;
	}

	.tag-remove:hover {
		color: var(--color-error);
	}

	.tag-remove svg {
		width: 12px;
		height: 12px;
	}

	.tag-input {
		flex: 1;
		min-width: 80px;
		background: none;
		border: none;
		color: var(--color-base-content);
		font-size: 0.9rem;
		padding: 0.25rem;
		outline: none;
	}

	.tag-input::placeholder {
		color: var(--color-neutral-content);
	}

	.suggested-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.75rem;
	}

	.suggested-label {
		font-size: 0.8rem;
		color: var(--color-neutral-content);
	}

	.suggested-tag {
		padding: 0.25rem 0.6rem;
		background: transparent;
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-neutral-content);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.suggested-tag:hover {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	.suggested-tag.selected {
		background: var(--color-base-300);
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	/* Step 4: Launch */
	.seed-explainer {
		padding: 1.5rem;
		background: var(--color-base-200);
		border-radius: 8px;
		margin-bottom: 2rem;
		border-left: 3px solid var(--color-ink);
	}

	.seed-explainer-text {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-style: italic;
		line-height: 1.7;
		color: var(--color-neutral-content);
		margin: 0;
	}

	.seed-block {
		margin-bottom: 2rem;
	}

	/* YES/NO toggle */
	.side-toggle {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.side-btn {
		flex: 1;
		padding: 1rem 1.5rem;
		border: 2px solid var(--color-base-300);
		border-radius: 8px;
		font-family: var(--font-tight);
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
		background: var(--color-base-200);
		color: var(--color-neutral-content);
	}

	.side-btn.side-yes.active {
		border-color: var(--color-yes);
		background: color-mix(in srgb, var(--color-yes) 15%, transparent);
		color: var(--color-yes);
	}

	.side-btn.side-no.active {
		border-color: var(--color-no);
		background: color-mix(in srgb, var(--color-no) 15%, transparent);
		color: var(--color-no);
	}

	.side-btn:not(.active):hover {
		border-color: var(--color-base-content);
	}

	/* Amount section */
	.amount-section {
		margin-bottom: 1.5rem;
	}

	.amount-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-neutral-content);
		margin-bottom: 0.5rem;
	}

	.amount-input-wrapper {
		display: flex;
		align-items: center;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 8px;
		overflow: hidden;
	}

	.amount-prefix {
		padding: 0.75rem 1rem;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-neutral-content);
		background: var(--color-base-300);
	}

	.amount-input {
		flex: 1;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		color: var(--color-base-content);
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 600;
		outline: none;
	}

	.amount-input::-webkit-inner-spin-button,
	.amount-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.quick-amounts {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.quick-amount {
		padding: 0.4rem 0.75rem;
		background: transparent;
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-neutral-content);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.quick-amount:hover {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	.quick-amount.active {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-primary-content);
	}

	/* Seed math */
	.seed-math {
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.math-row {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
	}

	.math-row:not(:last-child) {
		border-bottom: 1px solid var(--color-base-300);
	}

	.math-label {
		font-size: 0.9rem;
		color: var(--color-neutral-content);
	}

	.math-value {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-base-content);
	}

	.math-value.highlight {
		color: var(--color-ink);
		font-size: 1.1rem;
	}

	.seed-reassurance {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-neutral-content);
		font-style: italic;
	}

	.seed-reassurance svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	/* Invite block */
	.invite-block {
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-base-300);
	}

	.invite-search {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.invite-search svg {
		width: 18px;
		height: 18px;
		color: var(--color-neutral-content);
		flex-shrink: 0;
	}

	.invite-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--color-base-content);
		font-size: 0.9rem;
		outline: none;
	}

	.invite-input::placeholder {
		color: var(--color-neutral-content);
	}

	.invite-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.invite-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		font-size: 0.85rem;
		color: var(--color-base-content);
	}

	.invite-chip button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--color-neutral-content);
		display: flex;
		align-items: center;
	}

	.invite-chip button:hover {
		color: var(--color-error);
	}

	.invite-chip button svg {
		width: 14px;
		height: 14px;
	}

	/* Footer skip button */
	.footer-skip {
		color: var(--color-neutral-content);
		background: transparent;
	}

	.footer-skip:hover {
		color: var(--color-base-content);
		background: var(--color-base-300);
	}

	/* Error message */
	.error-message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: 6px;
		color: var(--color-error);
		font-size: 0.9rem;
	}

	.error-message svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	/* Toolkit */
	.toolkit {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	/* Hero */
	.toolkit-hero {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
		padding: 2rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 12px;
	}

	.toolkit-hero-content {
		flex: 1;
	}

	.toolkit-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--color-yes);
		text-transform: uppercase;
		margin-bottom: 0.75rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-yes);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.toolkit-title {
		font-family: var(--font-tight);
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-base-content);
		margin: 0 0 0.75rem;
		line-height: 1.2;
	}

	.toolkit-lede {
		font-family: var(--font-serif);
		font-size: 1rem;
		line-height: 1.7;
		color: var(--color-neutral-content);
		margin: 0 0 1.5rem;
	}

	.toolkit-hero-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 1.25rem;
		background: var(--color-ink);
		color: var(--color-primary-content);
		border: none;
		border-radius: 999px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
		text-decoration: none;
	}

	.btn-primary svg { width: 16px; height: 16px; }

	.btn-primary:hover { background: var(--color-primary); }

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 1.25rem;
		background: transparent;
		color: var(--color-base-content);
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		text-decoration: none;
	}

	.btn-secondary svg { width: 16px; height: 16px; }

	.btn-secondary:hover {
		background: var(--color-base-300);
		border-color: var(--color-ink);
	}

	/* Portrait card */
	.portrait-card {
		flex-shrink: 0;
		width: 160px;
		transform: rotate(2deg);
		box-shadow: 0 8px 32px var(--color-shadow);
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--color-base-300);
	}

	.portrait-inner {
		background: linear-gradient(135deg, hsl(200, 60%, 35%), hsl(250, 50%, 25%));
		padding: 1rem;
		min-height: 200px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.portrait-category {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: oklch(90% 0 0 / 0.7);
		margin-bottom: 0.5rem;
	}

	.portrait-claim {
		font-family: var(--font-serif);
		font-size: 0.9rem;
		font-weight: 600;
		color: white;
		line-height: 1.4;
		margin-bottom: 1rem;
	}

	.portrait-price {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.portrait-price-value {
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 700;
		color: white;
	}

	.portrait-price-side {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.portrait-price-side.yes {
		background: var(--color-yes);
		color: var(--color-primary-content);
	}

	.portrait-price-side.no {
		background: var(--color-no);
		color: white;
	}

	/* Toolkit sections */
	.toolkit-section {
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-base-300);
	}

	.toolkit-section:first-child {
		border-top: none;
		padding-top: 0;
	}

	.toolkit-section-title {
		font-family: var(--font-tight);
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-neutral-content);
		margin-bottom: 1rem;
	}

	/* Share grid */
	.share-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.social-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-decoration: none;
		color: var(--color-base-content);
	}

	.social-btn svg { width: 28px; height: 28px; }

	.social-btn-label {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.social-btn:hover {
		border-color: var(--color-ink);
		background: var(--color-base-300);
	}

	.social-btn.twitter svg { color: #000; }
	.social-btn.linkedin svg { color: #0A66C2; }

	/* Copy tabs */
	.tab-bar {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-base-300);
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-neutral-content);
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: -1px;
	}

	.tab-btn:hover { color: var(--color-base-content); }

	.tab-btn.active {
		color: var(--color-ink);
		border-bottom-color: var(--color-ink);
	}

	.copy-preview {
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 8px;
		padding: 1rem;
		position: relative;
	}

	.copy-text {
		font-family: var(--font-serif);
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--color-base-content);
		margin: 0;
		padding-right: 3rem;
	}

	.btn-copy {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.75rem;
		background: var(--color-base-300);
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-base-content);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-copy svg { width: 14px; height: 14px; }

	.btn-copy:hover {
		background: var(--color-ink);
		color: var(--color-primary-content);
	}

	/* Embed preview */
	.embed-preview {
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 8px;
		padding: 1rem;
		position: relative;
	}

	.embed-code {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-base-content);
		word-break: break-all;
		line-height: 1.6;
		padding-right: 3rem;
	}

	/* QR section */
	.qr-section {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.qr-image {
		width: 160px;
		height: 160px;
		border-radius: 8px;
		border: 1px solid var(--color-base-300);
	}

	/* What happens next cards */
	.next-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.next-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.25rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 10px;
	}

	.next-card-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: var(--color-base-300);
		color: var(--color-neutral-content);
	}

	.next-card-icon svg { width: 20px; height: 20px; }

	.next-card-title {
		font-family: var(--font-tight);
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-base-content);
	}

	.next-card-desc {
		font-size: 0.85rem;
		color: var(--color-neutral-content);
		line-height: 1.5;
	}

	/* Draft indicator */
	.draft-indicator {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--color-yes);
		margin-right: auto;
		padding-right: 1rem;
	}

	.draft-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-yes);
	}

	/* Page footer hidden */
	.page-footer.hidden {
		display: none;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.toolkit-hero {
			flex-direction: column;
			padding: 1.5rem;
		}

		.portrait-card {
			width: 100%;
			transform: none;
		}

		.toolkit-title { font-size: 1.5rem; }

		.share-grid {
			grid-template-columns: 1fr;
		}

		.next-cards {
			grid-template-columns: 1fr;
		}

		.qr-section {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	.page-footer {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-base-200);
		border: 1px solid var(--color-base-300);
		border-radius: 999px;
		min-width: min(calc(100vw - 2rem), 600px);
		box-shadow: 0 4px 24px var(--footer-shadow);
	}

	.footer-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
	}

	.footer-btn svg {
		width: 16px;
		height: 16px;
	}

	.footer-back {
		color: var(--color-neutral-content);
	}

	.footer-back:hover:not(:disabled) {
		color: var(--color-base-content);
		background: var(--color-base-300);
	}

	.footer-back:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.footer-step-indicator {
		font-size: 0.8rem;
		font-family: var(--font-mono);
		color: var(--color-neutral-content);
	}

	.footer-continue {
		color: var(--color-ink);
		background: var(--color-base-300);
	}

	.footer-continue:hover {
		background: var(--color-primary);
		color: var(--color-primary-content);
	}

	.footer-launch {
		color: var(--color-primary-content);
		background: var(--color-ink);
	}

	.footer-launch:hover {
		background: #fff8ec;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.stepper {
			padding: 1rem;
			overflow-x: auto;
		}

		.step-label {
			display: none;
		}

		.step-content {
			padding: 1.5rem 1rem;
		}

		.step-header h1 {
			font-size: 1.5rem;
		}

		.claim-textarea {
			font-size: 1.25rem;
		}

		.page-footer {
			min-width: calc(100vw - 2rem);
			border-radius: 12px;
		}
	}
</style>
