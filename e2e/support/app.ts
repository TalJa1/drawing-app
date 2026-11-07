/* Shared set-up for the layout / accessibility specs (layout.spec.ts, studio.spec.ts).

   The app is opened with the back-end's responses replayed from e2e/fixtures/api/ (recorded from a real back-end by
   `npm run e2e:fixtures`), so these specs need nothing but the front-end: they run in CI and on a plain checkout.
   Set E2E_LIVE_API=1 to skip the replay and use whatever back-end the page's /api/v1 reaches instead. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

const DIR = fileURLToPath(new URL('../fixtures/api/', import.meta.url))
const read = (file: string) => readFileSync(DIR + file, 'utf8')
const MANIFEST: Record<string, string> = JSON.parse(read('manifest.json'))
const SESSION_USER = JSON.parse(read('session-user.json')) as Record<string, unknown>
const TEMPLATES = JSON.parse(read('templates.json')) as { id: string }[]

/** A 1x1 PNG: the template pictures only need to exist for the layout (the frame has its own size). */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/** Endpoints that answer 401 to a visitor who is not signed in (as the real back-end does). */
const NEEDS_SIGN_IN = /^\/(me|me\/.+|artworks|artworks\/.+|challenges|achievements|achievements\/.+|leaderboard)$/

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

export interface OpenOptions {
  signedIn?: boolean
  language?: 'vi' | 'en'
  /** true (default) hides the first-visit studio tour; false shows it */
  onboardingDone?: boolean
  /** 'reduce' (default) = animations end at once, so a measurement never catches an element mid-slide; 'full' = they play */
  motion?: 'reduce' | 'full'
  /** false (default) keeps the native pointer, so a measurement never sees the brush sprite; true turns the brush cursor on */
  customCursor?: boolean
}

/** Replays the recorded API and puts the settings / session into storage before the page's own scripts run. */
export async function prepare(
  page: Page,
  { signedIn = false, language = 'vi', onboardingDone = true, motion = 'reduce', customCursor = false }: OpenOptions = {},
) {
  const settings = {
    state: {
      theme: 'light',
      language,
      motion,
      sound: false,
      customCursor,
      drawing: { defaultTool: 'pencil', pressure: true, smoothing: 0 },
      onboardingDone,
    },
    version: 3,
  }
  const session = { state: { user: SESSION_USER, token: 'e2e-token' }, version: 2 }
  await page.addInitScript(
    ([s, sess]) => {
      // only the first document of the test sets the state: a reload keeps what the app wrote since
      if (sessionStorage.getItem('e2e-init')) return
      sessionStorage.setItem('e2e-init', '1')
      localStorage.clear()
      localStorage.setItem('artspark:settings', s)
      if (sess) localStorage.setItem('artspark:session', sess)
    },
    [JSON.stringify(settings), signedIn ? JSON.stringify(session) : null] as const,
  )
  if (process.env.E2E_LIVE_API) return

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '')
    const key = `${req.method()} ${path}`
    if (req.method() === 'GET' && /^\/templates\/[^/]+\/image$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    }
    if (NEEDS_SIGN_IN.test(path) && !signedIn) {
      return route.fulfill(json({ error: { code: 'unauthorized', message: 'Sign in first.' } }, 401))
    }
    const file = MANIFEST[key]
    if (file) return route.fulfill(json(read(file)))
    const one = /^\/templates\/([^/]+)$/.exec(path)
    if (req.method() === 'GET' && one) {
      const t = TEMPLATES.find((x) => x.id === one[1])
      if (t) return route.fulfill(json(t))
    }
    return route.fulfill(json({ error: { code: 'not_found', message: 'Not recorded in e2e/fixtures/api.' } }, 404))
  })
}

/** Opens a path and waits until the page, its lazy chunk, its data and its fonts have settled. */
export async function open(page: Page, path: string, opts?: OpenOptions) {
  await prepare(page, opts)
  await page.goto(path)
  await settle(page)
}

export async function settle(page: Page) {
  // Everything the page asks for arrives well inside 2 s (the API is answered from fixtures). Firefox sometimes never
  // reports "network idle" when four workers run at once (measured: 8 of 40 repeats of one test, none when run alone),
  // and an unbounded wait then eats the whole 60 s test timeout. So wait for idle, but not forever: the fonts and the
  // layout checks that follow are what the specs actually assert.
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(300)
}

/** The page's scrollable width against the width of the window, plus the elements that stick out (for the message). */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const client = de.clientWidth
    const scroll = Math.max(de.scrollWidth, document.body.scrollWidth)
    const sticking: string[] = []
    if (scroll > client) {
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > client + 0.5 && sticking.length < 6) {
          sticking.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 60)} right=${Math.round(r.right)}`)
        }
      }
    }
    return { scroll, client, sticking }
  })
}
