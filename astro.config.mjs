// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'static',
  integrations: [
    preact(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'xpns',
        short_name: 'xpns',
        description: 'Employee expense reporting',
        theme_color: '#F4F1EA',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
    }),
  ],
});