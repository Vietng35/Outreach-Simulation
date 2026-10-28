import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // All tests share one emulator database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
