import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config.js';

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: {
    // Stable HMR port for the extension dev build.
    port: 5180,
    strictPort: true,
    hmr: { port: 5180 },
  },
});
