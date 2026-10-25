/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// pdf.js needs its character maps (for CJK fonts) and standard fonts as static files.
function copyPdfjsAssets() {
  const from = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url))
  const to = fileURLToPath(new URL('./public/pdfjs/', import.meta.url))
  for (const dir of ['cmaps', 'standard_fonts']) {
    if (!existsSync(to + dir)) cpSync(from + dir, to + dir, { recursive: true })
  }
  return { name: 'copy-pdfjs-assets' }
}

// GitHub Pages serves the app from /<repo>/. The deploy workflow sets BASE_PATH; locally it is /.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  server: { fs: { allow: ['..'] } },
  plugins: [
    copyPdfjsAssets(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Knitting Chart Buddy',
        short_name: 'Chart Buddy',
        description: 'Step through a knitting chart one stitch group at a time.',
        theme_color: '#5b3f8c',
        background_color: '#faf8fc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,json,bcmap,pfb,ttf}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
})
