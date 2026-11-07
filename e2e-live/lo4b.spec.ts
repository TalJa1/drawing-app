import { expect, test, type Page, type Request } from '@playwright/test'

/* P9 Lô 4b — thử thách, thành tích, bảng xếp hạng và GET /me qua API thật:
   khách → đăng nhập → quay lại Thành tích; lưu tranh làm tiến độ thử thách nhích; nhận thưởng đúng một lần;
   bảng xếp hạng chỉ có mình; sự kiện loại B gửi lên server (chat thì không); GET /me khi mở app; đổi tài khoản. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })
const API = process.env.E2E_API ?? '' // '' = same origin (Vite proxy)

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
const path = (r: Request) => new URL(r.url()).pathname.replace('/api/v1', '') + new URL(r.url()).search
const calls = (seen: Request[], method: string, re: RegExp) => seen.filter((r) => r.method() === method && re.test(path(r)))

let n = 0
const uniq = () => `lo4b-${Date.now()}-${++n}`

async function signUpOnPage(page: Page, name = 'Lan') {
  const email = `${uniq()}@example.com`
  await page.getByLabel('Artist name').fill(`${name} ${n}`) // unique: the database is shared by all the tests of a run
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('long-enough-1')
  await page.getByLabel('Confirm password').fill('long-enough-1')
  await page.getByRole('button', { name: /create account/i }).click()
  return email
}

const tokenOf = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('artspark:session') ?? '{}') as { state?: { token?: string } }).state?.token ?? null)

async function api<T>(page: Page, p: string): Promise<T> {
  const token = await tokenOf(page)
  const res = await page.request.get(`${API}/api/v1${p}`, { headers: { Authorization: `Bearer ${token}` } })
  expect(res.ok(), `GET ${p} -> ${res.status()}`).toBe(true)
  return (await res.json()) as T
}

async function scribble(page: Page) {
  const box = (await page.locator('canvas').first().boundingBox())!
  for (let i = 0; i < 4; i++) {
    const y = box.y + 80 + i * 70
    await page.mouse.move(box.x + 100, y)
    await page.mouse.down()
    await page.mouse.move(box.x + 300, y + 40, { steps: 8 })
    await page.mouse.move(box.x + 520, y - 20, { steps: 8 })
    await page.mouse.up()
  }
  await page.waitForTimeout(400)
}

async function saveFreeDrawing(page: Page, title: string) {
  await page.goto('/free-draw')
  await scribble(page)
  await page.getByRole('button', { name: 'Save to collection' }).click()
  const dialog = page.getByRole('dialog', { name: 'Name your artwork' })
  await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
  await dialog.getByRole('button', { name: 'Save to collection' }).click()
  await expect(page.getByText('Saved to your collection')).toBeVisible()
}

type Status = {
  challenge: { id: string; title: { en: string }; target: number; xp: number }
  periodKey: string
  progress: number
  claimed: boolean
}
type Row = { id: string; name: string; isCurrentUser?: boolean; xp: number; weeklyXp: number }
type Progress = { xp: number; stats: Record<string, unknown> }
/** The server offers ONE daily challenge a day (it rotates). These tests need `d-free`: start the live server with
 *  LIVE_NOW=<a day when it is the daily> (see live_lo3_server.py), otherwise the test says so and is skipped. */
const byId = (list: Status[], id: string): Status => {
  const found = list.find((s) => s.challenge.id === id)
  test.skip(!found, `${id} is not on today's list (${list.map((s) => s.challenge.id).join(', ')}): set LIVE_NOW on a day it is`)
  return found!
}
const card = (page: Page, title: string) => page.locator('article', { has: page.getByRole('heading', { name: title }) })

test.describe('Lô 4b — thử thách, thành tích, bảng xếp hạng, GET /me', () => {
  test('a guest is sent to sign in and brought back to Achievements; real data, no sample users', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/achievements')
    await expect(page).toHaveURL(/\/login$/)
    expect(calls(seen, 'GET', /^\/(challenges|achievements|leaderboard)/)).toHaveLength(0) // a guest asks nothing
    await page.getByRole('link', { name: /create account/i }).click()
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/achievements$/) // brought back to the page they wanted

    const list = await api<Status[]>(page, '/challenges')
    const free = byId(list, 'd-free')
    await expect(card(page, free.challenge.title.en)).toBeVisible()
    await expect(card(page, free.challenge.title.en).getByRole('button', { name: 'In progress' })).toBeDisabled()

    // the leaderboard is the server's: real people only, the person asking always on it, no "fictional sample users" note
    const board = page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Leaderboard' }) })
    const rows = await api<Row[]>(page, '/leaderboard?scope=weekly')
    await expect(board.getByRole('listitem')).toHaveCount(rows.length)
    const me = rows.find((r) => r.isCurrentUser)!
    expect(me).toBeTruthy()
    await expect(board.getByRole('listitem').filter({ hasText: me.name })).toHaveAttribute('aria-current', 'true')
    await expect(board.getByRole('listitem').filter({ hasText: me.name })).toContainText(me.id) // the real rank, as the server gives it
    // "you are the only one so far" exactly when the list is only me
    await expect(board.getByText(/the only one on the board so far/)).toHaveCount(rows.length === 1 ? 1 : 0)
    await expect(page.getByText(/fictional sample users/i)).toHaveCount(0)
    await expect(board.getByText(/fictional|sample/i)).toHaveCount(0)

    // the badge wall comes from the server too
    await expect(page.getByText(/\d+ of \d+ unlocked/)).toBeVisible()
    expect(problems).toEqual([])
  })

  test('opening the app signed in asks GET /me once, and a profile changed elsewhere shows up', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    // changed on "another device": straight on the server
    const token = await tokenOf(page)
    const patch = await page.request.patch(`${API}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { displayName: 'Lan Anh' },
    })
    expect(patch.ok()).toBe(true)

    const seen = watch(page)
    await page.reload() // "opening the app"
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(page.getByRole('menu').getByText('Lan Anh')).toBeVisible()
    // once when the app is open; React.StrictMode runs effects twice in the dev server only (E2E_PROD=1: built app)
    const asked = calls(seen, 'GET', /^\/me$/).length
    expect(asked).toBeGreaterThanOrEqual(1)
    expect(asked).toBeLessThanOrEqual(process.env.E2E_PROD ? 1 : 2)
    expect(problems).toEqual([])
  })

  test('opening the app signed in brings the account’s numbers: a reward earned elsewhere shows up', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    const xpOnDevice = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('artspark:progress') ?? '{"state":{"xp":-1}}').state.xp as number)
    expect(await xpOnDevice()).toBe(0)
    // earned on "another device": straight on the server
    const token = await tokenOf(page)
    const done = await page.request.post(`${API}/api/v1/lessons/rule-of-thirds/complete`, { headers: { Authorization: `Bearer ${token}` } })
    expect(done.ok()).toBe(true)
    const onServer = (await api<Progress>(page, '/me/progress')).xp
    expect(onServer).toBeGreaterThan(0)
    expect(await xpOnDevice()).toBe(0) // this device has not heard of it yet

    const seen = watch(page)
    await page.reload() // "opening the app"
    await expect.poll(xpOnDevice).toBe(onServer)
    expect(calls(seen, 'GET', /^\/me\/progress$/).length).toBeGreaterThanOrEqual(1)
    expect(problems).toEqual([])
  })

  test('saving a drawing moves the challenge; claiming pays once and the XP on screen is the account’s', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    const before = byId(await api<Status[]>(page, '/challenges'), 'd-free')
    expect(before.progress).toBe(0)
    const xp0 = (await api<Progress>(page, '/me/progress')).xp

    await saveFreeDrawing(page, 'Dawn over the hills')
    const afterSave = await api<Status[]>(page, '/challenges')
    expect(byId(afterSave, 'd-free').progress).toBe(1)

    await page.goto('/achievements')
    const mine = card(page, before.challenge.title.en)
    await expect(mine.getByText(`1 / ${before.challenge.target}`)).toBeVisible()
    const xpAfterSave = (await api<Progress>(page, '/me/progress')).xp
    expect(xpAfterSave).toBeGreaterThan(xp0)

    await mine.getByRole('button', { name: 'Claim reward' }).click()
    await expect(page.getByText(`+${before.challenge.xp} XP claimed!`)).toBeVisible()
    await expect(mine.getByText('Claimed')).toBeVisible()
    await expect(mine.getByRole('button', { name: 'Claim reward' })).toHaveCount(0)

    const claims = calls(seen, 'POST', /\/challenges\/d-free\/claim$/)
    expect(claims).toHaveLength(1)
    expect(claims[0].postDataJSON()).toEqual({ periodKey: before.periodKey })
    const p = await api<Progress>(page, '/me/progress')
    expect(p.xp).toBe(xpAfterSave + before.challenge.xp)
    const local = await page.evaluate(
      () => (JSON.parse(localStorage.getItem('artspark:progress') ?? '{}') as { state?: { xp?: number } }).state?.xp,
    )
    expect(local).toBe(p.xp) // what the app shows is the account's number, not a second count
    expect(byId(await api<Status[]>(page, '/challenges'), 'd-free').claimed).toBe(true)

    // a second claim (another tab, a double click that got through) is refused and told in plain words
    const token = await tokenOf(page)
    const again = await page.request.post(`${API}/api/v1/challenges/d-free/claim`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { periodKey: before.periodKey },
    })
    expect(again.status()).toBe(409)
    expect((await api<Progress>(page, '/me/progress')).xp).toBe(p.xp) // nothing paid twice
    expect(problems).toEqual([])
  })

  test('a stale page: the reward was taken elsewhere, the server refuses (409) and the page says so and catches up', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    await saveFreeDrawing(page, 'Stale page drawing')
    await page.goto('/achievements')
    const st = byId(await api<Status[]>(page, '/challenges'), 'd-free')
    const mine = card(page, st.challenge.title.en)
    const claimButton = mine.getByRole('button', { name: 'Claim reward' })
    await expect(claimButton).toBeEnabled()

    // "another device" takes the reward while this page still shows the button
    const token = await tokenOf(page)
    const taken = await page.request.post(`${API}/api/v1/challenges/d-free/claim`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { periodKey: st.periodKey },
    })
    expect(taken.status()).toBe(200)

    await claimButton.click()
    await expect(page.getByText("You've already claimed this reward.")).toBeVisible() // our words, not the server's English
    await expect(mine.getByText('Claimed')).toBeVisible() // and the page caught up by itself
    await expect(mine.getByRole('button', { name: 'Claim reward' })).toHaveCount(0)
    expect(problems).toEqual([])
  })

  test('an unfinished challenge cannot be claimed: the button is off, and the server says 422 if asked anyway', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    await page.goto('/achievements')
    const st = byId(await api<Status[]>(page, '/challenges'), 'd-free')
    await expect(card(page, st.challenge.title.en).getByRole('button', { name: 'In progress' })).toBeDisabled()
    const res = await page.request.post(`${API}/api/v1/challenges/d-free/claim`, {
      headers: { Authorization: `Bearer ${await tokenOf(page)}` },
      data: { periodKey: st.periodKey },
    })
    expect(res.status()).toBe(422)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('incomplete')
    expect(problems).toEqual([])
  })

  test('what only the browser can witness is counted by the server (a viewed page); chat is not sent', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)

    await page.goto('/learn/movements/cubism')
    await expect.poll(() => calls(seen, 'POST', /^\/progress\/events$/).length, { timeout: 10_000 }).toBe(1)
    const sent = calls(seen, 'POST', /^\/progress\/events$/)[0].postDataJSON()
    expect(sent).toEqual({ type: 'viewed', what: 'movement', slug: 'cubism' }) // exactly as shaped, no xp
    await expect
      .poll(async () => (await api<{ stats: { movementsViewed: string[] } }>(page, '/me/progress')).stats.movementsViewed)
      .toContain('cubism')

    // chat is outside the backend: the message is counted on this device only, never sent
    await page.goto('/chat')
    const box = page.getByPlaceholder('Ask for ideas, colours, composition tips…')
    await box.fill('Hello Muse')
    await box.press('Enter')
    await expect(page.getByText('Hello Muse').first()).toBeVisible()
    await page.waitForTimeout(1500)
    const chatEvents = calls(seen, 'POST', /^\/progress\/events$/).filter(
      (r) => (r.postDataJSON() as { type: string }).type === 'chatMessage',
    )
    expect(chatEvents).toHaveLength(0)
    expect(problems).toEqual([])
  })

  test('another account on the same browser never sees the first one’s challenges or ranking', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    const firstName = (await api<{ displayName: string }>(page, '/me')).displayName
    await saveFreeDrawing(page, 'First account drawing')
    await page.goto('/achievements')
    const title = byId(await api<Status[]>(page, '/challenges'), 'd-free').challenge.title.en
    await expect(card(page, title).getByText('1 / 1')).toBeVisible()

    // sign out through the menu, then a brand-new account
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page.getByText(/Signed out/)).toBeVisible()
    await page.goto('/achievements')
    await expect(page).toHaveURL(/\/login$/) // signed out: locked again
    await page.getByRole('link', { name: /create account/i }).click()
    await signUpOnPage(page, 'Minh')
    await expect(page).toHaveURL(/\/achievements$/)
    await expect(card(page, title).getByText('0 / 1')).toBeVisible()
    // the ranking has real people only: the first account (it earned XP, so it is on it) and this one (always shown to its owner)
    const board = page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Leaderboard' }) })
    const rows = await api<Row[]>(page, '/leaderboard?scope=weekly')
    await expect(board.getByRole('listitem')).toHaveCount(rows.length)
    expect(rows.filter((r) => r.isCurrentUser)).toHaveLength(1)
    const mineRow = board.getByRole('listitem').filter({ hasText: rows.find((r) => r.isCurrentUser)!.name })
    await expect(mineRow).toHaveAttribute('aria-current', 'true')
    await expect(board.locator('[aria-current="true"]')).toHaveCount(1) // only me is marked "you"
    await expect(board.getByText(firstName)).toHaveCount(1) // the first account is a person on the board, not mine
    await expect(board.getByText(/the only one on the board so far/)).toHaveCount(0)
    expect(problems).toEqual([])
  })
})
