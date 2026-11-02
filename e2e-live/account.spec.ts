import { expect, test, type Page } from '@playwright/test'

/* The data card of the profile page: the export is the server's file; there is no demo data, no local delete, no "simulate errors". */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })
const PASSWORD = 'long-enough-1'

let n = 0
const uniq = () => `acct-${Date.now()}-${++n}`

async function prep(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return
    problems.push('console: ' + m.text())
  })
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', s)
    sessionStorage.setItem('e2e', '1')
  }, settings)
  return problems
}

async function register(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Artist name').fill(`Lan ${++n}`)
  await page.getByLabel('Email').fill(`${uniq()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page).toHaveURL(/\/practice$/)
}

test.describe('profile — your data', () => {
  test('a signed-in person downloads what the server keeps; nothing of the old demo tools is left', async ({ page }) => {
    const problems = await prep(page)
    const requests: string[] = []
    page.on('request', (r) => r.url().includes('/api/v1/') && requests.push(`${r.method()} ${new URL(r.url()).pathname}`))

    await register(page)

    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Your data' })).toBeVisible()
    await expect(page.getByText(/demo data/i)).toHaveCount(0)
    await expect(page.getByText(/server hiccups/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /delete all local data/i })).toHaveCount(0)

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /export my data/i }).click()])
    expect(download.suggestedFilename()).toMatch(/^art-spark-data-\d{4}-\d{2}-\d{2}\.json$/)
    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    const file = JSON.parse(readFileSync(path, 'utf8'))
    expect(file.app).toBe('Art Spark')
    expect(Object.keys(file)).toEqual(expect.arrayContaining(['exportedAt', 'user', 'progress', 'learning', 'artworks', 'xpLedger']))
    expect(file).not.toHaveProperty('conversations')
    expect(file).not.toHaveProperty('settings')
    expect(requests.filter((r) => r === 'GET /api/v1/me/export')).toHaveLength(1)
    await expect(page.getByText('Your data has been downloaded')).toBeVisible()
    expect(problems).toEqual([])
  })

  test('a guest has no data card and asks nothing about an export', async ({ page }) => {
    const problems = await prep(page)
    const requests: string[] = []
    page.on('request', (r) => r.url().includes('/api/v1/') && requests.push(`${r.method()} ${new URL(r.url()).pathname}`))

    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: "The artist's corner" })).toBeVisible()
    await expect(page.getByRole('button', { name: /export my data/i })).toHaveCount(0)
    await expect(page.getByText(/demo data/i)).toHaveCount(0)
    expect(requests).not.toContain('GET /api/v1/me/export')
    expect(problems).toEqual([])
  })

  test('the empty gallery no longer offers sample artworks', async ({ page }) => {
    const problems = await prep(page)
    await register(page) // a guest is sent to the sign-in page: the gallery belongs to an account
    await page.goto('/collection')
    await expect(page.getByText('Every masterpiece begins with one brave line.')).toBeVisible()
    await expect(page.getByRole('button', { name: /demo artworks/i })).toHaveCount(0)
    expect(problems).toEqual([])
  })
})
