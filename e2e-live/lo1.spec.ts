import { expect, test, type Page, type Request } from '@playwright/test'

const uniq = Date.now().toString(36)
const EMAIL = `pw_${uniq}@example.com`
const PASS = 'correct-horse-9'
const NAME = `Pw Artist ${uniq}`.slice(0, 40)

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })

async function prep(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // Chrome logs every non-2xx fetch as a console error; those are the expected 401/409 of this script
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

type Sess = { user: { isGuest: boolean; email?: string; displayName: string }; token: string | null }
// zustand/persist writes the key only after the first state change, so "no key" = untouched guest
const session = (page: Page) =>
  page.evaluate((): Sess => {
    const raw = localStorage.getItem('artspark:session')
    return raw ? JSON.parse(raw).state : { user: { isGuest: true, displayName: '(untouched guest)' }, token: null }
  })

function watch(page: Page) {
  const seen: Request[] = []
  page.on('request', (r) => r.url().includes('/api/v1/') && seen.push(r))
  return seen
}

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
}

test.describe.serial('Lô 1 — tài khoản qua API thật', () => {
  test('register in the browser: headers, JWT stored, navbar shows the name', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await page.getByLabel('Artist name').fill(NAME)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(PASS)
    await page.getByLabel('Confirm password').fill(PASS)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).not.toHaveURL(/\/register/)

    const req = seen.find((r) => r.url().endsWith('/auth/register') && r.method() === 'POST')!
    expect(req, 'POST /auth/register was sent').toBeTruthy()
    const h = await req.allHeaders()
    expect(h['x-timezone']).toMatch(/\//)
    expect(h['x-request-id']).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
    expect(h['authorization']).toBeUndefined()
    const res = await req.response()
    expect(res!.status()).toBe(201)
    expect(res!.headers()['x-request-id']).toBe(h['x-request-id'])

    const s = await session(page)
    expect(s.user.isGuest).toBe(false)
    expect(s.user.email).toBe(EMAIL)
    expect(s.token).toMatch(/^eyJ/)
    await openAccountMenu(page)
    await expect(page.getByRole('menu')).toContainText(NAME)
    await expect(page.getByRole('menu')).toContainText(EMAIL)
    expect(problems).toEqual([])
  })

  test('duplicate email → translated message, stays on the form', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/register')
    await page.getByLabel('Artist name').fill('Someone Else')
    await page.getByLabel('Email').fill(EMAIL.toUpperCase())
    await page.getByLabel('Password', { exact: true }).fill(PASS)
    await page.getByLabel('Confirm password').fill(PASS)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toContainText('already registered')
    await expect(page).toHaveURL(/\/register/)
    expect((await session(page)).token).toBeNull()
    expect(problems).toEqual([])
  })

  test('login: wrong password then right password, then reload keeps the session', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText("don't match")
    await expect(page).toHaveURL(/\/login/)
    expect((await session(page)).token).toBeNull()

    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/collection/)
    const logins = seen.filter((r) => r.url().endsWith('/auth/login'))
    expect(logins.length).toBe(2)
    expect((await logins[0].response())!.status()).toBe(401)
    expect((await logins[1].response())!.status()).toBe(200)
    const s = await session(page)
    expect(s.user.displayName).toBe(NAME)
    expect(s.token).toMatch(/^eyJ/)

    await page.reload()
    await openAccountMenu(page)
    await expect(page.getByRole('menu')).toContainText(EMAIL)
    expect(problems).toEqual([])
  })

  test('client-side validation: password shorter than 8 never reaches the server', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('at least 8 characters')).toBeVisible()
    expect(seen.filter((r) => r.url().endsWith('/auth/login'))).toHaveLength(0)
    expect(problems).toEqual([])
  })

  test('server unreachable → "Can\'t reach the server" message', async ({ page }) => {
    const problems = await prep(page)
    await page.route('**/api/v1/auth/login', (r) => r.abort('connectionrefused'))
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText("Can't reach the server")
    expect(problems).toEqual([])
  })

  test('profile: PATCH /me with Bearer, value persists on the server and after reload', async ({ page, request, baseURL }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/collection/)
    const token = (await session(page)).token!

    await page.goto('/profile')
    const newName = 'Renamed ' + uniq.slice(-4)
    await page.getByLabel('Display name').fill(newName)
    await page.getByRole('button', { name: 'Save profile' }).click()
    await expect(page.getByText('Profile saved')).toBeVisible()

    const patch = seen.find((r) => r.method() === 'PATCH' && r.url().endsWith('/me'))!
    expect(patch, 'PATCH /me was sent').toBeTruthy()
    expect((await patch.allHeaders())['authorization']).toBe('Bearer ' + token)
    expect((await patch.response())!.status()).toBe(200)

    // independent confirmation straight from the server (no browser state involved)
    const api = process.env.E2E_API ?? `${baseURL}/api/v1`
    const me = await request.get(`${api}/me`, { headers: { Authorization: 'Bearer ' + token } })
    expect(me.status()).toBe(200)
    expect((await me.json()).displayName).toBe(newName)

    await page.reload()
    expect((await session(page)).user.displayName).toBe(newName)
    expect(problems).toEqual([])
  })

  test('sign out via the account menu: POST /auth/logout 204, back to guest', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/collection/)
    await openAccountMenu(page)
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
    const out = seen.find((r) => r.url().endsWith('/auth/logout'))!
    expect(out, 'POST /auth/logout was sent').toBeTruthy()
    expect((await out.response())!.status()).toBe(204)
    const s = await session(page)
    expect(s.token).toBeNull()
    expect(s.user.isGuest).toBe(true)
    expect(problems).toEqual([])
  })

  test('expired/garbage token → next request returns 401 and the app signs out by itself', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/collection/)
    // tamper with the stored token, then reload so the store picks it up
    await page.evaluate(() => {
      const k = 'artspark:session'
      const v = JSON.parse(localStorage.getItem(k)!)
      v.state.token = 'garbage.token.value'
      localStorage.setItem(k, JSON.stringify(v))
    })
    // since lot 4c the app asks for the account's state as soon as it opens: that first request already gets the 401
    const refused = page.waitForResponse((r) => r.url().includes('/api/v1/me/') && r.request().method() === 'GET' && r.status() === 401)
    await page.reload()
    expect((await refused).request().headers().authorization).toBe('Bearer garbage.token.value')
    await expect.poll(async () => (await session(page)).token).toBeNull()
    expect((await session(page)).user.isGuest).toBe(true)
    expect(problems).toEqual([])
  })
})
