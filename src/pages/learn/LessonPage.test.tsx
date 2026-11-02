import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import en from '@/i18n/en.json'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { useCelebrations, useToasts } from '@/store/ui'
import LessonPage from './LessonPage'

/*
 * The reading bar and the "reading progress" request both hang on framer-motion's `useScroll({ target })`.
 * It looks at `target.current` ONCE, when the component mounts. These tests run the real `useScroll` and only
 * note what the target was at that moment: if the <article> is not there yet (the lesson is still loading)
 * the scroll progress stays at 0 for good, the bar never moves and no progress is ever sent.
 */

const scrollTargets = vi.hoisted(() => [] as (HTMLElement | null)[])
/** how many times something subscribed to the reading progress (`scrollYProgress.on('change', …)`) */
const scrollSubscriptions = vi.hoisted(() => ({ count: 0 }))
const patchedProgress = vi.hoisted(() => new WeakSet<object>())
/** every IntersectionObserver the page makes, with the element it was told to watch (other components make their own) */
const watchers = vi.hoisted(() => [] as { callback: (entries: { isIntersecting: boolean }[]) => void; el: Element | null }[])
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  const { useLayoutEffect } = await import('react')
  return {
    ...actual,
    useScroll: (options: Parameters<typeof actual.useScroll>[0]) => {
      const result = actual.useScroll(options)
      const progress = result.scrollYProgress
      if (!patchedProgress.has(progress)) {
        patchedProgress.add(progress)
        const on = progress.on.bind(progress) as (event: string, cb: (v: number) => void) => () => void
        progress.on = ((event: string, cb: (v: number) => void) => {
          if (event === 'change') scrollSubscriptions.count++
          return on(event, cb)
        }) as typeof progress.on
      }
      const target = options?.target
      // runs right after useScroll's own mount effect, in the same commit (the ref object itself never changes)
      useLayoutEffect(() => {
        scrollTargets.push(target && 'current' in target ? (target.current as HTMLElement | null) : null)
      }, [target])
      return result
    },
  }
})

/** A test can hold the completion request back (`gate.hold`) to be sure it is still in flight; the real code runs after. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null, last: null as Promise<unknown> | null }))
vi.mock('@/api/learn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/learn')>()
  return {
    ...actual,
    completeLesson: (slug: string) => {
      const completion = (async () => {
        await gate.hold
        return actual.completeLesson(slug)
      })()
      gate.last = completion // a test can wait for exactly this request to be answered
      return completion
    },
  }
})

const loc = (s: string) => ({ en: s, vi: s })
const LESSON = {
  slug: 'rule-of-thirds',
  title: loc('The rule of thirds'),
  summary: loc('Place the subject off centre.'),
  topic: 'composition',
  track: 'beginner',
  difficulty: 'easy',
  minutes: 4,
  sections: [{ heading: loc('Why thirds'), body: loc('Body text of the first section.') }],
  tryIt: { tool: 'pencil', palette: ['#aa3300'], prompt: loc('Draw a horizon on the upper third.') },
  quiz: { lessonSlug: 'rule-of-thirds', questions: [{ id: 'q1', prompt: loc('Q1?'), options: [loc('A1'), loc('B1')] }] },
  xp: 20,
}

const NEXT = { ...LESSON, slug: 'golden-ratio', title: loc('The golden ratio') }

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn()

/** The lesson arrives only when `release()` is called: the page shows its loading skeleton until then. */
function slowLesson() {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/lessons/rule-of-thirds')) {
      await gate
      return json(LESSON)
    }
    if (url.endsWith('/lessons')) return json([LESSON])
    return json({})
  })
  return release
}

/** "the reader got to the end of the lesson": the page's own end marker (the last thing in the <article>) comes into view */
async function reachTheEnd() {
  const end = document.querySelector('article')?.lastElementChild
  const watcher = watchers.findLast((w) => w.el === end)
  expect(watcher).toBeDefined() // the page is watching its end marker
  await act(async () => watcher!.callback([{ isIntersecting: true }]))
}

/* ---------- a signed-in person: the server's side of finishing a lesson ---------- */

const REWARD = {
  xpGained: 13,
  xpBefore: 0,
  xpAfter: 13,
  levelBefore: 1,
  levelAfter: 2, // a level-up and a badge, so that showing the reward to somebody leaves a trace (the celebration queue)
  newBadges: ['first-lesson'],
  streak: 1,
  streakExtended: false,
  completedChallenges: [],
}
const learningOf = (bookmarks: string[] = []) => ({
  lessons: {},
  bookmarks,
  lastLesson: null,
  flashcards: {},
  spotBest: 0,
  serverTime: '2026-11-02T10:00:00Z',
})
const progressOf = () => ({
  xp: 13,
  level: { level: 2, current: 13, needed: 100, ratio: 0.1 },
  badges: {},
  streak: { current: 1, longest: 1, lastDay: '2026-11-02', freezes: 0, frozenDays: [], live: 1 },
  activity: {},
  stats: useProgress.getState().stats,
  scoreHistory: [],
})

/** The server as a signed-in person meets it. `completion` holds back the answer to "I finished this lesson". */
function serverAnswers(completion: Promise<void> = Promise.resolve(), refuse = false) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/me/learning')) return json(learningOf())
    if (url.endsWith('/me/progress')) return json(progressOf())
    if (method === 'POST' && url.endsWith('/complete')) {
      await completion
      if (refuse) return new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'x', traceId: 't' } }), { status: 401 })
      return json(REWARD)
    }
    if (url.endsWith('/lessons')) return json([LESSON, NEXT])
    return json({}) // the reading progress (PUT) and whatever else is not the point of the test
  })
}
const completeRequests = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/complete')).length

/** Somebody signs in (or another account takes over); the app then asks for that account's learning. */
async function signInAs(id: string) {
  const asked = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/me/learning')).length
  const before = asked()
  await act(async () => useSession.setState({ user: { ...GUEST, id, isGuest: false }, token: `tok-${id}` }))
  await vi.waitFor(() => expect(asked()).toBe(before + 1))
  await act(async () => {}) // let that answer land before the test goes on
}

function twoKnownLessons() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['lessons', LESSON.slug], LESSON)
  client.setQueryData(['lessons', NEXT.slug], NEXT)
  return client
}

/** Two lessons, a link to go on from one to the other, and the page. */
function renderLessons(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/learn/lessons/rule-of-thirds']}>
        <Routes>
          <Route
            path="/learn/lessons/:slug"
            element={
              <>
                <Link to="/learn/lessons/golden-ratio">go on</Link>
                <LessonPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/learn/lessons/rule-of-thirds']}>
        <Routes>
          <Route path="/learn/lessons/:slug" element={<LessonPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private watcher: (typeof watchers)[number]
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        this.watcher = { callback, el: null }
        watchers.push(this.watcher)
      }
      observe(el: Element) {
        this.watcher.el = el
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
})
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  scrollTargets.length = 0
  watchers.length = 0
  gate.hold = null
  gate.last = null
  scrollSubscriptions.count = 0
  useCelebrations.setState({ queue: [] })
  useToasts.setState({ toasts: [] })
  useSession.setState({ user: GUEST, token: null })
  useLearn.getState().reset()
  useProgress.getState().reset()
})

describe('LessonPage, scroll tracking', () => {
  it('starts watching the scroll only once the article is on the page (lesson still loading when the page opens)', async () => {
    const release = slowLesson()
    mount()
    expect(screen.queryByRole('heading', { name: 'The rule of thirds' })).not.toBeInTheDocument() // still the skeleton

    release()
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    const article = document.querySelector('article')
    expect(article).not.toBeNull()
    expect(scrollTargets.length).toBeGreaterThan(0)
    // every time scroll tracking was set up, its target was already the article
    expect(scrollTargets.every((el) => el === article)).toBe(true)
  })

  it('also watches the article when the lesson is already known at once (opened again from the cache)', async () => {
    const release = slowLesson()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mount(client).unmount() // first visit fills the cache
    release()
    await vi.waitFor(() => expect(client.getQueryData(['lessons', 'rule-of-thirds'])).toBeDefined())
    scrollTargets.length = 0

    mount(client)
    await screen.findByRole('heading', { name: 'The rule of thirds' })
    const article = document.querySelector('article')
    expect(scrollTargets.length).toBeGreaterThan(0)
    expect(scrollTargets.every((el) => el === article)).toBe(true)
  })
})

describe('LessonPage, going from one lesson to another', () => {
  it('does not carry the "Done" mark of the lesson just finished over to the next one (which is already known)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['lessons', LESSON.slug], LESSON) // both lessons are in memory, so the page shows the next one at once
    client.setQueryData(['lessons', NEXT.slug], NEXT)
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/lessons') ? json([LESSON, NEXT]) : json({})))
    renderLessons(client)

    await screen.findByRole('heading', { name: 'The rule of thirds' })
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument() // not read yet
    // the reader gets to the end of the lesson: it is marked finished
    await reachTheEnd()
    expect(await screen.findByText('Done', { exact: true })).toBeInTheDocument()
    // ...and the page has taken the reward in (the "Done" above is already there from the stored lesson; the page's own
    // memory of "I finished it just now" comes a moment later, when the reward has been worked out)
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))

    fireEvent.click(screen.getByRole('link', { name: 'go on' }))
    await screen.findByRole('heading', { name: 'The golden ratio' })
    expect(useLearn.getState().lessons['golden-ratio']?.completed).toBeFalsy() // it really was not finished
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
  })

  it('does not mark the next lesson "Done" when the reward of the lesson just left comes in after the move', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['lessons', LESSON.slug], LESSON)
    client.setQueryData(['lessons', NEXT.slug], NEXT)
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/lessons') ? json([LESSON, NEXT]) : json({})))
    renderLessons(client)
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    // the end is reached and, before the reward has come back, the reader goes on to the next lesson
    let release: () => void = () => {}
    gate.hold = new Promise<void>((resolve) => (release = resolve))
    await reachTheEnd()
    fireEvent.click(screen.getByRole('link', { name: 'go on' }))
    await screen.findByRole('heading', { name: 'The golden ratio' })
    expect(useToasts.getState().toasts).toHaveLength(0) // held back: really still in flight when we moved

    // now the reward of the first lesson arrives
    release()
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))
    expect(useLearn.getState().lessons['golden-ratio']?.completed).toBeFalsy()
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
  })

  it('does not start the reader over (no new mount) while the same lesson stays on the page and its data is updated', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['lessons', LESSON.slug], LESSON)
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/lessons') ? json([LESSON, NEXT]) : json({})))
    mount(client)
    await screen.findByRole('heading', { name: 'The rule of thirds' })
    const startedOnce = scrollTargets.length
    expect(startedOnce).toBeGreaterThan(0)

    // the same lesson comes in again with something changed (a refetch after an edit): the page draws it again, the reader must stay
    expect(screen.getByText('4 min read')).toBeInTheDocument()
    act(() => client.setQueryData(['lessons', LESSON.slug], { ...LESSON, minutes: 5 }))
    await screen.findByText('5 min read') // proof that it was drawn again
    expect(scrollTargets.length).toBe(startedOnce) // the reader was not mounted a second time (useScroll would have recorded a target again)
  })
})

describe('LessonPage, when the person changes while the same lesson stays open', () => {
  it('does not keep the "Done" mark of the one who left when the person signs out', async () => {
    serverAnswers()
    await signInAs('u1')
    renderLessons(twoKnownLessons())
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    await reachTheEnd()
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))
    expect(screen.getByText('Done', { exact: true })).toBeInTheDocument()

    act(() => useSession.getState().signOut()) // the page stays; the stores of the one who left are cleared
    expect(useLearn.getState().lessons['rule-of-thirds']?.completed).toBeFalsy()
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
  })

  it('still shows the reward when the same person is still signed in (nothing else changes)', async () => {
    serverAnswers()
    await signInAs('u1')
    renderLessons(twoKnownLessons())
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    await reachTheEnd()
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))
    expect(useCelebrations.getState().queue.map((c) => c.kind)).toEqual(['level', 'badge'])
    expect(screen.getByText('Done', { exact: true })).toBeInTheDocument()
  })

  it.each([
    ['signs out', () => useSession.getState().signOut()],
    ['takes over (another account signs in)', () => useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-u2' })],
  ])(
    'does not show the reward of a request that was sent by the one who left (the person %s before it comes back)',
    async (_what, change) => {
      let release: () => void = () => {}
      serverAnswers(new Promise<void>((resolve) => (release = resolve)))
      await signInAs('u1')
      renderLessons(twoKnownLessons())
      await screen.findByRole('heading', { name: 'The rule of thirds' })

      await reachTheEnd()
      await vi.waitFor(() => expect(completeRequests()).toBe(1)) // on its way, and held back by the "server"
      await act(async () => change())
      release()
      // the api still hands the reward back (it was paid to the one who left) ...
      await expect(gate.last).resolves.toMatchObject({ xpGained: 13 })
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0))) // ... let the page work with it
      // ... but the page does not show it to whoever is there now
      expect(useToasts.getState().toasts.map((t) => t.title)).not.toContain('Lesson complete!')
      expect(useCelebrations.getState().queue).toHaveLength(0)
      expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
    },
  )

  it('does not bring the mark back for a guest who is back after somebody else was there (a guest is always "no token")', async () => {
    serverAnswers()
    renderLessons(twoKnownLessons())
    await screen.findByRole('heading', { name: 'The rule of thirds' })
    await reachTheEnd() // as a guest
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))
    expect(screen.getByText('Done', { exact: true })).toBeInTheDocument()

    await signInAs('u1') // somebody else is here: nothing of the guest's remains
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
    act(() => useSession.getState().signOut()) // a guest again: a new one, who has finished nothing
    expect(useLearn.getState().lessons['rule-of-thirds']?.completed).toBeFalsy()
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
  })

  it('still shows the reward when the reader goes on to the next lesson while the request is on its way (the same person)', async () => {
    let release: () => void = () => {}
    serverAnswers(new Promise<void>((resolve) => (release = resolve)))
    await signInAs('u1')
    renderLessons(twoKnownLessons())
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    await reachTheEnd()
    await vi.waitFor(() => expect(completeRequests()).toBe(1))
    fireEvent.click(screen.getByRole('link', { name: 'go on' }))
    await screen.findByRole('heading', { name: 'The golden ratio' })
    release()
    await expect(gate.last).resolves.toMatchObject({ xpGained: 13 })
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toContain('Lesson complete!'))
    expect(useCelebrations.getState().queue.map((c) => c.kind)).toEqual(['level', 'badge']) // it was earned, wherever the reader is now
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument() // ... but this lesson was not finished
  })

  it('tells the person when the server refuses the completion (their session has ended) and signs them out', async () => {
    serverAnswers(Promise.resolve(), true)
    await signInAs('u1')
    renderLessons(twoKnownLessons())
    await screen.findByRole('heading', { name: 'The rule of thirds' })

    await reachTheEnd()
    await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.title)).toHaveLength(1))
    expect(useToasts.getState().toasts[0].tone).toBe('error') // the failure is told, not hidden by the new guard
    expect(useToasts.getState().toasts.map((t) => t.title)).not.toContain('Lesson complete!')
    expect(useSession.getState().token).toBeNull()
    expect(screen.queryByText('Done', { exact: true })).not.toBeInTheDocument()
  })
})

describe('LessonPage, when the data of the lesson on the page is refreshed', () => {
  it('does not set up its watchers again (end of the lesson, reading progress)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['lessons', LESSON.slug], LESSON)
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/lessons') ? json([LESSON, NEXT]) : json({})))
    mount(client)
    await screen.findByRole('heading', { name: 'The rule of thirds' })
    const end = () => document.querySelector('article')?.lastElementChild
    const endWatchers = () => watchers.filter((w) => w.el === end()).length
    expect(endWatchers()).toBe(1)
    const subscriptions = scrollSubscriptions.count // the page's own and the bar's (framer-motion subscribes by itself too)
    expect(subscriptions).toBeGreaterThan(0)

    act(() => client.setQueryData(['lessons', LESSON.slug], { ...LESSON, minutes: 5 }))
    await screen.findByText('5 min read') // drawn again with the new data

    expect(endWatchers()).toBe(1) // not a second one (it would call "finished" a second time if the end is in view)
    expect(scrollSubscriptions.count).toBe(subscriptions) // and the "send progress every so often" memory is kept
  })
})
