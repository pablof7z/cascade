<script lang="ts">
</script>

<svelte:head>
  <title>Privacy Policy | Cascade</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 py-20">
  <div class="max-w-3xl mx-auto px-6">
    <h1 class="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
    <p class="text-neutral-500 text-sm mb-10">Last Updated: April 5, 2026</p>

    <div class="space-y-8 text-neutral-300 leading-relaxed">
      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">1. Data We Collect</h2>
        <p>
          Cascade collects minimal data to operate the platform:
        </p>
        <ul class="list-disc list-inside mt-4 space-y-2 text-neutral-400">
          <li><strong class="text-neutral-300">Nostr Public Keys:</strong> Your Nostr identity (public key) is used for authentication and as your username on the platform.</li>
          <li><strong class="text-neutral-300">Relay Interactions:</strong> When you use Cascade, we may interact with Nostr relays to fetch and publish market and trade events on your behalf.</li>
          <li><strong class="text-neutral-300">Local Preferences:</strong> We may store preferences (such as UI settings) in your browser's local storage for a better experience.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">2. Data We Do NOT Collect</h2>
        <p>
          Unlike traditional platforms, Cascade does not collect:
        </p>
        <ul class="list-disc list-inside mt-4 space-y-2 text-neutral-400">
          <li>Email addresses or phone numbers</li>
          <li>Names or personal information</li>
          <li>Passwords or private keys (we never have access to these)</li>
          <li>Traditional account credentials</li>
          <li>Browser history or tracking data beyond essential analytics</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">3. Nostr is Public by Design</h2>
        <p>
          Cascade operates on Nostr, a decentralized protocol. When you create markets, place trades, or interact with the platform, these events are published to Nostr relays as public, unencrypted events.
        </p>
        <p class="mt-4">
          Anyone can view these events using Nostr clients or relay explorers. We have no control over this data once published. Consider the public nature of Nostr before sharing sensitive information.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">4. Local Storage</h2>
        <p>
          Cascade may use your browser's local storage to save:
        </p>
        <ul class="list-disc list-inside mt-4 space-y-2 text-neutral-400">
          <li>UI preferences and display settings</li>
          <li>Cached market data for faster loading</li>
          <li>Temporary session information</li>
        </ul>
        <p class="mt-4">
          This data stays on your device and is not transmitted to our servers.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">5. Analytics</h2>
        <p>
          We use PostHog for product analytics to understand how users interact with Cascade. PostHog tracks:
        </p>
        <ul class="list-disc list-inside mt-4 space-y-2 text-neutral-400">
          <li>Page views and navigation patterns</li>
          <li>Funnel events (e.g., market creation flow, trading flow)</li>
          <li>Feature usage and engagement metrics</li>
          <li>Anonymous session duration and error events</li>
        </ul>
        <p class="mt-4">
          Analytics data is anonymized and aggregated. We do not track individual trading behavior or link analytics to specific Nostr public keys.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">6. Cashu Token Privacy</h2>
        <p>
          Trading on Cascade uses Cashu ecash tokens, which provide strong privacy guarantees:
        </p>
        <ul class="list-disc list-inside mt-4 space-y-2 text-neutral-400">
          <li><strong class="text-neutral-300">Blinded Signatures:</strong> Cashu mints use blind signature cryptography, meaning mints cannot link deposits to withdrawals.</li>
          <li><strong class="text-neutral-300">No Individual Tracking:</strong> While mints see aggregate transaction volumes, they cannot see individual user behavior or link trades to public keys.</li>
          <li><strong class="text-neutral-300">User-Controlled Tokens:</strong> Your ecash tokens are stored in your wallet and are only spent by you.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">7. Third-Party Relays</h2>
        <p>
          Cascade relies on Nostr relays operated by various third parties. When you use Cascade, your events pass through these relays, which are outside our control.
        </p>
        <p class="mt-4">
          Relay operators may have their own data practices. We encourage you to research relay policies if privacy is a primary concern. Using your own relay or a trusted relay set can improve your privacy posture.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">8. Data Selling</h2>
        <p>
          We do not sell, rent, or share your personal data with third parties for marketing purposes. Your public key and on-platform activity remain private to the extent technically possible.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">9. Data Security</h2>
        <p>
          While Nostr is decentralized and we don't hold traditional user data, we implement security best practices for our platform infrastructure. However, no internet-based system is completely secure. We encourage users to protect their private keys and use reputable Nostr signers.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. We encourage you to review this policy periodically.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-white mt-10 mb-4">11. Contact</h2>
        <p>
          For questions about this Privacy Policy or our data practices, contact us at:
        </p>
        <p class="mt-2">
          <a 
            href="https://njump.me/npub1jfmfh0hj0g4qgv3l0aez0w8unsn73c7n6lhrgn3x40x4g0n5mkqsz8x3y5" 
            target="_blank"
            rel="noopener noreferrer"
            class="text-emerald-500 hover:text-emerald-400"
          >
            Cascade Support
          </a>
        </p>
      </section>
    </div>

    <div class="mt-16 pt-8 border-t border-neutral-800">
      <a 
        href="/" 
        class="text-neutral-400 hover:text-white transition-colors"
      >
        ← Back to Home
      </a>
    </div>
  </div>
</div>
