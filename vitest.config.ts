import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only' throws when imported outside a React Server environment;
      // point it at its own no-op so server modules can be unit-tested.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
