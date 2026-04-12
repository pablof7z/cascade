<script lang="ts">
  interface Props {
    isLoggedIn: boolean;
  }

  let { isLoggedIn }: Props = $props();
</script>

<div class="py-12 text-center">
  <div class="text-neutral-500">No discussions yet</div>
  <p class="mt-2 text-sm text-neutral-600">
    {#if isLoggedIn}
      Be the first to add your thoughts below.
    {:else}
      Sign in to join the conversation.
    {/if}
  </p>
</div>
