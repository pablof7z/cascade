<script lang="ts">
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
</script>

<div class="create-page">
	<!-- Stepper -->
	<nav class="stepper" aria-label="Progress">
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
			<!-- Published success state -->
			<div class="published-state">
				<svg class="published-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="32" cy="32" r="28" />
					<path d="M20 32l8 8 16-16" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<h2 class="published-title">Market is live!</h2>
				<p class="published-description">Your market "{publishedMarket.slug}" is now open for trading.</p>
				<a href="/market/{publishedMarket.slug}" class="published-link">
					View market
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
						<path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</a>
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

	/* Published success state */
	.published-state {
		text-align: center;
		padding: 3rem 1rem;
	}

	.published-icon {
		width: 64px;
		height: 64px;
		margin: 0 auto 1.5rem;
		color: var(--color-yes);
	}

	.published-title {
		font-family: var(--font-tight);
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.published-description {
		color: var(--color-neutral-content);
		font-size: 1rem;
		margin-bottom: 1.5rem;
	}

	.published-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--color-ink);
		color: var(--color-primary-content);
		border-radius: 999px;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.published-link:hover {
		background: var(--color-primary);
	}

	/* Footer navigation */
	.page-footer.hidden {
		display: none;
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
