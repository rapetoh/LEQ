import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 8 bundles with Rolldown and transforms with Oxc; no extra option is needed for React 19.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
  preview: {
    port: 4174,
  },
  build: {
    sourcemap: false,
  },
})
