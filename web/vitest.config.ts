import { defineConfig, defaultExclude } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const stubsDir = fileURLToPath(new URL('./tests/stubs', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$env/dynamic/public': `${stubsDir}/env-public.mjs`,
      '$app/environment': `${stubsDir}/app-environment.mjs`
    }
  },
  test: {
    environment: 'node',
    // Exclude node:test files (run via `bun test`) and Playwright e2e tests,
    // while preserving vitest's own default excludes (node_modules, dist, etc.)
    exclude: [
      ...defaultExclude,
      '**/tests/unit/**',
      '**/tests/e2e/**',
      '**/tests/*.test.mjs',
      '**/*.spec.ts'
    ],
    passWithNoTests: true
  }
});
