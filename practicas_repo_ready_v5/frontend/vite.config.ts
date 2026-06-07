import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: [
      'sunny-optimism-production-77e4.up.railway.app',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})