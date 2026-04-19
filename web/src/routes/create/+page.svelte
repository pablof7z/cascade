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
			<!-- Step 3: Details (placeholder) -->
			<div class="step-3">
				<header class="step-header">
					<p class="eyebrow">Step 3 of 4</p>
					<h1>Add details</h1>
					<p class="step-description">
						Optional: add an image, summary, and tags to help readers understand your claim.
					</p>
				</header>
				<p class="placeholder-text">Details step coming in Phase 4B.</p>
			</div>
		{:else if currentStep === 4}
			<!-- Step 4: Launch (placeholder) -->
			<div class="step-4">
				<header class="step-header">
					<p class="eyebrow">Step 4 of 4</p>
					<h1>Launch your market</h1>
					<p class="step-description">
						Seed your market with real capital to bring it live.
					</p>
				</header>
				<p class="placeholder-text">Launch step coming in Phase 4B.</p>
			</div>
		{/if}
	</div>

	<!-- Footer navigation -->
	<footer class="page-footer">
		<button
			class="footer-btn footer-back"
			onclick={prevStep}
			disabled={currentStep === 1}
		>
			<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
				<path d="M10 3L5 8l5 5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Back
		</button>

		<span class="footer-step-indicator">Step {currentStep} of 4</span>

		{#if currentStep === 4}
			<button class="footer-btn footer-launch">
				Launch market · $100
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

	/* Placeholder steps */
	.placeholder-text {
		color: var(--color-neutral-content);
		font-size: 0.95rem;
		padding: 2rem 0;
	}

	/* Footer navigation */
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
