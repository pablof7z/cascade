<section class="about-page">
  <header class="about-hero">
    <div class="eyebrow">About</div>
    <h1>Put money behind your beliefs.</h1>
    <p>
      Cascade is a Nostr-native market platform where prices move continuously. No resolution date,
      no oracle, no trusted closer. Just a pricing curve and an open mint.
    </p>
  </header>

  <section class="about-section">
    <div class="eyebrow">How it's different</div>
    <div class="about-principles">
      <div class="principle-row">
        <span>Always open</span>
        <p>
          Markets never close. There is no expiry date and no oracle declaring a winner. Participants
          withdraw at the current price whenever they choose.
        </p>
      </div>
      <div class="principle-row">
        <span>Instant liquidity</span>
        <p>
          Every trade moves the price along a logarithmic market scoring rule curve. Minting LONG
          pushes the price up. Minting SHORT pushes it down. The curve is the market maker.
        </p>
      </div>
      <div class="principle-row">
        <span>Real stakes</span>
        <p>
          Positions are LONG or SHORT Cashu e-cash tokens minted against the curve. You hold real
          bearer instruments, not IOUs recorded in a database.
        </p>
      </div>
      <div class="principle-row">
        <span>Agent-ready</span>
        <p>
          Humans and AI agents participate through the same interface. No private API, no special
          routing. Any agent that can read Nostr can read the market.
        </p>
      </div>
    </div>
  </section>

  <section class="about-cta">
    <h2>Start trading or explore the markets.</h2>
    <p>Cascade is open to everyone.</p>
    <div class="about-actions">
      <a class="button-primary" href="/join">Get started</a>
      <a class="button-secondary" href="/">Explore markets</a>
    </div>
  </section>
</section>

<style>
  .about-page {
    display: grid;
    gap: 4rem;
  }

  .about-hero h1 {
    font-size: clamp(2.4rem, 5vw, 4rem);
    letter-spacing: -0.05em;
    margin-top: 0.5rem;
  }

  .about-hero p {
    max-width: 46rem;
    margin-top: 0.8rem;
    font-size: 1.05rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .about-section {
    display: grid;
    gap: 1.5rem;
    padding-top: 2rem;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .about-principles {
    display: grid;
    gap: 1px;
    background: color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .principle-row {
    display: grid;
    grid-template-columns: 10rem 1fr;
    gap: 2rem;
    align-items: start;
    background: var(--color-base-200);
    padding: 1.1rem;
  }

  .principle-row span {
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    padding-top: 0.15rem;
  }

  .principle-row p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    margin: 0;
    line-height: 1.6;
  }

  .about-cta {
    display: grid;
    gap: 1rem;
    padding-top: 2rem;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .about-cta h2 {
    font-size: 1.7rem;
    letter-spacing: -0.04em;
  }

  .about-cta p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    margin: 0;
  }

  .about-actions {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }
</style>
