import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import en from '@/i18n/en.json'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { useToasts } from '@/store/ui'
import LessonPage from './LessonPage'

/*
 * The reading bar and the "reading progress" request both hang on framer-motion's `useScroll({ target })`.
 * It looks at `target.current` ONCE, when the component mounts. These tests run the real `useScroll` and only
 * note what the target was at that moment: if the <article> is not there yet (the lesson is still loading)
 * the scroll progress stays at 0 for good, the bar never moves and no progress is ever sent.
 */

const scrollTargets = vi.hoisted(() => [] as (HTMLElement | null)[])
/** every IntersectionObserver the page makes, with the element it was told to watch (other components make their own) */
const watchers = vi.hoisted(() => [] as { callback: (entries: { isIntersecting: boolean }[]) => void; el: Element | null }[])
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  const { useLayoutEffect } = await import('react')
  return {
    ...actual,
    useScroll: (options: Parameters<typeof actual.useScroll>[0]) => {
      const result = actual.useScroll(options)
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
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }))
vi.mock('@/api/learn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/learn')>()
  return {
    ...actual,
    completeLesson: async (slug: string) => {
      await gate.hold
      return actual.completeLesson(slug)
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
  const NEXT = { ...LESSON, slug: 'golden-ratio', title: loc('The golden ratio') }

  it('does not carry the "Done" mark of the lesson just finished over to the next one (which is already known)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['lessons', LESSON.slug], LESSON) // both lessons are in memory, so the page shows the next one at once
    client.setQueryData(['lessons', NEXT.slug], NEXT)
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/lessons') ? json([LESSON, NEXT]) : json({})))
    render(
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
    render(
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
