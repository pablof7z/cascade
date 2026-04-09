<script lang="ts">
  import NavHeader from '$lib/components/NavHeader.svelte';
</script>

<svelte:head>
  <title>Writing | Cascade</title>
  <meta name="description" content="Thinking about prediction markets, conditional beliefs, and the future of financial forecasting." />
</svelte:head>

<div class="min-h-screen bg-neutral-950">
  <NavHeader />
  <section class="max-w-3xl mx-auto px-6 py-16 border-b border-neutral-800">
    <p class="text-xs text-neutral-500 uppercase tracking-widest mb-4">Writing</p>
    <p class="text-neutral-400 text-sm">Thinking about prediction markets, conditional beliefs, and the future of financial forecasting.</p>
  </section>

  <section class="max-w-3xl mx-auto px-6 py-12">
    <div class="divide-y divide-neutral-800">

      <!-- Article -->
      <article class="py-12">
        <!-- Article header -->
        <div class="mb-10">
          <p class="text-sm text-neutral-500 mb-3">April 2026 &mdash; Cascade</p>
          <h1 class="text-3xl md:text-4xl font-bold text-white leading-tight mb-6">
            If Bitcoin Hits $100k, Then What?
          </h1>
          <p class="text-neutral-300 text-base leading-relaxed">
            Polymarket is good. It's also fundamentally limited.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            Here's the problem: Polymarket forces everything into single yes/no questions. "Will BTC break $100k by end of 2026?" One question. One answer. Fine — until it's not.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            What if you believe DeFi will drive ETH above $5,000 <em>if</em> and only if BTC breaks $100k first? Polymarket has no mechanism for that. You're forced to pick your highest-conviction yes/no and pray the market agrees with your causal model. You can't express conditional conviction. Either you bet the binary or you sit out.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            That's the gap Cascade fills.
          </p>
        </div>

        <!-- Section: Modules and Theses -->
        <div class="mb-8">
          <h2 class="text-xl font-bold text-white mb-4">Modules and Theses</h2>
          <p class="text-neutral-300 text-base leading-relaxed">
            Cascade is built around two primitives: <strong class="text-white">modules</strong> and <strong class="text-white">theses</strong>.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            A <strong class="text-white">module</strong> is an atomic prediction — the same thing Polymarket offers. "BTC closes above $100k on Dec 31, 2026." Yes or no. Trade it.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            A <strong class="text-white">thesis</strong> is a network of modules connected by your beliefs. You can say: "If BTC breaks $100k, then ETH will outperform BTC through the cycle, and Coinbase will be the primary beneficiary."
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            Each conditional leg is its own module. Each trades independently. And your thesis as a whole has a payout derived from its components.
          </p>
        </div>

        <!-- Section: Why This Matters -->
        <div class="mb-8">
          <h2 class="text-xl font-bold text-white mb-4">Why This Matters</h2>
          <p class="text-neutral-300 text-base leading-relaxed">
            <strong class="text-white">Sharper thinking.</strong> When you build a thesis, you articulate <em>why</em> you believe what you believe — not just <em>what</em> you believe. The structure exposes the logic of your bet.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            <strong class="text-white">Partial credit, partial loss.</strong> On Polymarket, if you're right about the direction but wrong about the catalyst, you lose. On Cascade, if your thesis collapses but one leg holds, you can hedge into related positions without abandoning ship.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            <strong class="text-white">Social prediction, not social betting.</strong> When someone shares a thesis on Cascade, you can read their full causal model. Price signals on Polymarket tell you <em>what</em> the crowd believes. Thesis networks show you <em>why</em>.
          </p>
        </div>

        <!-- Section: The Example -->
        <div class="mb-8">
          <h2 class="text-xl font-bold text-white mb-4">The Example</h2>
          <p class="text-neutral-300 text-base leading-relaxed">
            Say you're bullish on ETH. On Polymarket, you might bet "Will ETH exceed $5,000 in 2026?" That's it.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            On Cascade, you build a thesis with three modules:
          </p>
          <ul class="mt-4 space-y-3 border-l-2 border-neutral-700 pl-6">
            <li class="text-neutral-300 text-base leading-relaxed">
              <strong class="text-white">Module A:</strong> "BTC breaks $100k in 2026" — your macro precondition
            </li>
            <li class="text-neutral-300 text-base leading-relaxed">
              <strong class="text-white">Module B:</strong> "ETH outperforms BTC in the next cycle" — your ETH-specific view
            </li>
            <li class="text-neutral-300 text-base leading-relaxed">
              <strong class="text-white">Module C:</strong> "Coinbase captures &gt;40% of ETH staking yield" — your infrastructure bet
            </li>
          </ul>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            Your thesis pays out when A, B, and C all resolve true. You can weight each module differently. You can hold A+B without C if you're unsure about Coinbase. And when news hits, you see exactly which module is repricing.
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            If Coinbase faces regulatory trouble, Module C reprices. Module A and B stay intact. On Polymarket, you'd have no idea whether a bad Coinbase headline means your ETH bet is wrong or just collateral damage.
          </p>
        </div>

        <!-- Section: The Real Differentiator -->
        <div>
          <h2 class="text-xl font-bold text-white mb-4">The Real Differentiator</h2>
          <p class="text-neutral-300 text-base leading-relaxed">
            Prediction markets are good at aggregating <em>what happens?</em> They're bad at aggregating <em>what's the full picture?</em>
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            Cascade asks "If X happens, then what?" Polymarket asks "Will X happen?"
          </p>
          <p class="text-neutral-300 text-base leading-relaxed mt-4">
            That's not a feature. That's the whole point.
          </p>
        </div>
      </article>

    </div>
  </section>
</div>
