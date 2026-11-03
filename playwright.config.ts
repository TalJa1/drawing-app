import { defineConfig, devices } from '@playwright/test'

/* `npm run test:e2e`          every project below (the smoke specs need the back-end running; the layout specs do not).
   `npm run test:e2e:layout`   only the layout / accessibility specs, in Chromium + WebKit + Firefox, with no back-end:
                               they replay recorded API responses (e2e/fixtures/api, see e2e/support/app.ts).

   WebKit and Firefox are in the list on purpose: the hero headline defect (UX-01) only showed in WebKit, so a
   Chromium-only run would have hidden it. (Playwright's WebKit is not Safari itself, but it is the closest thing a
   Linux CI machine has.) */
const LAYOUT_SPECS = /(layout|studio)\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  projects: [
    // smoke specs: they register accounts and judge drawings, so they need the back-end
    { name: 'desktop', testIgnore: LAYOUT_SPECS, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testIgnore: LAYOUT_SPECS, use: { ...devices['Pixel 7'] } },
    // layout / accessibility specs, one project per engine
    { name: 'chromium', testMatch: LAYOUT_SPECS, use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', testMatch: LAYOUT_SPECS, use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', testMatch: LAYOUT_SPECS, use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    // E2E_PREVIEW=1 serves the production build (`npm run build` first), which is what CI does
    command: process.env.E2E_PREVIEW ? 'npx vite preview --port 5199 --strictPort' : 'npx vite --port 5199 --strictPort',
    url: process.env.E2E_BASE ?? 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
