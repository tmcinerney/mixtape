import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // AIDEV-NOTE: host: true exposes the dev server to Docker's network.
    // usePolling enables file watching over Docker bind mounts (macOS → Linux).
    host: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
