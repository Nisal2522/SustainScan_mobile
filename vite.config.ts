import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-v3.png',
        'icons/logo-horizontal.png',
      ],
      manifest: {
        // Unique id helps Chrome treat this as an updated installable app
        id: '/?source=pwa-v3',
        // Android system splash draws `name` + 512 icon + background_color.
        // ZWSP name + solid icon matching bg = no visible branded splash.
        name: '\u200B',
        short_name: 'SustainScan',
        description:
          'SustainScan helps Control Union and client users access sustainable timber scanning, logging, and inventory tools.',
        theme_color: '#ffffff',
        background_color: '#0a162e',
        display: 'standalone',
        orientation: 'portrait',
        // Cache-bust start URL so installed WebAPK re-checks the manifest
        start_url: '/?source=pwa-v3',
        scope: '/',
        icons: [
          {
            src: 'icons/app-192-v3.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Solid #0a162e — same as background_color (invisible on Android splash)
            src: 'icons/app-512-v3.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // White background + logo for Home Screen / adaptive icons
            src: 'icons/app-maskable-512-v3.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Always refresh HTML/manifest so splash-related metadata isn't sticky
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.mode === 'navigate' ||
              request.destination === 'document' ||
              (request.url && request.url.includes('manifest.webmanifest')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ss-navigations-v2',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    host: true,
  },
})
