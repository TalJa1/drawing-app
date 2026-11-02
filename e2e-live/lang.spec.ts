import { expect, test, type Page, type Request } from '@playwright/test'

/* Đổi ngôn ngữ khi đang đọc một bài: bộ theo dõi cuối bài (IntersectionObserver THẬT của Chromium) không được dựng
   lại, nên không có lần hoàn thành thứ hai; thưởng đến sau khi đổi ngôn ngữ được nói bằng ngôn ngữ của lúc đó. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })
const LESSON = 'rule-of-thirds'
const PASSWORD = 'long-enough-1'

let n = 0
const uniq = () => `lang-${Date.now()}-${++n}`

async function prep(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (/Failed to load resource/.test(m.text())) return
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
const completes = (seen: Request[]) =>
  seen.filter((r) => r.method() === 'POST' && /\/lessons\/[^/]+\/complete$/.test(new URL(r.url()).pathname))

async function register(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Artist name').fill(`Lan ${++n}`)
  await page.getByLabel('Email').fill(`${uniq()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page).toHaveURL(/\/practice$/)
}
async function toTheEnd(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.evaluate(() => document.querySelector('article')!.lastElementChild!.scrollIntoView({ block: 'center' }))
}
async function closeCelebration(page: Page) {
  const dialog = page.getByRole('dialog')
  const there = await dialog.waitFor({ timeout: 3_000 }).then(
    () => true,
    () => false,
  )
  if (!there) return
  await dialog.getByRole('button').last().click()
  await expect(dialog).toHaveCount(0)
}
const toVi = (page: Page) => page.getByRole('button', { name: 'Tiếng Việt' }).first().click()
const toEn = (page: Page) => page.getByRole('button', { name: 'English' }).first().click()

test.describe('đổi ngôn ngữ khi đang đọc bài', () => {
  test('cuối bài đang trong màn hình: đổi ngôn ngữ nhiều lần không hoàn thành lần hai', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    const seen = watch(page)
    const first = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/lessons\/[^/]+\/complete$/.test(new URL(r.url()).pathname),
    )
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    expect((await first).status()).toBe(200)
    await expect(page.getByText('Lesson complete!').first()).toBeVisible()
    await closeCelebration(page)
    expect(completes(seen)).toHaveLength(1)

    // the end of the lesson is still on the screen: switch the language there and back, twice
    const endInView = () =>
      page.evaluate(() => {
        const r = document.querySelector('article')!.lastElementChild!.getBoundingClientRect()
        return r.top >= 0 && r.top <= window.innerHeight
      })
    expect(await endInView()).toBe(true)
    for (let i = 0; i < 2; i++) {
      await toVi(page)
      await expect(page.getByRole('button', { name: 'Tiếng Việt' }).first()).toHaveAttribute('aria-pressed', 'true')
      await toEn(page)
      await expect(page.getByRole('button', { name: 'English' }).first()).toHaveAttribute('aria-pressed', 'true')
    }
    await page.waitForTimeout(1_500) // let any second observer fire and its request go out
    expect(await endInView()).toBe(true)
    expect(completes(seen)).toHaveLength(1)
    expect(problems).toEqual([])
  })

  test('thưởng đến sau khi đổi ngôn ngữ được nói bằng ngôn ngữ của lúc đó', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    const seen = watch(page)
    // hold the first answer of /complete until the language has been changed
    let release!: () => void
    const held = new Promise<void>((res) => (release = res))
    let first = true
    await page.route('**/api/v1/lessons/*/complete', async (route) => {
      if (!first) return route.continue()
      first = false
      await held
      return route.continue()
    })
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    await expect.poll(() => completes(seen).length).toBe(1) // asked, not answered yet
    await toVi(page)
    await expect(page.getByRole('button', { name: 'Tiếng Việt' }).first()).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(1_000)
    expect(completes(seen)).toHaveLength(1) // changing the language asked nothing more
    release()
    await expect(page.getByText('Hoàn thành bài học!').first()).toBeVisible() // said in Vietnamese
    await expect(page.getByText('Lesson complete!')).toHaveCount(0)
    await closeCelebration(page)
    expect(completes(seen)).toHaveLength(1)
    expect(problems).toEqual([])
  })
})
