<script lang="ts">
  import '../index.css';
  
  let { children } = $props();
</script>

<div class="min-h-screen bg-neutral-950 text-white">
  {@render children()}
</div>
