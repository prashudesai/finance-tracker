import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Updates wait for the person to accept them, so unsaved work is never lost.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Personal Finance Tracker',
        short_name: 'Finance Tracker',
        start_url: '/',
        display: 'standalone',
        background_color: '#102826',
        theme_color: '#102826',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App files only. Financial records stay in Firestore's own cache.
        globPatterns: ['**/*.{js,css,html,png,webp,woff2}'],
        runtimeCaching: [],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
