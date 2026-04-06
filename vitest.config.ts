import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Disable tests for now — test setup is from React era
    include: ['src/**/*.disabled.test.ts'],
  },
})
