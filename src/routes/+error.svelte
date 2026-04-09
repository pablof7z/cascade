<script lang="ts">
	import { page } from '$app/stores';
	import NavHeader from '$lib/components/NavHeader.svelte';

	const status = $derived($page.status ?? 404);
	const is404 = $derived(status === 404);
</script>

<svelte:head>
	<title>{is404 ? '404 — Page Not Found | Cascade' : 'Error — Something Went Wrong | Cascade'}</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950">
	<NavHeader />
	<div class="flex flex-col items-center justify-center px-4" style="min-height: calc(100vh - 57px);">
		<p class="text-8xl md:text-9xl font-bold text-neutral-700 font-mono">{status}</p>

		<p class="mt-4 text-2xl md:text-3xl font-medium text-white">
			{#if is404}
				Page not found
			{:else}
				Something went wrong
			{/if}
		</p>

		<div class="mt-8">
			<a href="/discuss" class="text-emerald-400 hover:text-emerald-300">← Back to markets</a>
		</div>
	</div>
</div>
