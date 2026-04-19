<script lang="ts">
  import { goto } from '$app/navigation';
  import { ndk } from '$lib/ndk/client';

  const currentUser = $derived(ndk.$currentUser);

  $effect(() => {
    if (currentUser?.npub) {
      void goto(`/p/${currentUser.npub}`, { replaceState: true });
    }
  });
</script>

<section class="flex items-center min-h-[60vh]">
  <div class="grid gap-4 max-w-[34rem]">
    <div class="eyebrow">Profile</div>
    <h1 class="text-[clamp(2.2rem,4vw,3.7rem)] tracking-[-0.05em] leading-none">Sign in to manage your profile.</h1>
    <p class="text-base-content/70 leading-[1.75]">
      Use onboarding to finish the basics for your public profile, or open the profile editor for
      deeper changes.
    </p>

    <div class="flex gap-3 flex-wrap pt-2">
      <a class="rounded-full bg-[var(--color-ink)] text-[#1a1610] font-semibold px-5 py-2.5 text-sm hover:bg-[#fff8ec]" href="/onboarding">Open onboarding</a>
      <a class="border border-base-300 bg-transparent text-base-content/70 hover:text-base-content hover:border-base-content px-5 py-2 text-sm rounded-full font-medium" href="/profile/edit">Edit profile</a>
    </div>
  </div>
</section>
