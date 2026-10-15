import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // "@/lib/cart" → <racine>/lib/cart (comme dans Next.js)
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.js'],
      exclude: ['lib/supabase*.js', 'lib/garde.js', 'lib/config.js'],
    },
  },
})
