import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep warnings useful while acknowledging this is an admin-style SPA.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react'
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts'
          }

          if (id.includes('axios')) {
            return 'vendor-network'
          }

          return 'vendor'
        },
      },
    },
  },
})
