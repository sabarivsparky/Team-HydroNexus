import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser always calls relative /api/* URLs; Vite proxies them to the
// FastAPI backend in development (also works behind the hosted preview).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
