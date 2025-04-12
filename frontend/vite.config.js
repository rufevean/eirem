import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['ba6a-2401-4900-8899-698a-6748-c8c3-ee5e-a49.ngrok-free.app'],
  },
})
