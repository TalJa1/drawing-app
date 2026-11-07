import { expect, test } from '@playwright/test'

/* The error screen's "Try again" when a page of the app cannot be fetched (a bad connection, a damaged browser cache,
   a file a new release replaced). React keeps that failure for good, so the button has to load the page again. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })

test('a page that could not be fetched comes back with "Try again"', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', s)
    sessionStorage.setItem('e2e', '1')
  }, settings)

  let blocked = true
  let refused = 0
  await page.route('**/pages/learn/LearnHubPage.tsx*', (route) => {
    if (!blocked) return route.continue()
    refused++
    return route.abort('failed') // what the browser sees when the file cannot be fetched
  })

  await page.goto('/')
  await page.getByRole('link', { name: 'Learn', exact: true }).first().click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('paint pot tipped over')
  expect(refused).toBeGreaterThan(0)

  blocked = false // the connection is back
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(problems.filter((p) => !/dynamically imported module/.test(p))).toEqual([])
})
