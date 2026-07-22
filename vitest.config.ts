import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Fast deterministic suite — live API probes run via pnpm test:*:live
    include: ['src/**/*.test.ts', 'src/**/*.e2e.test.ts'],
    exclude: ['src/**/*.live.e2e.test.ts', 'node_modules/**']
  }
})
