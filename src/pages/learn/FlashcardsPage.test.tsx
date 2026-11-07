import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import en from '@/i18n/en.json'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { useToasts } from '@/store/ui'
import FlashcardsPage from './FlashcardsPage'

/* The page runs on the real hooks and the real API layer; only the network (fetch) is faked. */

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const failure = (status: number, code: string) => json(status, { error: { code, message: 'English text from the server' } })
const loc = (s: string) => ({ en: s, vi: s })
const term = (id: string) => ({ id, term: loc(`Term ${id}`), definition: loc(`Meaning ${id}`), category: 'colour' })
const NOW = new Date('2026-11-02T12:00:00Z')
const SERVER_NOW = '2026-11-02T10:00:00Z' // the server's clock is two hours behind this device's
const LEARNING = { lessons: {}, bookmarks: [], lastLesson: null, flashcards: {}, spotBest: 0, serverTime: SERVER_NOW }
const REVIEW = (id: string, box: number, due: string) => ({ termId: id, box, due, serverTime: SERVER_NOW })

type Answer = Response | (() => Response | Promise<Response>)
function serve(routes: Record<string, Answer>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '')}`
    const a = routes[key]
    if (!a) return failure(500, `unexpected_call:${key}`)
    return typeof a === 'function' ? a() : a.clone()
  })
}
const calls = () =>
  fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${(c[0] as string).replace('/api/v1', '')}`)
const count = (call: string) => calls().filter((c) => c === call).length

function mount(glossary = ['g1', 'g2']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    glossary,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FlashcardsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}
const GLOSSARY = (ids: string[]) => json(200, ids.map(term))
const start = async () => fireEvent.click(await screen.findByRole('button', { name: 'Start studying' }))
const flip = () => fireEvent.click(screen.getByRole('button', { name: 'Flip card to see the meaning' }))
const knew = () => fireEvent.click(screen.getByRole('button', { name: 'I knew it' }))
const forgot = () => fireEvent.click(screen.getByRole('button', { name: 'Review again' }))

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
})
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useToasts.setState({ toasts: [] })
  useSession.setState({ user: GUEST, token: null })
  useLearn.getState().reset()
  useProgress.getState().reset()
})
afterEach(() => {
  vi.useRealTimers()
  useSession.setState({ user: GUEST, token: null })
})

const signIn = () => {
  useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
  fetchMock.mockReset() // signing in started a fetch of the account's learning: not what is asserted here
}

describe('FlashcardsPage, signed in', () => {
  it('sends only "knew it" and keeps the box and due time the server answers with', async () => {
    signIn()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    serve({
      'GET /glossary': GLOSSARY(['g1', 'g2']),
      'GET /me/learning': json(200, LEARNING),
      'PUT /me/flashcards/g1': json(200, REVIEW('g1', 1, '2026-11-02T10:10:00Z')),
    })
    mount()
    await start()
    flip()
    knew()
    await screen.findByText('2 of 2')
    const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit).method === 'PUT')!
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ knewIt: true })
    expect(useLearn.getState().flashcards.g1).toEqual({ box: 1, due: NOW.getTime() + 10 * 60_000 })
  })

  it('stays on the card and says so when the answer was not saved', async () => {
    signIn()
    serve({
      'GET /glossary': GLOSSARY(['g1', 'g2']),
      'GET /me/learning': json(200, LEARNING),
      'PUT /me/flashcards/g1': failure(503, 'server_error'),
    })
    mount()
    await start()
    flip()
    knew()
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe('We couldn’t save that answer. Please try again.'))
    expect(useToasts.getState().toasts.at(-1)?.description).toBe('The studio is busy right now. Please try again in a moment.') // why, from the shared sentences
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(useLearn.getState().flashcards.g1).toBeUndefined()
    expect(count('POST /progress/events')).toBe(0)
  })

  it('takes one press for one answer (a second press while it is being saved is ignored)', async () => {
    signIn()
    let release!: (r: Response) => void
    serve({
      'GET /glossary': GLOSSARY(['g1', 'g2']),
      'GET /me/learning': json(200, LEARNING),
      'PUT /me/flashcards/g1': () => new Promise<Response>((res) => (release = res)),
    })
    mount()
    await start()
    flip()
    knew()
    knew()
    await waitFor(() => expect(count('PUT /me/flashcards/g1')).toBe(1))
    await act(async () => release(json(200, REVIEW('g1', 1, '2026-11-02T10:10:00Z'))))
    await screen.findByText('2 of 2')
    expect(count('PUT /me/flashcards/g1')).toBe(1)
  })

  it('reports the finished session once, as before', async () => {
    signIn()
    serve({
      'GET /glossary': GLOSSARY(['g1']),
      'GET /me/learning': json(200, LEARNING),
      'PUT /me/flashcards/g1': json(200, REVIEW('g1', 0, SERVER_NOW)),
      'POST /progress/events': json(200, {
        xpGained: 0,
        xpBefore: 0,
        xpAfter: 0,
        levelBefore: 1,
        levelAfter: 1,
        newBadges: [],
        streak: 0,
        streakExtended: false,
        completedChallenges: [],
      }),
      'GET /me/progress': json(500, {}),
    })
    mount(['g1'])
    await start()
    flip()
    forgot()
    await screen.findByText('Session complete')
    await waitFor(() => expect(count('POST /progress/events')).toBe(1))
  })

  it("loads the account's cards when the page opens (another device may have answered some)", async () => {
    signIn()
    serve({ 'GET /glossary': GLOSSARY(['g1']), 'GET /me/learning': json(200, LEARNING) })
    mount(['g1'])
    await waitFor(() => expect(count('GET /me/learning')).toBe(1))
  })
})

describe('FlashcardsPage, as a guest', () => {
  it('keeps the card on this device: up one box when known, due after the box waits, nothing sent', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    serve({ 'GET /glossary': GLOSSARY(['g1', 'g2']) })
    mount()
    await start()
    flip()
    knew()
    await screen.findByText('2 of 2')
    expect(useLearn.getState().flashcards.g1).toEqual({ box: 1, due: NOW.getTime() + 10 * 60_000 })
    expect(calls()).toEqual(['GET /glossary'])
  })

  it('sends a forgotten card back to box 0', async () => {
    useLearn.setState({ flashcards: { g1: { box: 3, due: 0 }, g2: { box: 4, due: 0 } } }) // the lower box comes first
    serve({ 'GET /glossary': GLOSSARY(['g1', 'g2']) })
    mount()
    await start()
    flip()
    forgot()
    await screen.findByText('2 of 2')
    expect(useLearn.getState().flashcards.g1.box).toBe(0)
  })

  it('does not ask the server for cards', async () => {
    serve({ 'GET /glossary': GLOSSARY(['g1']) })
    mount(['g1'])
    await screen.findByRole('button', { name: 'Start studying' })
    expect(calls()).toEqual(['GET /glossary'])
  })
})
