import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import en from '@/i18n/en.json'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import LessonPage from './LessonPage'

/*
 * The reading bar and the "reading progress" request both hang on framer-motion's `useScroll({ target })`.
 * It looks at `target.current` ONCE, when the component mounts. These tests run the real `useScroll` and only
 * note what the target was at that moment: if the <article> is not there yet (the lesson is still loading)
 * the scroll progress stays at 0 for good, the bar never moves and no progress is ever sent.
 */

const scrollTargets = vi.hoisted(() => [] as (HTMLElement | null)[])
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
      observe() {}
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
