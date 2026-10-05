import { defineConfig } from 'vitest/config'

/** Live probes — real API + macOS capture. Run via pnpm test:*:live */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*live.e2e.test.ts'],
    testTimeout: 60_000
  }
})
