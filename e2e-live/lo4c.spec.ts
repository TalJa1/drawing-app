import { expect, test, type Page, type Request } from '@playwright/test'

/* P9 Lô 4c — học tập qua API thật: tiến độ đọc, hoàn thành bài, quiz chấm ở server, bookmark, flashcard (hộp/hạn do
   server tính), tải học tập khi mở app, đổi tài khoản; khách giữ mọi thứ trên máy. */

const settings = JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 })
const API = process.env.E2E_API ?? '' // '' = same origin (Vite proxy)
const LESSON = 'rule-of-thirds'
const PASSWORD = 'long-enough-1'

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
const uniq = () => `lo4c-${Date.now()}-${++n}`

async function signUpOnPage(page: Page, name = 'Lan') {
  const email = `${uniq()}@example.com`
  await page.getByLabel('Artist name').fill(`${name} ${n}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  return email
}
async function register(page: Page, name = 'Lan') {
  await page.goto('/register')
  const email = await signUpOnPage(page, name)
  await expect(page).toHaveURL(/\/practice$/)
  return email
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByText(/Signed out/)).toBeVisible()
}

const tokenOf = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('artspark:session') ?? '{}') as { state?: { token?: string } }).state?.token ?? null)
async function api<T>(page: Page, p: string): Promise<T> {
  const token = await tokenOf(page)
  const res = await page.request.get(`${API}/api/v1${p}`, { headers: { Authorization: `Bearer ${token}` } })
  expect(res.ok(), `GET ${p} -> ${res.status()}`).toBe(true)
  return (await res.json()) as T
}
type Learning = {
  lessons: Record<string, { progress: number; completed: boolean; quizBest: number; quizPassed: boolean; lastOpened: string | null }>
  bookmarks: string[]
  lastLesson: string | null
  flashcards: Record<string, { box: number; due: string }>
  spotBest: number
  serverTime: string
}
const learning = (page: Page) => api<Learning>(page, '/me/learning')
const xpOf = async (page: Page) => (await api<{ xp: number }>(page, '/me/progress')).xp
const local = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('artspark:learn') ?? '{"state":{}}').state as {
        bookmarks?: string[]
        lessons?: Record<string, { completed?: boolean }>
        flashcards?: Record<string, { box: number; due: number }>
      },
  )

/**
 * the lesson has loaded (the end of it exists), then scroll to the end of the reading: the marker after the last
 * section. (Jumping to the bottom of the page is not the same: the try-it and quiz blocks below the article are taller
 * than the window, so the marker may only be passed during the smooth scroll and be missed when the machine is busy.)
 */
async function toTheEnd(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.evaluate(() => document.querySelector('article')!.lastElementChild!.scrollIntoView({ block: 'center' }))
}
/** a badge or level-up dialog may open after a reward; it covers the page until it is closed */
async function closeCelebration(page: Page) {
  const dialog = page.getByRole('dialog')
  if (
    !(await dialog.waitFor({ timeout: 2_500 }).then(
      () => true,
      () => false,
    ))
  )
    return
  await dialog.getByRole('button').last().click()
  await expect(dialog).toHaveCount(0)
}
const isPath = (re: RegExp, method: string) => (r: { url(): string; request(): Request }) =>
  r.request().method() === method && re.test(new URL(r.url()).pathname)

type QuizAnswer = { correct: number; total: number; reward: { xpGained: number } | null; review: { answer: number }[] }
/** answers every question (option `pick(i)`), presses the last button, and gives back what the server answered */
async function takeQuiz(page: Page, pick: (i: number) => number, expectOk = true) {
  const quiz = page.locator('#quiz')
  const answered = page.waitForResponse(isPath(/\/lessons\/[^/]+\/quiz$/, 'POST'), { timeout: expectOk ? 15_000 : 2_000 }).catch(() => null)
  for (let i = 0; ; i++) {
    await quiz.getByRole('radio').nth(pick(i)).click()
    const last = await quiz.getByRole('button', { name: 'See my score' }).count()
    await quiz.getByRole('button', { name: last ? 'See my score' : 'Next' }).click()
    if (last) break
  }
  const res = await answered
  if (res) await closeCelebration(page)
  return res ? ((await res.json().catch(() => null)) as QuizAnswer | null) : null
}

test.describe('Lô 4c — học tập qua API thật', () => {
  // the longer scenarios (quiz: three attempts with a reward each) take ~25 s alone, and more when the whole suite runs
  test.describe.configure({ timeout: 120_000 })
  test('a guest keeps everything on the device: nothing about learning is sent', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await page.getByRole('button', { name: 'Save lesson' }).first().click()
    await toTheEnd(page)
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()
    await expect.poll(async () => (await local(page)).lessons?.[LESSON]?.completed).toBe(true) // finished, on this device
    await page.goto('/learn/flashcards')
    await page.getByRole('button', { name: 'Start studying' }).click()
    await page.getByRole('button', { name: 'Flip card to see the meaning' }).click()
    await page.getByRole('button', { name: 'I knew it' }).click()
    await expect.poll(async () => Object.keys((await local(page)).flashcards ?? {}).length).toBe(1)
    const learningCalls = seen.filter((r) => /^\/(me\/|lessons\/[^/?]+\/(progress|complete|quiz))/.test(path(r)))
    expect(learningCalls.map((r) => `${r.method()} ${path(r)}`)).toEqual([])
    expect(problems).toEqual([])
  })

  test('reading progress is sent as the 0–1 share read; the server keeps the largest', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await register(page)
    await page.goto('/learn')
    // The page's own scroll tracking has its test below; here it is the function the lesson page calls, with the
    // very module instance the app uses (Vite serves it in dev), so that the values sent can be exact.
    const save = (value: number) =>
      page.evaluate(
        async ([slug, v]) => (await import(/* @vite-ignore */ '/src/api/learn.ts')).saveLessonProgress(slug as string, v as number),
        [LESSON, value],
      )
    await save(0.5)
    await expect.poll(() => calls(seen, 'PUT', new RegExp(`/lessons/${LESSON}/progress$`)).length).toBe(1)
    expect(calls(seen, 'PUT', /progress$/)[0].postDataJSON()).toEqual({ progress: 0.5 })
    expect((await learning(page)).lessons[LESSON]).toMatchObject({ progress: 0.5, completed: false })
    await save(0.2) // reading back up the page: the best share stays
    await expect.poll(() => calls(seen, 'PUT', /progress$/).length).toBe(2)
    expect((await learning(page)).lessons[LESSON].progress).toBe(0.5)
    expect((await learning(page)).lastLesson).toBe(LESSON)
    expect(problems).toEqual([])
  })

  test('going on to a lesson that is already known does not carry the "Done" mark of the one just finished', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    const NEXT = 'golden-ratio' // the lesson after rule-of-thirds
    await page.goto(`/learn/lessons/${NEXT}`) // known to the app from now on, and NOT finished
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'All lessons' }).click() // inside the app, no page load
    await page.locator(`a[href="/learn/lessons/${LESSON}"]:visible`).first().click()
    await expect(page.getByRole('heading', { level: 1, name: /Rule of Thirds/i })).toBeVisible() // not the page on its way out
    await toTheEnd(page)
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    await closeCelebration(page)

    await page.getByRole('link', { name: /Next lesson/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Golden Ratio/ })).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).toHaveCount(0)
    expect(await local(page).then((l) => l.lessons?.[NEXT]?.completed ?? false)).toBe(false)
    expect(problems).toEqual([])
  })

  test('when the session ends on the lesson just finished (a 401), its "Done" mark does not stay for the guest', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    await expect(page.getByText('Lesson complete!')).toBeVisible() // finished just now, by this account
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    await closeCelebration(page)
    expect(await tokenOf(page)).not.toBeNull()

    // the server stops accepting the token (it ran out): the next request that is sent gets a 401 ...
    await page.route(new RegExp(`/lessons/${LESSON}/progress$`), (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'unauthorized', message: 'The session has ended.', traceId: 't' } }),
      }),
    )
    // ... and it is sent by scrolling back up and down again (the reading progress is sent at the end of the article)
    await page.evaluate(() => window.scrollTo(0, 0))
    await toTheEnd(page)
    await expect.poll(() => tokenOf(page)).toBeNull() // signed out, and still on the same lesson
    await expect(page).toHaveURL(new RegExp(`/learn/lessons/${LESSON}$`))
    await expect(page.getByRole('heading', { level: 1, name: /Rule of Thirds/i })).toBeVisible()
    // the guest has not finished anything here
    await expect(page.getByText('Done', { exact: true })).toHaveCount(0)
    expect((await local(page)).lessons?.[LESSON]?.completed ?? false).toBe(false)
    expect(problems.filter((p) => !/401|unauthorized/i.test(p))).toEqual([])
  })

  test('scrolling a lesson that is opened fresh moves the bar and sends the progress', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`) // a full load: the lesson is not in memory, so the page first shows its skeleton
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const bar = page.locator('div.fixed.origin-left')
    const scaleOfBar = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
    expect(await scaleOfBar()).toBe(0) // nothing read yet

    // halfway through the article (0 = its top at the top of the window, 1 = its bottom at the bottom of the window)
    const room = await page.evaluate(() => document.querySelector('article')!.offsetHeight - window.innerHeight)
    expect(room, 'the article must be taller than the window for this test to mean anything').toBeGreaterThan(200)
    await page.evaluate(() => {
      const a = document.querySelector('article')!
      window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY + (a.offsetHeight - window.innerHeight) * 0.5)
    })

    // the window scrolls smoothly, so the first requests carry an earlier share: wait for the one that reaches the middle
    const lastSent = () =>
      calls(seen, 'PUT', new RegExp(`/lessons/${LESSON}/progress$`))
        .map((r) => r.postDataJSON().progress as number)
        .at(-1) ?? 0
    await expect.poll(lastSent).toBeGreaterThan(0.3)
    expect(lastSent()).toBeLessThan(0.7)
    await expect.poll(scaleOfBar).toBeGreaterThan(0.3)
    await expect.poll(async () => (await learning(page)).lessons[LESSON]?.progress).toBeGreaterThan(0.3)
    expect(calls(seen, 'POST', /complete$/)).toHaveLength(0) // the end was not reached
    expect(problems).toEqual([])
  })

  test('finishing a lesson is paid by the server once; reading again pays nothing', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    const before = await xpOf(page)
    const done = page.waitForResponse(isPath(/\/lessons\/[^/]+\/complete$/, 'POST'))
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    const res = await done
    expect(res.status()).toBe(200)
    const reward = (await res.json()) as { xpGained: number } | null
    expect(reward?.xpGained).toBeGreaterThan(0)
    await expect(page.getByText('Lesson complete!')).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    await closeCelebration(page)
    expect((await learning(page)).lessons[LESSON]).toMatchObject({ completed: true, progress: 1 })
    const after = await xpOf(page)
    expect(after).toBe(before + reward!.xpGained) // the server's number, not a local rule's

    // the same lesson again: the server answers with nothing to pay, and nothing is shown
    const again = page.waitForResponse(isPath(/\/lessons\/[^/]+\/complete$/, 'POST'))
    await page.reload()
    await toTheEnd(page)
    const second = await again
    expect(await second.json()).toBeNull()
    await expect(page.getByText('Lesson complete!')).toHaveCount(0)
    expect(await xpOf(page)).toBe(after)
    expect(problems).toEqual([])
  })

  test('the quiz is graded by the server; a better result pays only the new part', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    await expect(page.getByText('Done', { exact: true })).toBeVisible() // the end of the lesson finishes it (its reward is not the point here)
    await closeCelebration(page)
    await page.locator('#quiz').scrollIntoViewIfNeeded()
    const first = (await takeQuiz(page, () => 0))!
    expect(first.total).toBeGreaterThan(0)
    await expect(page.getByRole('status').filter({ hasText: 'Your score' })).toContainText(`${first.correct}/${first.total}`)
    await expect(page.getByText('Review your answers')).toBeVisible()
    const best1 = (await learning(page)).lessons[LESSON].quizBest
    expect(best1).toBeCloseTo(first.correct / first.total)
    const xp1 = await xpOf(page)

    // retake with the right answers, which the server revealed in the review
    await page.getByRole('button', { name: 'Retake quiz' }).click()
    const second = (await takeQuiz(page, (i) => first.review[i].answer))!
    expect(second.correct).toBe(second.total)
    if (first.correct < first.total) {
      expect(second.reward?.xpGained).toBeGreaterThan(0)
      expect(await xpOf(page)).toBe(xp1 + second.reward!.xpGained)
    }
    expect((await learning(page)).lessons[LESSON]).toMatchObject({ quizBest: 1, quizPassed: true })

    // and a third, perfect one pays nothing
    await page.getByRole('button', { name: 'Retake quiz' }).click()
    const third = (await takeQuiz(page, (i) => first.review[i].answer))!
    expect(third.reward).toBeNull()
    expect(problems).toEqual([])
  })

  test('answers that did not get through are kept: "Try again" sends them', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await toTheEnd(page)
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    await closeCelebration(page)
    await page.locator('#quiz').scrollIntoViewIfNeeded()
    let refused = 0
    await page.route('**/api/v1/lessons/*/quiz', (route) => {
      if (refused++ === 0) return route.abort('connectionrefused')
      return route.continue()
    })
    await takeQuiz(page, () => 0, false)
    const alert = page.locator('#quiz').getByRole('alert')
    await expect(alert).toContainText('Your answers weren’t sent.')
    const answered = page.waitForResponse(isPath(/\/lessons\/[^/]+\/quiz$/, 'POST'))
    await alert.getByRole('button', { name: 'Try again' }).click()
    const ok = (await (await answered).json()) as QuizAnswer
    expect(ok.total).toBeGreaterThan(0)
    await expect(page.getByText('Review your answers')).toBeVisible()
    expect(refused).toBe(2)
    expect(problems.filter((p) => !/ERR_|Failed to fetch|Network/i.test(p))).toEqual([])
  })

  test('a bookmark is the account’s: it comes back from the server, and goes when removed', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await page.getByRole('button', { name: 'Save lesson' }).first().click()
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()
    await expect.poll(() => calls(seen, 'PUT', new RegExp(`/me/bookmarks/${LESSON}$`)).length).toBe(1)
    expect((await learning(page)).bookmarks).toEqual([LESSON])

    // forget everything on this device: the account still has it
    await page.evaluate(() => localStorage.removeItem('artspark:learn'))
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Remove from saved' }).first().click()
    await expect.poll(() => calls(seen, 'DELETE', new RegExp(`/me/bookmarks/${LESSON}$`)).length).toBe(1)
    expect((await learning(page)).bookmarks).toEqual([])
    expect(problems).toEqual([])
  })

  test('a bookmark the server refused goes back to how it was, with a message', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    await page.goto(`/learn/lessons/${LESSON}`)
    await page.route('**/api/v1/me/bookmarks/*', (route) => route.abort('connectionrefused'))
    await page.getByRole('button', { name: 'Save lesson' }).first().click()
    await expect(page.getByText('We couldn’t update your saved lessons. Please try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save lesson' }).first()).toBeVisible()
    expect((await learning(page)).bookmarks).toEqual([])
    expect(problems.filter((p) => !/ERR_|Failed to fetch|Network/i.test(p))).toEqual([])
  })

  test('flashcards: the server chooses the box and the due time; a whole session is reported once', async ({ page }) => {
    const problems = await prep(page)
    const seen = watch(page)
    await register(page)
    await page.goto('/learn/flashcards')
    await page.getByRole('button', { name: 'Start studying' }).click()
    const total = Number((await page.getByText(/^1 of \d+$/).textContent())!.split(' of ')[1])
    expect(total).toBeGreaterThan(0)
    for (let i = 0; i < total; i++) {
      const saved = page.waitForResponse(isPath(/\/me\/flashcards\/[^/]+$/, 'PUT'))
      await page.getByRole('button', { name: 'Flip card to see the meaning' }).click()
      await page.getByRole('button', { name: 'I knew it' }).click()
      expect((await saved).status()).toBe(200)
    }
    await expect(page.getByText('Session complete')).toBeVisible()
    const puts = calls(seen, 'PUT', /\/me\/flashcards\/[^/]+$/)
    expect(puts).toHaveLength(total)
    expect(puts.every((r) => r.postDataJSON().knewIt === true)).toBe(true) // only whether it was known
    await expect
      .poll(() => calls(seen, 'POST', /\/progress\/events$/).filter((r) => r.postDataJSON().type === 'flashcardReviewed').length)
      .toBe(1)

    const server = (await learning(page)).flashcards
    expect(Object.keys(server)).toHaveLength(total)
    expect(Object.values(server).every((c) => c.box === 1)).toBe(true)
    // this device shows the same boxes, with the due time ~10 minutes ahead of ITS clock (not the server's)
    const mine = (await local(page)).flashcards!
    expect(Object.fromEntries(Object.entries(mine).map(([id, c]) => [id, c.box]))).toEqual(
      Object.fromEntries(Object.entries(server).map(([id, c]) => [id, c.box])),
    )
    for (const c of Object.values(mine)) expect(Math.abs(c.due - (Date.now() + 10 * 60_000))).toBeLessThan(60_000)
    expect(problems).toEqual([])
  })

  test('a card whose answer was not saved stays, with a message', async ({ page }) => {
    const problems = await prep(page)
    await register(page)
    await page.goto('/learn/flashcards')
    await page.getByRole('button', { name: 'Start studying' }).click()
    let refused = 0
    await page.route('**/api/v1/me/flashcards/*', (route) => (refused++ === 0 ? route.abort('connectionrefused') : route.continue()))
    await page.getByRole('button', { name: 'Flip card to see the meaning' }).click()
    await page.getByRole('button', { name: 'I knew it' }).click()
    await expect(page.getByText('We couldn’t save that answer. Please try again.')).toBeVisible()
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible()
    expect(Object.keys((await learning(page)).flashcards)).toHaveLength(0)
    await page.getByRole('button', { name: 'I knew it' }).click() // still flipped: try again
    await expect(page.getByText(/^2 of \d+$/)).toBeVisible()
    expect(problems.filter((p) => !/ERR_|Failed to fetch|Network/i.test(p))).toEqual([])
  })

  test('changing account: a guest’s data is replaced by the account’s; nothing of one account reaches the next', async ({ page }) => {
    const problems = await prep(page)
    // a guest saves a lesson on the device, then registers: the new account has none
    await page.goto(`/learn/lessons/${LESSON}`)
    await page.getByRole('button', { name: 'Save lesson' }).first().click()
    await expect.poll(async () => (await local(page)).bookmarks).toEqual([LESSON])
    await page.goto('/register')
    const emailA = await signUpOnPage(page, 'Lan')
    await expect(page).toHaveURL(/\/practice$/)
    await expect.poll(async () => (await local(page)).bookmarks).toEqual([])
    expect((await learning(page)).bookmarks).toEqual([])

    // account A saves it, and earns XP
    await page.goto(`/learn/lessons/${LESSON}`)
    await page.getByRole('button', { name: 'Save lesson' }).first().click()
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()
    await expect.poll(async () => (await learning(page)).bookmarks).toEqual([LESSON])
    await toTheEnd(page)
    await expect(page.getByText('Lesson complete!')).toBeVisible()
    await closeCelebration(page)
    const xpA = await xpOf(page)
    expect(xpA).toBeGreaterThan(0)

    // sign out: both stores are empty on the device
    await signOut(page)
    expect((await local(page)).bookmarks).toEqual([])
    const progress = await page.evaluate(
      () => JSON.parse(localStorage.getItem('artspark:progress') ?? '{"state":{"xp":0}}').state.xp as number,
    )
    expect(progress).toBe(0)

    // account B sees none of it
    await page.goto('/register')
    await signUpOnPage(page, 'Minh')
    await expect(page).toHaveURL(/\/practice$/)
    await page.goto(`/learn/lessons/${LESSON}`)
    await expect(page.getByRole('button', { name: 'Save lesson' }).first()).toBeVisible()
    expect(await xpOf(page)).toBe(0)
    await signOut(page)

    // account A signs in again on this (now empty) device: everything comes back from the server
    await page.goto('/login')
    await page.getByLabel('Email').fill(emailA)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/collection$/) // signing in lands on the collection
    await page.goto(`/learn/lessons/${LESSON}`)
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    expect(await xpOf(page)).toBe(xpA)
    expect(problems).toEqual([])
  })
})
