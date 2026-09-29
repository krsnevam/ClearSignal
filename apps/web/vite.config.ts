import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'ClearSignal — Kodagu',
        short_name: 'ClearSignal',
        description:
          'Which villages need evacuation support first, and how much should I trust that answer?',
        theme_color: '#0B0F14',
        background_color: '#F6F7F9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: precached at build time (§10.4).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // /rankings — network-first, 3 s timeout, fall back to last-known-good.
            urlPattern: ({ url }) => /\/rankings$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-rankings',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // /recommendation/:id — spec §10.4 says stale-while-revalidate, but SWR shows
            // the previous evidence after a new SMS lands. Network-first (3 s) keeps the
            // "why" view live and still falls back to the cache offline. 1 h TTL kept.
            urlPattern: ({ url }) => /\/recommendation\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-recommendation',
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 3600, maxEntries: 100 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/sources\/status$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-sources', networkTimeoutSeconds: 3 },
          },
          {
            // Self-hosted map glyphs + sprites — needed for labels offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/basemap/'),
            handler: 'CacheFirst',
            options: { cacheName: 'basemap-assets', cacheableResponse: { statuses: [200] } },
          },
          {
            // PMTiles basemap — cache-first, never expires; range requests served from the cached file.
            urlPattern: ({ url }) => url.pathname.endsWith('.pmtiles'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap',
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: true },
});
