import { expect, test, type Page, type Request } from '@playwright/test'

/* "Most popular" order from real counts (GET /template-popularity), real browser, real backend.

   Not part of `npm run test:e2e` (that one runs against mocks). It needs a backend that is already
   running and seeded so that the 4 templates the editorial `popularity` ranks last were practised
   (kind "practice", last 30 days) by 4, 3, 2 and 1 different people; the page must reach it at
   /api/v1 (Vite proxy or CORS). Run it with a Playwright config whose `testDir` is `./e2e-live`. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })

type Tpl = { id: string; title: { en: string }; popularity: number }

async function prep(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text())
  })
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', s)
    sessionStorage.setItem('e2e', '1')
  }, settings)
  return problems
}

const api = async <T>(page: Page, path: string): Promise<T> => {
  const res = await page.request.get(`/api/v1${path}`)
  expect(res.ok(), path).toBe(true)
  return (await res.json()) as T
}

/** Template ids in the order the cards are shown (titles read from the page, ids looked up by title). */
async function shownIds(page: Page, templates: Tpl[]): Promise<string[]> {
  const byTitle = new Map(templates.map((t) => [t.title.en, t.id]))
  const titles = await page.locator('article h3').allTextContents()
  return titles.map((t) => {
    const id = byTitle.get(t.trim())
    expect(id, `unknown card title "${t}"`).toBeDefined()
    return id!
  })
}

test('the default "Most popular" order follows the real counts, not the editorial number', async ({ page }) => {
  const problems = await prep(page)
  const seen: Request[] = []
  page.on('request', (r) => r.url().includes('/template-popularity') && seen.push(r))

  const templates = await api<Tpl[]>(page, '/templates')
  const { counts, windowDays } = await api<{ counts: Record<string, number>; windowDays: number }>(page, '/template-popularity')
  expect(windowDays).toBe(30)
  expect(Object.keys(counts)).toHaveLength(27)

  // what the order must be: most people first, ties in the API's order
  const expected = templates
    .map((t, i) => ({ id: t.id, n: counts[t.id] ?? 0, i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.id)
  const editorial = [...templates].sort((a, b) => b.popularity - a.popularity).map((t) => t.id)
  expect(expected.slice(0, 4), 'the data must make the real order differ from the editorial one').not.toEqual(editorial.slice(0, 4))

  await page.goto('/practice')
  await expect(page.locator('article')).toHaveCount(27)
  await expect(page.getByLabel('Sort by')).toHaveValue('popular')
  expect(await shownIds(page, templates)).toEqual(expected)
  expect(expected.slice(0, 4).map((id) => counts[id])).toEqual([4, 3, 2, 1])

  // one request for the numbers, and none when the window comes back into focus
  expect(seen.length).toBe(1)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(500)
  expect(seen.length).toBe(1)

  // the other two orders are not touched by the counts
  await page.getByLabel('Sort by').selectOption('easiest')
  const easiest = await shownIds(page, templates)
  expect(easiest).not.toEqual(expected)
  await page.getByLabel('Sort by').selectOption('popular')
  expect(await shownIds(page, templates)).toEqual(expected)

  expect(problems).toEqual([])
})

test('when the numbers cannot be fetched the library keeps the API order and shows no error', async ({ page }) => {
  const problems = await prep(page)
  await page.route('**/api/v1/template-popularity', (route) => route.abort('connectionrefused'))
  const templates = await api<Tpl[]>(page, '/templates')
  await page.goto('/practice')
  await expect(page.locator('article')).toHaveCount(27)
  expect(await shownIds(page, templates)).toEqual(templates.map((t) => t.id))
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(problems).toEqual([])
})
