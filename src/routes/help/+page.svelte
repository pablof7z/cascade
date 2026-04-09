<script lang="ts">
  import NavHeader from '$lib/components/NavHeader.svelte';

  const faqs = [
    {
      question: "What is Cascade?",
      answer: "Cascade is a decentralized prediction market platform. It allows anyone to create markets on future events and trade shares based on their predictions."
    },
    {
      question: "How do prediction markets work?",
      answer: "Prediction markets allow you to buy shares in the outcome of future events. If your prediction is correct, your shares become more valuable. Prices reflect the collective belief about the likelihood of each outcome."
    },
    {
      question: "What are Modules and Theses?",
      answer: "A module is an atomic prediction — a single yes/no question with a market price. A thesis is a network of modules connected by your beliefs about cause and effect. For example: 'If BTC breaks $100k, then ETH will outperform BTC, and Coinbase will be the primary beneficiary.' Each conditional leg is its own tradeable module. Your thesis as a whole has a payout derived from its components."
    },
    {
      question: "How is Cascade different from Polymarket?",
      answer: "Polymarket forces everything into single yes/no questions. Cascade lets you express conditional conviction — chains of reasoning where each link is independently tradeable. You get partial credit when you're right about some legs but not others. Sharper thinking, more nuanced positions."
    },
    {
      question: "How do I get started?",
      answer: "To use Cascade, you need a secure login. Once connected, you can browse markets, place trades, and create your own prediction markets on any topic."
    },
    {
      question: "What is the trading mechanism?",
      answer: "We use a Liquidity-Sensitive Market Maker (LMSR) mechanism. You can buy Yes or No shares on markets. Prices are determined by the current probability and the amount of liquidity in each market."
    },
    {
      question: "How are markets resolved?",
      answer: "Market creators can resolve their markets once the outcome is known. The resolution determines the payouts for winning shares. All trades before resolution are honored."
    },
    {
      question: "How does Cascade store data?",
      answer: "Cascade uses a decentralized protocol for identity and data persistence, ensuring your data belongs to you."
    },
    {
      question: "Is my data private?",
      answer: "Yes. Your trades and data are stored securely, and only your public key is visible. We don't collect personal information. See our Privacy Policy for more details."
    },
    {
      question: "How do I create a market?",
      answer: "Connect your wallet and click 'New Market' in the navigation. Describe your question, set outcomes, and provide initial liquidity. Your market will be published publicly."
    }
  ];

  const contactLinks = [
    { name: "X/Twitter", href: "https://x.com/paborlmcik" }
  ];
</script>

<svelte:head>
  <title>Help | Cascade</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 py-20">
  <NavHeader />
  <div class="max-w-3xl mx-auto px-6">
    <h1 class="text-4xl font-bold text-white mb-4">Help Center</h1>
    <p class="text-neutral-400 mb-12">
      Everything you need to know about Cascade prediction markets.
    </p>

    <div class="space-y-6">
      {#each faqs as faq, i}
        <div class="bg-neutral-800/50 border border-neutral-700 p-6">
          <h2 class="text-lg font-semibold text-white mb-3">
            {faq.question}
          </h2>
          <p class="text-neutral-400 leading-relaxed">
            {faq.answer}
          </p>
        </div>
      {/each}
    </div>

    <div class="mt-12 bg-neutral-800/50 border border-neutral-700 p-6">
      <h2 class="text-lg font-semibold text-white mb-3">
        Still have questions?
      </h2>
      <p class="text-neutral-400 mb-4">
        Reach out to us on social media or X:
      </p>
      <div class="flex gap-4">
        {#each contactLinks as link}
          <a 
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            class="text-emerald-500 hover:text-emerald-400"
          >
            {link.name}
          </a>
        {/each}
      </div>
    </div>

    <div class="mt-12 pt-8 border-t border-neutral-800">
      <a 
        href="/" 
        class="text-neutral-400 hover:text-white transition-colors"
      >
        ← Back to Home
      </a>
    </div>
  </div>
</div>
