/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/* The text fonts come from CSS that the app imports, so the browser only learns about them after the script and the style
   sheet are parsed: measured on a throttled CPU, the first font request started at ~700-1000 ms while the page already
   showed text in the fallback font from ~250 ms. This adds <link rel="preload"> for the files the first screen uses.
   Latin files are preloaded for everyone; the Vietnamese ones only when the saved language is Vietnamese (a script in
   <head> adds them right after the first frame), so nobody downloads a font he will not use. Build only: in `vite dev` the CSS is injected
   by the script and the file names are not hashed. */
const CRITICAL_FONTS = [/fraunces-latin-opsz-normal-/, /fraunces-latin-opsz-italic-/, /inter-latin-wght-normal-/]
const VIETNAMESE_FONTS = [/fraunces-vietnamese-opsz-normal-/, /fraunces-vietnamese-opsz-italic-/, /inter-vietnamese-wght-normal-/]
function preloadFonts(): Plugin {
  return {
    name: 'art-spark:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => f.endsWith('.woff2'))
        const pick = (res: RegExp[]) => res.map((re) => files.find((f) => re.test(f))).filter((f): f is string => !!f)
        const href = (f: string) => `/${f}`
        const tags: import('vite').HtmlTagDescriptor[] = pick(CRITICAL_FONTS).map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: href(f), crossorigin: '' },
          injectTo: 'head-prepend',
        }))
        const vi = pick(VIETNAMESE_FONTS).map(href)
        if (vi.length) {
          tags.push({
            tag: 'script',
            // after the first frame: asking for them earlier delayed the first paint (measured, see the handoff)
            children: `try{if((JSON.parse(localStorage.getItem('artspark:settings')||'{}').state||{}).language==='vi'){requestAnimationFrame(function(){setTimeout(function(){${JSON.stringify(vi)}.forEach(function(u){var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='';l.href=u;document.head.appendChild(l)})},0)})}}catch(e){}`,
            injectTo: 'head',
          })
        }
        return tags
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      // in dev the browser talks to this origin and Vite forwards /api to the back-end (so no CORS to set up)
      proxy: { '/api': { target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000' } },
    },
    plugins: [react(), tailwindcss(), preloadFonts()],
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
