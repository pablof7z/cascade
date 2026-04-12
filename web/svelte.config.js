import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const runtimeAdapter =
  process.env.SVELTEKIT_ADAPTER === 'node'
    ? nodeAdapter({
        out: 'build',
        precompress: false
      })
    : vercelAdapter({
        runtime: 'nodejs22.x'
      });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: runtimeAdapter
  }
};

export default config;
