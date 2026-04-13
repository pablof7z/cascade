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

<section class="profile-gate">
  <div class="profile-gate-copy">
    <div class="profile-kicker">Profile</div>
    <h1>Sign in to manage your profile.</h1>
    <p>
      Use onboarding to finish the basics for your public profile, or open the profile editor for
      deeper changes.
    </p>

    <div class="profile-gate-actions">
      <a class="button-primary" href="/onboarding">Open onboarding</a>
      <a class="button-secondary" href="/profile/edit">Edit profile</a>
    </div>
  </div>
</section>

<style>
  .profile-gate {
    display: flex;
    align-items: center;
    min-height: 60vh;
  }

  .profile-gate-copy {
    display: grid;
    gap: 1rem;
    max-width: 34rem;
  }

  .profile-kicker {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .profile-gate h1 {
    font-size: clamp(2.2rem, 4vw, 3.7rem);
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .profile-gate p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.75;
  }

  .profile-gate-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
  }
</style>
