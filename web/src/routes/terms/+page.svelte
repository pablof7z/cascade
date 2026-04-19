<script lang="ts">
  import { LEGAL_LAST_UPDATED_ISO, LEGAL_LAST_UPDATED_LABEL } from '$lib/legal/lastUpdated';
</script>

<div class="page">
  <header class="grid gap-2">
    <div class="eyebrow">Legal</div>
    <h1 class="font-tight text-4xl font-bold tracking-tight">Terms of Service</h1>
    <p class="text-base-content/60">Effective <time datetime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED_LABEL}</time></p>
  </header>

  <div class="bg-surface border border-base-300 rounded-lg p-8 max-w-3xl">
    <h2>1. What you control</h2>
    <p>
      Cascade does not hold your keys, your signer, or your funds. You interact with the service using
      cryptographic keys you control. If you lose your keys, you lose access to your account. We
      cannot recover them for you.
    </p>

    <h2>2. Markets are informational</h2>
    <p>
      Markets on Cascade represent the aggregate trading positions of participants. They are not
      predictions made by the platform, financial advice, or endorsements of any outcome. The platform
      operator takes no position on any market question.
    </p>

    <h2>3. Data is public and immutable</h2>
    <p>
      Trades, market positions, and discussion posts are recorded on public Nostr relays. Once
      published, this data cannot be deleted or modified by the platform. Anything you post or trade
      is visible to the public indefinitely.
    </p>

    <h2>4. Risk disclosure</h2>
    <p>
      Participation in prediction markets involves financial risk. Markets may become illiquid.
      Withdrawing your position returns funds at the prevailing market price, which may differ
      significantly from your entry price. Trade only with funds you can afford to lose.
    </p>

    <h2>5. Acceptable use</h2>
    <p>
      Do not use Cascade to launder reputation, coordinate market manipulation, or impersonate others.
      Markets must reflect genuine uncertainty — not manufactured consensus. The platform operator
      reserves the right to remove markets or accounts that violate these principles.
    </p>

    <h2>6. Changes to these terms</h2>
    <p>
      These terms may be updated. Material changes will be communicated through the platform.
      Continued use after a change constitutes acceptance of the revised terms.
    </p>

    <h2>7. Contact</h2>
    <p>
      Questions about these terms? Reach out via Nostr direct message or through the platform's
      contact channels.
    </p>
  </div>
</div>

<style>
  .bg-surface {
    display: grid;
    gap: 1rem;
  }

  .bg-surface :global(h2) {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 1.5rem 0 0;
  }

  .bg-surface :global(h2:first-child) {
    margin-top: 0;
  }

  .bg-surface :global(p) {
    color: var(--color-base-content);
    opacity: 0.75;
    line-height: 1.7;
  }
</style>
