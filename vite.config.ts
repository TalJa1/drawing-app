/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      // in dev the browser talks to this origin and Vite forwards /api to the back-end (so no CORS to set up)
      proxy: { '/api': { target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000' } },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      rolldownOptions: {
        output: {
          // a few long-lived vendor chunks instead of dozens of tiny ones (e.g. one per icon)
          codeSplitting: {
            minSize: 20_000,
            groups: [
              {
                name: 'react',
                // react-dom/server is only used (lazily) by the demo-data seeder
                test: /node_modules[\\/](react|scheduler|react-router|react-router-dom|@remix-run)[\\/]|node_modules[\\/]react-dom[\\/](?!server|cjs[\\/]react-dom-server)/,
                priority: 40,
              },
              { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 30 },
              { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
