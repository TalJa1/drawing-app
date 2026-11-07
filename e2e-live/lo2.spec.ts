import { expect, test, type Page, type Request } from '@playwright/test'

/* P9 Lô 2 — content (templates, lessons, art forms, glossary, daily template) from the real API. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })
const API = process.env.E2E_API ?? '' // '' = same origin (Vite proxy); otherwise absolute origin of the backend

async function prep(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (/Failed to load resource/.test(m.text())) return // Chrome logs every non-2xx fetch
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

function watch(page: Page) {
  const seen: Request[] = []
  page.on('request', (r) => r.url().includes('/api/v1/') && seen.push(r))
  return seen
}

const get = async <T>(page: Page, path: string): Promise<T> => {
  const res = await page.request.get(`${API}/api/v1${path}`)
  expect(res.ok(), `GET ${path}`).toBe(true)
  return (await res.json()) as T
}

type Tpl = { id: string; title: { en: string }; difficulty: string; unlockLevel: number; imageUrl?: string; createdAt: string }
type Lesson = { slug: string; title: { en: string } }

test.describe('Lô 2 — nội dung qua API thật', () => {
  test('library shows the 27 server templates with their real PNGs, one daily badge, no console errors', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    const templates = await get<Tpl[]>(page, '/templates')
    const { templateId } = await get<{ templateId: string }>(page, '/challenges/daily-template')
    expect(templates).toHaveLength(27)

    await page.goto('/practice')
    await expect(page.getByText('27 templates')).toBeVisible()
    const cards = page.locator('article')
    await expect(cards).toHaveCount(27)

    // every card image is the PNG the server offers, and it really decodes
    const imgs = page.locator('article img[src*="/api/v1/templates/"]')
    await expect(imgs).toHaveCount(27)
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => [...document.querySelectorAll<HTMLImageElement>('article img')].filter((i) => i.complete && i.naturalWidth > 0).length,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0)
    for (const img of await imgs.all()) await img.scrollIntoViewIfNeeded()
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            [...document.querySelectorAll<HTMLImageElement>('article img')].every((i) => i.complete && i.naturalWidth === 1200),
          ),
        { timeout: 30_000 },
      )
      .toBe(true)

    // TemplateCard resolves the path against the API host (the page origin when the proxy is used)
    const origin = API || 'http://localhost:5199'
    expect(await imgs.first().getAttribute('src')).toMatch(new RegExp(`^${origin}/api/v1/templates/[a-z0-9-]+/image$`))

    // the daily banner is the one the server named, and exactly one card is badged "Today"
    const daily = templates.find((t) => t.id === templateId)!
    await expect(page.getByRole('link', { name: "Start today's canvas" })).toHaveAttribute('href', `/practice/${templateId}`)
    await expect(page.getByText(`Today's canvas: ${daily.title.en}`)).toBeVisible()
    await expect(page.locator('article', { hasText: daily.title.en }).locator('span', { hasText: /^Today$/ })).toHaveCount(1) // the badge sits on the named template
    await expect(page.locator('article', { hasText: 'Today' }).filter({ has: page.locator('span', { hasText: /^Today$/ }) })).toHaveCount(1)

    const listCalls = seen.filter((r) => /\/api\/v1\/templates$/.test(r.url()))
    expect(listCalls.length).toBe(1)
    const dailyCalls = seen.filter((r) => r.url().includes('/challenges/daily-template'))
    expect(dailyCalls.length).toBe(1)
    expect((await dailyCalls[0].allHeaders())['x-timezone']).toMatch(/\//)
    expect(problems).toEqual([])
  })

  test('filter by difficulty, search, sort "newest" and the empty state work on server data', async ({ page }) => {
    const problems = await prep(page)
    const templates = await get<Tpl[]>(page, '/templates')
    await page.goto('/practice')
    await expect(page.locator('article')).toHaveCount(27)

    const beginners = templates.filter((t) => t.difficulty === 'beginner').length
    await page.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Beginner', exact: true }).click()
    await expect(page.locator('article')).toHaveCount(beginners)
    await page.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Any level' }).click()
    await expect(page.locator('article')).toHaveCount(27)

    await page
      .getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first()
      .fill('fox')
    await expect(page.locator('article').first()).toContainText(/fox/i)
    await page
      .getByPlaceholder(/search/i)
      .first()
      .fill('zzzzqqq')
    await expect(page.getByText('Clear filters')).toBeVisible()
    await page.getByText('Clear filters').click()
    await expect(page.locator('article')).toHaveCount(27)

    await page.getByLabel('Sort by').selectOption('new')
    const newest = [...templates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    await expect(page.locator('article')).toHaveCount(27)
    // ties are possible (same seed date), so the first card must at least be one of the newest instants
    const top = Date.parse(newest.createdAt)
    const firstTitle = await page.locator('article h3, article h2').first().innerText()
    const first = templates.find((t) => t.title.en === firstTitle)
    expect(first, `first card "${firstTitle}" is a server template`).toBeTruthy()
    expect(Date.parse(first!.createdAt)).toBe(top)
    expect(problems).toEqual([])
  })

  test('opening an unlocked template loads it from the API and shows its PNG in the studio', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    const templates = await get<Tpl[]>(page, '/templates')
    const open = templates.find((t) => t.unlockLevel === 1)!
    await page.goto('/practice')
    await expect(page.locator('article')).toHaveCount(27)
    await page
      .getByRole('link', { name: new RegExp(open.title.en) })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/practice/${open.id}$`))
    await expect(page.getByRole('heading', { name: open.title.en }).first()).toBeVisible({ timeout: 15_000 })
    expect(seen.filter((r) => /\/api\/v1\/templates$/.test(r.url())).length).toBe(1) // list is cached, not asked again
    expect(problems).toEqual([])
  })

  test('a template that does not exist shows the not-found state (404 from the server)', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/practice/no-such-template')
    await expect(page.getByText("We couldn't find that template")).toBeVisible({ timeout: 15_000 })
    expect(problems).toEqual([])
  })

  test('lesson page: content and "next lesson" come from the server list; unknown slug shows not-found', async ({ page }) => {
    const problems = await prep(page)
    const lessons = await get<Lesson[]>(page, '/lessons')
    expect(lessons).toHaveLength(26)
    await page.goto(`/learn/lessons/${lessons[0].slug}`)
    await expect(page.getByRole('heading', { name: lessons[0].title.en }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: new RegExp(lessons[1].title.en) }).first()).toHaveAttribute(
      'href',
      `/learn/lessons/${lessons[1].slug}`,
    )

    await page.goto('/learn/lessons/no-such-lesson')
    await expect(
      page
        .getByText('This page has wandered out of the Atlas')
        .or(page.getByText(/couldn.t find/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 })
    expect(problems).toEqual([])
  })

  test('the last lesson wraps round to the first one, as it did with the mock list', async ({ page }) => {
    const problems = await prep(page)
    const lessons = await get<Lesson[]>(page, '/lessons')
    const last = lessons[lessons.length - 1]
    await page.goto(`/learn/lessons/${last.slug}`)
    await expect(page.getByRole('heading', { name: last.title.en }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: new RegExp(lessons[0].title.en) }).first()).toHaveAttribute(
      'href',
      `/learn/lessons/${lessons[0].slug}`,
    )
    expect(problems).toEqual([])
  })

  test('art-form page loads from the API; unknown slug shows not-found', async ({ page }) => {
    const problems = await prep(page)
    const forms = await get<{ slug: string; name: { en: string } }[]>(page, '/art-forms')
    expect(forms).toHaveLength(20)
    await page.goto(`/learn/art-forms/${forms[0].slug}`)
    await expect(page.getByRole('heading', { name: forms[0].name.en }).first()).toBeVisible({ timeout: 15_000 })
    await page.goto('/learn/art-forms/no-such-form')
    await expect(page.getByText(/couldn.t find|wandered out/i).first()).toBeVisible({ timeout: 15_000 })
    expect(problems).toEqual([])
  })

  test('Learn search finds lessons, art forms and glossary terms from the server data', async ({ page }) => {
    const problems = await prep(page)
    const glossary = await get<{ term: { en: string } }[]>(page, '/glossary')
    expect(glossary).toHaveLength(71)
    await page.goto('/learn')
    const box = page.getByRole('searchbox', { name: 'Search the Atlas' })
    await expect(box).toBeVisible()
    await box.fill(glossary[0].term.en.slice(0, 5))
    const list = page.getByRole('listbox', { name: 'Search results' })
    await expect(list).toBeVisible()
    await expect(list.getByRole('option').first()).toBeVisible({ timeout: 15_000 })
    await expect(list).toContainText(glossary[0].term.en)
    await box.fill('zzzzqqqq')
    await expect(page.getByText('Nothing found — try another word.')).toBeVisible()
    expect(problems).toEqual([])
  })

  test('home page renders showcase pieces from server templates, console clean', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/')
    await expect(page.locator('img[alt="Hand-coloured fox line art"], img[src^="data:image/svg"]').first()).toBeVisible({ timeout: 15_000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(800)
    expect(problems).toEqual([])
  })

  test('chat suggests a template card taken from the API', async ({ page }) => {
    const problems = await prep(page)
    const templates = await get<Tpl[]>(page, '/templates')
    await page.goto('/chat')
    await page.getByPlaceholder('Ask for ideas, colours, composition tips…').fill('give me five drawing ideas')
    await page.getByRole('button', { name: 'Send' }).click()
    const card = page.getByRole('link', { name: /Draw this/ }).first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    const href = await card.getAttribute('href')
    const id = href!.replace('/practice/', '')
    const t = templates.find((x) => x.id === id)
    expect(t, `chat card points to a server template (${id})`).toBeTruthy()
    expect(t!.difficulty).toBe('beginner')
    expect(problems).toEqual([])
  })

  test('API down: library shows the error with Try again; after recovery the cards appear; no "Today" guess', async ({ page }) => {
    const problems = await prep(page)
    let down = true
    await page.route('**/api/v1/templates', (r) => (down ? r.abort('failed') : r.continue()))
    await page.route('**/api/v1/challenges/daily-template**', (r) => (down ? r.abort('failed') : r.continue()))
    await page.goto('/practice')
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Today's canvas/)).toHaveCount(0)
    await expect(page.locator('article')).toHaveCount(0)
    down = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('article')).toHaveCount(27, { timeout: 20_000 })
    expect(problems.filter((p) => !/Failed to fetch|net::ERR/.test(p))).toEqual([])
  })

  test('daily-template alone failing: library still lists templates, nothing is highlighted as today', async ({ page }) => {
    const problems = await prep(page)
    await page.route('**/api/v1/challenges/daily-template**', (r) => r.abort('failed'))
    await page.goto('/practice')
    await expect(page.locator('article')).toHaveCount(27, { timeout: 20_000 })
    await expect(page.locator('span', { hasText: /^Today$/ })).toHaveCount(0)
    await expect(page.getByText(/Today's canvas/)).toHaveCount(0)
    expect(problems.filter((p) => !/Failed to fetch|net::ERR/.test(p))).toEqual([])
  })

  test('chat while the API is down: still answers, with ideas but no template card', async ({ page }) => {
    const problems = await prep(page)
    await page.route('**/api/v1/templates', (r) => r.abort('failed'))
    await page.goto('/chat')
    await page.getByPlaceholder('Ask for ideas, colours, composition tips…').fill('give me five drawing ideas')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Sketch it').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: /Draw this/ })).toHaveCount(0)
    expect(problems.filter((p) => !/Failed to fetch|net::ERR/.test(p))).toEqual([])
  })

  test('a daily template above the player level is still shown as today, and opens the locked screen', async ({ page }) => {
    const problems = await prep(page)
    const templates = await get<Tpl[]>(page, '/templates')
    const locked = templates.find((t) => t.unlockLevel > 1)!
    await page.route('**/api/v1/challenges/daily-template**', (r) => r.fulfill({ json: { templateId: locked.id } }))
    await page.goto('/practice')
    await expect(page.getByText(`Today's canvas: ${locked.title.en}`)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('article', { hasText: locked.title.en }).locator('span', { hasText: /^Today$/ })).toHaveCount(1)
    await expect(page.locator('span', { hasText: /^Today$/ })).toHaveCount(1)
    await page.getByRole('link', { name: "Start today's canvas" }).click()
    await expect(page.getByText(`This template unlocks at level ${locked.unlockLevel}`)).toBeVisible({ timeout: 15_000 })
    expect(problems).toEqual([])
  })

  test('a daily id the template list does not contain shows no banner and no badge (no crash)', async ({ page }) => {
    const problems = await prep(page)
    await page.route('**/api/v1/challenges/daily-template**', (r) => r.fulfill({ json: { templateId: 'ghost-template' } }))
    await page.goto('/practice')
    await expect(page.locator('article')).toHaveCount(27, { timeout: 20_000 })
    await expect(page.getByText(/Today's canvas/)).toHaveCount(0)
    await expect(page.locator('span', { hasText: /^Today$/ })).toHaveCount(0)
    expect(problems).toEqual([])
  })
})
