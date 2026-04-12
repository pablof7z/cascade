<script lang="ts">
  import '../index.css';
  import Footer from '$lib/components/Footer.svelte';
  
  let { children } = $props();
</script>

<div class="min-h-screen bg-neutral-950 text-white flex flex-col">
  <div class="flex-1">
    {@render children()}
  </div>
  <Footer />
</div>
