import { defineConfig, devices } from '@playwright/test'

/* The specs in ./e2e-live run in a real browser against a real back-end (see e2e-live/README.md).
   They are not part of `npm run test:e2e`, which uses playwright.config.ts. */
export default defineConfig({
  testDir: './e2e-live',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:5199',
    trace: 'retain-on-failure',
    // set PW_CHROMIUM to use a Chromium that is not the one Playwright installed
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
