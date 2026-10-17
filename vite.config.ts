import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Stamped into the bundle, so every deploy ships a new JS filename and the
  // Settings page shows which build is live.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
})
