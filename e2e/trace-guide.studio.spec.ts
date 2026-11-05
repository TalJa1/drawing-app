/* The trace guide on /free-draw takes its template from the list the server sends (the same list as the library), so a page that
   names a guide waits for that list instead of opening plain and then opening again.
   Runs on the recorded API (e2e/fixtures/api), no back-end needed; trace-guide.spec.ts covers drawing, saving and downloading. */
import { expect, test, type Page } from '@playwright/test'
import { prepare, settle } from './support/app.js'

const TEMPLATES = '**/api/v1/templates'
const canvas = (page: Page) => page.getByRole('img', { name: 'Drawing canvas' })

/** Dark, non-transparent pixels the guide leaves on the drawing canvas (zero on a plain page). */
const guideInk = (page: Page) =>
  canvas(page).evaluate((element: HTMLCanvasElement) => {
    const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)
    let dark = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0 && data[i] < 210 && data[i] > 120) dark++
    return dark
  })

test('a guided page waits for the template list and opens its canvas once, with the guide', async ({ page }) => {
  await prepare(page, { language: 'en' })
  // The list is held until the test lets it go. Registered after the recorded API, so it answers first and then hands the request on.
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(TEMPLATES, async (route) => {
    await held
    await route.fallback()
  })
  const asked = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/api/v1/templates'), { timeout: 8_000 })
  await page.goto('/free-draw?guide=cat')

  // The page asked for the list, and while it has not answered there is a loader and no canvas yet (not a plain canvas that is rebuilt later).
  await asked
  await expect(page.getByRole('status')).toBeVisible()
  await page.waitForTimeout(600)
  await expect(canvas(page)).toHaveCount(0)

  release()
  await expect(canvas(page)).toBeVisible({ timeout: 10_000 })
  await canvas(page).evaluate((element) => (element.dataset.openedOnce = 'yes'))
  await page.waitForTimeout(800)
  await expect(canvas(page)).toHaveAttribute('data-opened-once', 'yes')
  await expect(page.getByRole('button', { name: 'Trace guide' }).first()).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => guideInk(page), { timeout: 10_000 }).toBeGreaterThan(500)
})

test('a plain Free Draw page does not ask the server for the template list', async ({ page }) => {
  const asked: string[] = []
  await prepare(page, { language: 'en' })
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/api/v1/templates')) asked.push(request.url())
  })
  await page.goto('/free-draw?prompt=Cat')
  await settle(page)
  await expect(canvas(page)).toBeVisible()
  expect(asked).toEqual([])
})

test('when the template list cannot be loaded the page opens plain', async ({ page }) => {
  await prepare(page, { language: 'en' })
  await page.route(TEMPLATES, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal', message: 'down' } }) }),
  )
  await page.goto('/free-draw?guide=cat')
  await expect(canvas(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Trace guide' })).toHaveCount(0)
  expect(await guideInk(page)).toBeLessThan(50)
})

test('an unknown guide opens plain once the list has arrived', async ({ page }) => {
  await prepare(page, { language: 'en' })
  await page.goto('/free-draw?guide=invented')
  await expect(canvas(page)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Trace guide' })).toHaveCount(0)
})
