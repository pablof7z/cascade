<script lang="ts">
	import { page } from '$app/stores';
	import NavHeader from '$lib/components/NavHeader.svelte';

	const status = $derived($page.status ?? 404);
	const is404 = $derived(status === 404);

	// Safe fallback: use history if available, otherwise go home
	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}
</script>

<svelte:head>
	<title>{is404 ? '404 — Page Not Found | Cascade' : 'Error — Something Went Wrong | Cascade'}</title>
</svelte:head>

<NavHeader />

<!-- Large status code with decorative comment -->
<div class="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4">
	<!-- {status} -->
	<p class="text-8xl md:text-9xl font-bold text-neutral-500 font-mono">{status}</p>

	<p class="mt-4 text-2xl md:text-3xl font-medium text-white">
		{#if is404}
			This page doesn't exist
		{:else}
			{$page.error?.message ?? 'An unexpected error occurred.'}
		{/if}
	</p>

	<div class="mt-8 flex flex-col sm:flex-row gap-3">
		<button
			onclick={goBack}
			class="px-6 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 hover:text-white transition-colors rounded"
		>
			Go back
		</button>
		<a
			href="/"
			class="px-6 py-2.5 text-sm font-medium bg-white text-neutral-950 hover:bg-neutral-100 transition-colors rounded text-center"
		>
			Go to homepage
		</a>
	</div>
</div>
