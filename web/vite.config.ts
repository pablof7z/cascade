import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [sveltekit()],
  build: isSsrBuild
    ? undefined
    : {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('@nostr-dev-kit/svelte')) return 'ndk-svelte';
              if (id.includes('@nostr-dev-kit/sessions')) return 'ndk-sessions';
              if (id.includes('@nostr-dev-kit/sync')) return 'ndk-sync';
              if (id.includes('@nostr-dev-kit/ndk')) return 'ndk-core';
              if (id.includes('nostr-tools')) return 'nostr-tools';
              if (id.includes('@noble') || id.includes('@scure')) return 'nostr-crypto';

              if (id.includes('/marked/')) {
                return 'markdown-vendor';
              }

              return undefined;
            }
          }
        }
      }
}));
