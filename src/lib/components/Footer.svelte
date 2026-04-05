<script lang="ts">
  import { goto } from '$app/navigation'

  const navigationLinks = [
    { label: 'Home', to: '/' },
    { label: 'Markets', to: '/' },
    { label: 'Blog', to: '/blog' },
    { label: 'Analytics', to: '/analytics' },
  ];

  const socialLinks = [
    { label: 'X / Twitter', href: 'https://x.com/ArekBulski' },
    { label: 'Nostr', href: 'https://njump.me/npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft' },
    { label: 'GitHub', href: 'https://github.com/pablof7z' },
  ];

  const legalLinks = [
    { label: 'Terms of Service', to: '/legal/terms' },
    { label: 'Privacy Policy', to: '/legal/privacy' },
  ];

  const currentYear = new Date().getFullYear();
</script>

<footer class="w-full border-t border-neutral-800 bg-neutral-950">
  <div class="max-w-7xl mx-auto px-6 py-12">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
      <!-- Brand Column -->
      <div class="md:col-span-1">
        <Link to="/" class="inline-block">
          <span class="text-xl font-bold text-white">Cascade</span>
        </Link>
        <p class="mt-3 text-sm text-neutral-500 leading-relaxed">
          Trade on ideas that don't expire. Prediction markets for evolving truth.
        </p>
      </div>
      
      <!-- Navigation Column -->
      <div>
        <h4 class="text-sm font-semibold text-white mb-4">Navigate</h4>
        <ul class="space-y-2">
          {#each navigationLinks as link}
            <li key={link.to + link.label}>
              <Link 
                to={link.to}
                class="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            </li>
          {/each}
        </ul>
      </div>
      
      <!-- Social Column -->
      <div>
        <h4 class="text-sm font-semibold text-white mb-4">Connect</h4>
        <ul class="space-y-2">
          {#each socialLinks as link}
            <li key={link.href}>
              <a 
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {#if link.label === 'X / Twitter'}
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                {:else if link.label === 'Nostr'}
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                {:else if link.label === 'GitHub'}
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                {/if}
                <span>{link.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
      
      <!-- Legal Column -->
      <div>
        <h4 class="text-sm font-semibold text-white mb-4">Legal</h4>
        <ul class="space-y-2">
          {#each legalLinks as link}
            <li>
              <a href={link.to} class="text-sm text-neutral-400 hover:text-white transition-colors">
                {link.label}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
    
    <!-- Bottom Bar -->
    <div class="mt-12 pt-6 border-t border-neutral-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
      <p class="text-sm text-neutral-500">
        © {currentYear} Cascade. All rights reserved.
      </p>
      <span class="text-xs text-neutral-600 font-mono">
        Build: dev
      </span>
    </div>
  </div>
</footer>
