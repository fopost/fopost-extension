import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config.js';

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      // CRXJS only builds HTML the manifest names as an entry point. The panel
      // is loaded by URL into an in-page iframe, not declared in the manifest,
      // so without this its <script src="./main.tsx"> is copied through
      // untransformed and the iframe renders blank.
      input: { sidepanel: 'src/sidepanel/index.html' },
    },
  },
  server: {
    // Stable HMR port for the extension dev build.
    port: 5180,
    strictPort: true,
    hmr: { port: 5180 },
  },
});
