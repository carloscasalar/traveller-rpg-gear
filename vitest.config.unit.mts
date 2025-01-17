import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Includes glob patterns for test files
    include: ['./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Excludes Workers tests that require wrangler
    exclude: ['./test/**'],

    // Common test environment settings
    environment: 'node',
    globals: true,

    // Coverage settings (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
