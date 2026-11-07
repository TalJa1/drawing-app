import { expect, test, type Page, type Request } from '@playwright/test'

/* P9 Lô 3 (+ phần chấm điểm của Lô 4) — tranh và ảnh qua API thật: khách → đăng nhập → quay lại,
   lưu tranh tự do (reward từ server), thư viện + ảnh có Bearer, chấm điểm bởi server, đổi tài khoản. */

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

let n = 0
const uniq = () => `lo3-${Date.now()}-${++n}`

async function signUpOnPage(page: Page, name = 'Lan') {
  const email = `${uniq()}@example.com`
  await page.getByLabel('Artist name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('long-enough-1')
  await page.getByLabel('Confirm password').fill('long-enough-1')
  await page.getByRole('button', { name: /create account/i }).click()
  return email
}

const tokenOf = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('artspark:session') ?? '{}') as { state?: { token?: string } }).state?.token ?? null)

async function api<T>(page: Page, path: string): Promise<T> {
  const token = await tokenOf(page)
  const res = await page.request.get(`${API}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } })
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBe(true)
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

type Art = { id: string; kind: string; title: string; imageKey: string; thumbKey: string; favourite: boolean; score?: { overall: number } }
type Progress = { xp: number; badges: Record<string, string>; stats: { artworks: number; freeDraws: number; downloads: number } }

test.describe('Lô 3 — tranh & ảnh qua API thật', () => {
  test('a guest asking for the collection is sent to sign in and brought back; it starts empty', async ({ page }) => {
    const problems = await prep(page)
    await page.goto('/collection')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(/Your artworks are kept in your account/)).toBeVisible()
    await page.getByRole('link', { name: /create account/i }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByText(/Your artworks are kept in your account/)).toBeVisible() // the reason survives the switch
    await signUpOnPage(page)
    await expect(page).toHaveURL(/\/collection$/)
    await expect(page.getByText('Every masterpiece begins with one brave line.')).toBeVisible()
    expect(await api<Art[]>(page, '/artworks?limit=500')).toEqual([])
    expect(problems).toEqual([])
  })

  test('free drawing: guest saves → sign in → back → restores the draft → saves; the server pays; the picture loads with the token', async ({
    page,
  }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/free-draw')
    await scribble(page)
    await page.getByRole('button', { name: 'Save to collection' }).click()
    await expect(page).toHaveURL(/\/login$/) // a guest has no account to save to: sign in first
    await expect(page.getByText(/Your artworks are kept in your account/)).toBeVisible()
    await page.getByRole('link', { name: /create account/i }).click()
    await signUpOnPage(page)
    await expect(page).toHaveURL(/\/free-draw$/) // ... and come back to the page they were on
    // the drawing they left is offered back (the draft was saved before leaving)
    await expect(page.getByText('Welcome back!')).toBeVisible()
    await page.getByRole('button', { name: 'Continue drawing' }).click()

    await page.getByRole('button', { name: 'Save to collection' }).click()
    const dialog = page.getByRole('dialog', { name: 'Name your artwork' })
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Dawn over the hills')
    await dialog.getByRole('button', { name: 'Save to collection' }).click()
    await expect(page.getByText('Saved to your collection')).toBeVisible()

    const post = seen.find((r) => r.method() === 'POST' && /\/artworks$/.test(r.url()))!
    expect(post.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
    const list = await api<Art[]>(page, '/artworks?limit=500')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ kind: 'free', title: 'Dawn over the hills', favourite: false })
    expect(list[0].imageKey).toBe(`/api/v1/artworks/${list[0].id}/image`)

    // the XP on screen is the account's XP, counted once
    const p = await api<Progress>(page, '/me/progress')
    expect(p.stats).toMatchObject({ artworks: 1, freeDraws: 1 })
    const local = await page.evaluate(
      () => (JSON.parse(localStorage.getItem('artspark:progress') ?? '{}') as { state?: { xp?: number } }).state?.xp,
    )
    expect(local).toBe(p.xp)
    expect(p.xp).toBeGreaterThan(0)

    // the gallery shows it, and its picture arrives (fetched with the bearer token, shown from a blob: URL)
    await page.goto('/collection')
    const img = page.getByRole('img', { name: 'Dawn over the hills' }).first()
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    expect(await img.getAttribute('src')).toMatch(/^blob:/)
    const thumbReq = seen.find((r) => r.url().endsWith(`/artworks/${list[0].id}/thumb`))!
    expect(thumbReq.headers()['authorization']).toMatch(/^Bearer /)
    // and what the browser was given is the real JPEG the app made
    const thumb = await page.request.get(`${API}/api/v1/artworks/${list[0].id}/thumb`, {
      headers: { Authorization: `Bearer ${await tokenOf(page)}` },
    })
    expect(thumb.headers()['content-type']).toMatch(/image\/jpeg/)
    expect(problems).toEqual([])
  })

  test('practice: the server judges what was saved and pays; the result page shows the server score', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await signUpOnPage(page)
    await expect(page).toHaveURL(/\/practice$/) // no remembered page: a new account starts at the practice list (as before)
    await page.goto('/practice/fox')
    await scribble(page)
    await page.getByRole('button', { name: /Submit to AI Judge/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Ready for the judge?' })
    await dialog.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(/\/practice\/result\/[0-9a-f-]{36}$/, { timeout: 30_000 })

    const [art] = await api<Art[]>(page, '/artworks?limit=500')
    expect(art).toMatchObject({ kind: 'practice' })
    expect(typeof art.score?.overall).toBe('number')
    await expect(page.getByText(String(art.score!.overall), { exact: true }).first()).toBeVisible()
    // the saved picture is shown on the result page (fetched with the token, held while shown)
    await expect
      .poll(() => page.evaluate(() => [...document.images].some((i) => i.src.startsWith('blob:') && i.naturalWidth > 0)), {
        timeout: 15_000,
      })
      .toBe(true)

    // one upload, one scoring, then the numbers refreshed: nothing was judged or paid on the device
    const posts = seen
      .filter((r) => r.method() === 'POST' && !r.url().includes('/auth/'))
      .map((r) =>
        r
          .url()
          .replace(/^.*\/api\/v1/, '')
          .replace(/[0-9a-f-]{36}/, ':id'),
      )
    expect(posts).toEqual(['/artworks', '/artworks/:id/score'])
    const p = await api<Progress>(page, '/me/progress')
    const local = await page.evaluate(
      () => (JSON.parse(localStorage.getItem('artspark:progress') ?? '{}') as { state?: { xp?: number } }).state?.xp,
    )
    expect(p.xp).toBeGreaterThan(0)
    expect(local).toBe(p.xp)
    expect(problems).toEqual([])
  })

  test('a guest who wants to be judged is sent to sign in and comes back to the same template', async ({ page }) => {
    await prep(page)
    await page.goto('/practice/fox')
    await scribble(page)
    await page.getByRole('button', { name: /Submit to AI Judge/ }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('link', { name: /create account/i }).click()
    await signUpOnPage(page)
    await expect(page).toHaveURL(/\/practice\/fox$/)
    await expect(page.getByText('Welcome back!')).toBeVisible() // the painting is offered back
  })

  test('the gallery: favourite, download, delete work on the account; the next person on this browser sees none of it', async ({
    page,
  }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Alice')
    await page.waitForURL(/\/practice$/)
    const upload = (title: string, shade: number) =>
      page.evaluate(
        async ({ title, shade }) => {
          const token = (JSON.parse(localStorage.getItem('artspark:session')!) as { state: { token: string } }).state.token
          const c = document.createElement('canvas')
          c.width = 400
          c.height = 300
          const x = c.getContext('2d')!
          x.fillStyle = `rgb(${shade},120,200)`
          x.fillRect(0, 0, 400, 300)
          x.fillStyle = '#222'
          x.fillRect(40 + shade, 40, 120, 90)
          const blob = (t: string) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), t, 0.86))
          const f = new FormData()
          f.append('image', await blob('image/png'), 'a.png')
          f.append('thumbnail', await blob('image/jpeg'), 't.jpg')
          f.append('meta', JSON.stringify({ kind: 'free', title, width: 400, height: 300, timeSpent: 30, medium: 'Digital' }))
          const r = await fetch('/api/v1/artworks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: f })
          return r.status
        },
        { title, shade },
      )
    expect(await upload('Alice one', 10)).toBe(201)
    expect(await upload('Alice two', 90)).toBe(201)

    await page.goto('/collection')
    await expect(page.getByRole('button', { name: 'Open Alice one' })).toBeVisible()
    await page.getByRole('button', { name: 'Open Alice one' }).click()
    const lightbox = page.getByRole('dialog')

    // favourite (PATCH)
    await lightbox.getByRole('button', { name: 'Add to favourites' }).click()
    await expect(lightbox.getByRole('button', { name: 'In favourites' })).toBeVisible()
    expect((await api<Art[]>(page, '/artworks?limit=500')).find((a) => a.title === 'Alice one')!.favourite).toBe(true)

    // download: the file is the full PNG, fetched with the token; the server counts it once
    const [download] = await Promise.all([page.waitForEvent('download'), lightbox.getByRole('button', { name: 'Download' }).click()])
    expect(download.suggestedFilename()).toMatch(/^art-spark-alice-one\.png$/)
    await expect.poll(async () => (await api<Progress>(page, '/me/progress')).stats.downloads).toBe(1)
    expect(seen.some((r) => r.method() === 'POST' && r.url().endsWith('/progress/events') && r.postData() === '{"type":"download"}')).toBe(
      true,
    )

    // delete (DELETE 204)
    await lightbox.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog', { name: 'Delete this artwork?' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Artwork deleted')).toBeVisible()
    // both dialogs are gone and the page scrolls again (the lock must not outlive the dialogs)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
    await expect.poll(async () => (await api<Art[]>(page, '/artworks?limit=500')).map((a) => a.title)).toEqual(['Alice two'])

    // sign out; a different person registers on the same browser: nothing of Alice's is in sight
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/collection')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('link', { name: /create account/i }).click()
    await signUpOnPage(page, 'Bob')
    await expect(page).toHaveURL(/\/collection$/)
    await expect(page.getByText('Every masterpiece begins with one brave line.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Open Alice/ })).toHaveCount(0)
    expect(await api<Art[]>(page, '/artworks?limit=500')).toEqual([])
    expect(problems).toEqual([])
  })
  test('a big collection: thumbnails are fetched only near the screen, and a picture already seen is not fetched twice', async ({
    page,
  }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto('/register')
    await signUpOnPage(page, 'Carla')
    await page.waitForURL(/\/practice$/)
    const TOTAL = 36
    const statuses = await page.evaluate(async (total) => {
      const token = (JSON.parse(localStorage.getItem('artspark:session')!) as { state: { token: string } }).state.token
      const out: number[] = []
      for (let i = 0; i < total; i++) {
        const c = document.createElement('canvas')
        c.width = 400
        c.height = 300
        const x = c.getContext('2d')!
        x.fillStyle = `rgb(${(i * 7) % 255},${(i * 13) % 255},200)`
        x.fillRect(0, 0, 400, 300)
        x.fillStyle = '#222'
        x.fillRect(10 + i * 8, 40, 60, 90) // a different picture every time (the server refuses to store the same PNG twice)
        const blob = (t: string) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), t, 0.86))
        const f = new FormData()
        f.append('image', await blob('image/png'), 'a.png')
        f.append('thumbnail', await blob('image/jpeg'), 't.jpg')
        f.append('meta', JSON.stringify({ kind: 'free', title: `Piece ${i}`, width: 400, height: 300, timeSpent: 30, medium: 'Digital' }))
        const r = await fetch('/api/v1/artworks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: f })
        out.push(r.status)
      }
      return out
    }, TOTAL)
    expect(statuses.every((s) => s === 201)).toBe(true)

    // count the live object URLs the page holds (made minus let go of)
    await page.addInitScript(() => {
      const w = window as unknown as { __urls: Set<string> }
      w.__urls = new Set()
      const make = URL.createObjectURL.bind(URL)
      const drop = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = (o: Blob | MediaSource) => {
        const u = make(o)
        w.__urls.add(u)
        return u
      }
      URL.revokeObjectURL = (u: string) => {
        w.__urls.delete(u)
        drop(u)
      }
    })
    const thumbs = () => seen.filter((r) => /\/artworks\/[0-9a-f-]+\/thumb$/.test(r.url())).length
    const live = () => page.evaluate(() => (window as unknown as { __urls: Set<string> }).__urls.size)

    await page.goto('/collection')
    await expect(page.getByRole('button', { name: 'Open Piece 0' })).toBeVisible()
    await page.waitForTimeout(1500)
    const firstScreen = thumbs()
    expect(firstScreen).toBeGreaterThan(0)
    expect(firstScreen).toBeLessThan(TOTAL) // not all 36 at once
    expect(await live()).toBe(firstScreen)

    // scroll to the bottom in steps: the rest are fetched as they come near
    for (let y = 0; y <= 12000; y += 600) {
      await page.mouse.wheel(0, 600)
      await page.waitForTimeout(120)
    }
    await expect.poll(thumbs, { timeout: 15_000 }).toBe(TOTAL)
    const afterScroll = thumbs()

    // scroll back to the top: every picture is already held, so nothing is fetched again
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1200)
    expect(thumbs()).toBe(afterScroll)
    expect(await page.locator('img[alt^="Piece"]').count()).toBeGreaterThan(0)
    for (const img of await page.locator('img[alt^="Piece"]').all()) {
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    }
    // the chat's "attach an image" picker shows the first 16 through the same component
    await page.goto('/chat')
    await page.getByRole('button', { name: 'Attach an image' }).click()
    const picker = page.getByRole('dialog', { name: 'Share an image with the muse' })
    await expect(picker.locator('img[alt^="Piece"]')).toHaveCount(16, { timeout: 15_000 })
    for (const img of await picker.locator('img[alt^="Piece"]').all()) {
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    }
    expect(problems).toEqual([])
  })
})
