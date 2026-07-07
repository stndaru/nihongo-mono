import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  // the dataset JSON is large — ship it as one JSON.parse("…") string per
  // module (smaller than an object literal, and faster for engines to parse)
  json: { stringify: true, namedExports: false },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // deep CJS imports, loaded lazily on the parser's "Accurate Parsing"
    // opt-in — pre-bundle them so the first use doesn't trigger a dev-server
    // re-optimization reload
    include: ['kuromoji/src/dict/DynamicDictionaries.js', 'kuromoji/src/Tokenizer.js'],
  },
})
