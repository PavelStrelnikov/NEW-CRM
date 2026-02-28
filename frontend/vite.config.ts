import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Get backend URL from environment or use default
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'
const sptUrl = process.env.VITE_SPT_URL || 'http://localhost:8001'

// HTTPS via mkcert certificates (for LAN dev with secure context)
const certFile = path.resolve(__dirname, '../certs/localhost+3.pem')
const keyFile = path.resolve(__dirname, '../certs/localhost+3-key.pem')
const httpsConfig = fs.existsSync(certFile) && fs.existsSync(keyFile)
  ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  : undefined

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
    https: httpsConfig,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
      '/spt-api': {
        target: sptUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/spt-api/, ''),
      },
    },
  },
})
