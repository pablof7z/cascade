<script lang="ts">
	import type { PageData } from './$types';

	let { error, url }: { error: App.Error | null; url: URL } = $props();

	const status = error?.status ?? 404;
	const message = status === 404
		? "This page doesn't exist"
		: error?.message ?? 'An unexpected error occurred';
</script>

<div class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
	<p class="text-8xl md:text-9xl font-bold text-neutral-500 font-mono">{status}</p>
	<p class="mt-4 text-2xl md:text-3xl font-medium text-white">{message}</p>
	<a
		href="/"
		class="mt-8 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-sm font-medium rounded transition-colors"
	>
		Go to homepage
	</a>
</div>
