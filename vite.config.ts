import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  // Everything is inlined into index.html. Brimble's CDN caches a 404 for a
  // fresh asset file when a browser asks for it during a deploy (the request
  // carries an Origin header, so it is cached separately from the good copy).
  // One uncached HTML file leaves nothing to go stale.
  plugins: [react(), viteSingleFile()],
  // Stamped into the bundle; the Settings page shows which build is live.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
})
