<script lang="ts">
  import { getContext } from 'svelte';
  import { USER_CONTEXT_KEY, type UserContext } from './user.context.js';
  import { cn } from '../../utils/cn.js';

  interface Props {
    field?: 'displayName' | 'name' | 'both';
    fallback?: string;

    class?: string;
  }

  let {
    field = 'displayName',
    fallback = 'Someone',
    class: className = ''
  }: Props = $props();

  const context = getContext<UserContext>(USER_CONTEXT_KEY);
  if (!context) {
    throw new Error('User.Name must be used within User.Root');
  }

  const displayText = $derived.by(() => {
    if (!context.profile) return fallback;

    if (field === 'name') {
      return context.profile.name || context.profile.displayName || context.profile.nip05 || fallback;
    } else if (field === 'displayName') {
      return context.profile.displayName || context.profile.name || context.profile.nip05 || fallback;
    } else if (field === 'both') {
      const primary = context.profile.displayName || context.profile.name;
      const secondary =
        context.profile.displayName &&
        context.profile.name &&
        context.profile.name !== context.profile.displayName
          ? context.profile.name
          : null;

      return secondary ? `${primary} (@${secondary})` : primary || context.profile.nip05 || fallback;
    }

    return fallback;
  });
</script>

<span data-user-name="" class={cn(className)}>
  {displayText}
</span>
