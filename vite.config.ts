import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function getGitValue(command: string) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const latestCommitIsoDate = getGitValue('git log -1 --format=%cI')
const latestCommitTitle = getGitValue('git log -1 --format=%s')

export default defineConfig({
  define: {
    __LATEST_COMMIT_ISO_DATE__: JSON.stringify(latestCommitIsoDate),
    __LATEST_COMMIT_TITLE__: JSON.stringify(latestCommitTitle),
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  base: '/special-umbrella/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Workout Plan Tracker',
        short_name: 'Workout',
        description: 'Rotation-based personal workout plan tracker',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/special-umbrella/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache' },
          },
        ],
      },
    }),
  ],
})
