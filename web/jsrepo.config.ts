import { defineConfig } from 'jsrepo';

export default defineConfig({
  registries: ['@ndk/svelte'],
  paths: {
    '*': '$lib/ndk/components',
    blocks: '$lib/ndk/blocks',
    builders: '$lib/ndk/builders',
    components: '$lib/ndk/components',
    hooks: '$lib/ndk/hooks',
    icons: '$lib/ndk/icons',
    ui: '$lib/ndk/ui',
    utils: '$lib/ndk/utils'
  }
});
