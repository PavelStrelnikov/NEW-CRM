import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Get backend URL from environment or use default
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: process.env.VITE_HOST || '127.0.0.1', // Use 0.0.0.0 for LAN access
    port: 3000,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
})
