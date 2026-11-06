import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import release from './src/release.json' with { type: 'json' };

/** Shared links show these. Link previews don't run the app, so each page gets its own HTML. */
const PREVIEWS = [
  {
    path: 'features',
    title: 'Features · Finance Tracker',
    description:
      'Everything Finance Tracker does for your family: money, investments, loans and privacy.',
  },
  {
    path: 'privacy',
    title: 'Privacy · Finance Tracker',
    description: 'How Finance Tracker keeps your records encrypted, and what it can and can’t see.',
  },
];

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export default defineConfig({
  plugins: [
    react(),
    {
      // Lets a running app read what a newer version includes.
      name: 'release-notes',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(release),
        });
      },
    },
    {
      // Sign-in waits on Firebase, which loads after the app starts. Asking for it up front
      // lets it download alongside the app instead of after it.
      name: 'preload-firebase',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          const chunk = Object.values(context.bundle ?? {}).find(
            (file) => file.type === 'chunk' && file.name === 'firebase',
          );
          if (!chunk) return html;
          return html.replace(
            '</head>',
            `  <link rel="modulepreload" crossorigin href="/${chunk.fileName}">\n  </head>`,
          );
        },
      },
    },
    {
      name: 'page-previews',
      apply: 'build',
      closeBundle() {
        const html = readFileSync('dist/index.html', 'utf8');
        for (const { path, title, description } of PREVIEWS) {
          const page = html
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
            .replace(/(name="description" content=")[^"]*/, `$1${escape(description)}`)
            .replace(/(property="og:title" content=")[^"]*/, `$1${escape(title)}`)
            .replace(/(property="og:description" content=")[^"]*/, `$1${escape(description)}`)
            .replace(
              /(property="og:url" content=")[^"]*/,
              `$1https://finance-trackerp.web.app/${path}`,
            );
          mkdirSync(`dist/${path}`, { recursive: true });
          writeFileSync(`dist/${path}/index.html`, page);
        }
      },
    },
    VitePWA({
      // Updates wait for the person to accept them, so unsaved work is never lost.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Finance Tracker',
        short_name: 'Finance Tracker',
        description:
          'Track your family’s income, expenses, investments and loans in one place. Free, and encrypted on your phone.',
        id: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#102826',
        theme_color: '#102826',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-monochrome-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'monochrome',
          },
        ],
        // Shown in Android's install pop-up. Sample data only.
        screenshots: [
          ...['dashboard', 'investments', 'debts', 'privacy'].map((name) => ({
            src: `/screenshots/${name}.png`,
            sizes: '1170x2532',
            type: 'image/png',
            form_factor: 'narrow' as const,
          })),
          {
            src: '/screenshots/desktop.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide' as const,
          },
        ],
        // A long press on the app icon offers these.
        shortcuts: [
          {
            name: 'Add expense',
            url: '/cash-flow?add=expense',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Add income',
            url: '/cash-flow?add=income',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Investments',
            url: '/investments',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Loans',
            url: '/debts',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // App files only. Financial records stay in Firestore's own cache.
        globPatterns: ['**/*.{js,css,html,png,webp,woff2}'],
        // Only needed by link previews, install pop-ups and iPhone launch, never offline.
        globIgnores: ['og-image.png', 'screenshots/**', 'splash/**'],
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
