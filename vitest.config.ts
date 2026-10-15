import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['tests/inertia/**/*.spec.ts'],
    // Restaure `vi.stubGlobal(...)` (ex. `confirm`) entre deux tests.
    unstubGlobals: true,
  },
  resolve: {
    alias: {
      '~/': fileURLToPath(new URL('./inertia/', import.meta.url)),
      '@generated': fileURLToPath(new URL('./.adonisjs/client/', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
