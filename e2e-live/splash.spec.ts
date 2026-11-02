import { test, expect, type Page } from '@playwright/test'
const settings = (lang: string) =>
  JSON.stringify({ state: { theme: 'light', language: lang, onboardingDone: true, customCursor: false }, version: 1 })
async function prep(page: Page, lang = 'en') {
  await page.addInitScript(
    ([s]) => {
      if (sessionStorage.getItem('e2e')) return
      localStorage.clear()
      localStorage.setItem('artspark:settings', s)
      sessionStorage.setItem('e2e', '1')
    },
    [settings(lang)],
  )
}
const retry = (page: Page) => page.locator('#splash-retry')

test('A: a module of the first bundle is REFUSED -> the splash turns into a message with a way to try again', async ({ page }) => {
  await prep(page)
  await page.route('**/src/lib/color.ts*', (r) => r.abort('failed'))
  await page.goto('/learn/color-lab')
  await expect(retry(page)).toBeVisible({ timeout: 4000 }) // quick: the browser told us it failed
  await expect(page.locator('#splash')).toContainText(/couldn.t be opened|didn.t open|taking longer/i)
})

test('B: a module NEVER ANSWERS -> after a while the splash says so and offers a reload', async ({ page }) => {
  await prep(page)
  await page.route('**/src/lib/color.ts*', () => {})
  await page.goto('/learn/color-lab', { waitUntil: 'commit' })
  await expect(page.locator('#splash')).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(retry(page)).toHaveCount(0) // not yet: a slow start is not an error
  await expect(retry(page)).toBeVisible({ timeout: 15000 })
})

test('C: in Vietnamese the message is in Vietnamese, and the button reloads the page', async ({ page }) => {
  await prep(page, 'vi')
  await page.route('**/src/lib/color.ts*', (r) => r.abort('failed'))
  await page.goto('/learn/color-lab')
  await expect(retry(page)).toBeVisible({ timeout: 4000 })
  await expect(retry(page)).toHaveText('Tải lại')
  await page.unroute('**/src/lib/color.ts*') // the "network" is back
  await retry(page).click()
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 15000 }) // React replaced the splash: the app is up
  console.log(
    'C after reload:',
    JSON.stringify({
      url: page.url(),
      h1: await page.locator('h1').count(),
      h2: await page.locator('h2').count(),
      text: (await page.locator('body').innerText()).slice(0, 120),
    }),
  )
  await expect(page.getByRole('navigation').first()).toBeVisible()
})

test('D: a normal start never shows the message (no false alarm)', async ({ page }) => {
  await prep(page)
  await page.goto('/')
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 15000 })
  await page.waitForTimeout(11000) // longer than the watchdog
  await expect(retry(page)).toHaveCount(0)
})
