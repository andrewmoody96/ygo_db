import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/ygo_db/
export default defineConfig({
  base: '/ygo_db/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'YGO Collection',
        short_name: 'YGO DB',
        description: 'Personal Yu-Gi-Oh! TCG collection database',
        theme_color: '#1d2433',
        background_color: '#11151f',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // Card data (public/data) is not precached: the app stores it itself
        // and re-downloads only when meta.json reports a new version.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        globIgnores: ['data/**'],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
});
