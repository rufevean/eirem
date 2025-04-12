import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 👈 Allow connections from LAN (tablet, phone, etc.)
    port: 5173,       // 👈 Optional, but you can specify if needed
  },
})
