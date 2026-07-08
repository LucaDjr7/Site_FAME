import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scenario/**/*.test.ts', 'scripts/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
