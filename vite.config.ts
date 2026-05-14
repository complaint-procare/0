import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// `base` falls back to './' for local builds; CI sets VITE_BASE_PATH=/<repo>/
// so the bundle works at https://<owner>.github.io/<repo>/.
const base = process.env.VITE_BASE_PATH ?? './'

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          tanstack: ['@tanstack/react-query', '@tanstack/react-table'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
