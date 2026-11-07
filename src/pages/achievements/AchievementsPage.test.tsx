import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import en from '@/i18n/en.json'
import { GUEST, useSession } from '@/store/session'
import { useToasts } from '@/store/ui'
import AchievementsPage from './AchievementsPage'

/* The page runs on the real hooks and the real API layer; only the network (fetch) is faked. */

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const failure = (status: number, code: string) => json(status, { error: { code, message: 'English text from the server' } })

const CHALLENGE = {
  challenge: {
    id: 'd-draw',
    kind: 'daily',
    title: { en: 'Draw today', vi: 'Vẽ hôm nay' },
    description: { en: 'Save one drawing.', vi: 'Lưu một bức vẽ.' },
    metric: 'artworks',
    target: 1,
    xp: 20,
    icon: 'brush',
  },
  periodKey: '2026-11-02',
  progress: 1,
  claimed: false,
}
const BADGE = {
  id: 'first-stroke',
  name: { en: 'First stroke', vi: 'Nét đầu tiên' },
  description: { en: 'Save a drawing.', vi: 'Lưu một bức vẽ.' },
  category: 'practice',
  rarity: 'common',
  icon: 'brush',
  xp: 10,
}
const ME = { id: '1', name: 'Lan', avatarSeed: 'lan', xp: 120, weeklyXp: 40, level: 2, isCurrentUser: true }
const OTHER = { id: '2', name: 'Minh', avatarSeed: 'minh', xp: 90, weeklyXp: 10, level: 2 }

type Answer = Response | (() => Response)
/** What the fake server answers, by "METHOD path"; anything not listed is a 500 so a stray call is noticed. */
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

const OK = {
  'GET /challenges': json(200, [CHALLENGE]),
  'GET /achievements': json(200, { badges: [BADGE] }),
  'GET /leaderboard?scope=weekly': json(200, [ME, OTHER]),
  'GET /leaderboard?scope=all': json(200, [ME, OTHER]),
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const section = (heading: string) => screen.getByRole('heading', { level: 2, name: heading }).closest('section') as HTMLElement
const lastToast = () => useToasts.getState().toasts.at(-1)

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
  // jsdom has neither matchMedia (the theme hook) nor IntersectionObserver (the reveal animations)
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
  useToasts.setState({ toasts: [] })
  useSession.setState({ user: { ...GUEST, isGuest: false, displayName: 'Lan' }, token: 'tok' })
})
afterEach(() => {
  useSession.setState({ user: GUEST, token: null })
})

describe('AchievementsPage — when a list cannot be loaded', () => {
  it('says so in the challenges and offers a retry that works', async () => {
    let up = false
    serve({ ...OK, 'GET /challenges': () => (up ? json(200, [CHALLENGE]) : failure(500, 'server_error')) })
    mount()
    const box = within(section(en.achievements.challenges))
    const alert = await box.findByRole('alert')
    expect(alert).toHaveTextContent(en.common.errorGeneric)
    expect(box.queryByText('Draw today')).not.toBeInTheDocument()
    up = true
    fireEvent.click(within(alert).getByRole('button', { name: en.common.retry }))
    expect(await box.findByText('Draw today')).toBeInTheDocument()
    expect(box.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so on the badge wall, and one failed list does not hide the others', async () => {
    serve({ ...OK, 'GET /achievements': failure(500, 'server_error') })
    mount()
    const wall = within(section(en.achievements.badges))
    expect(await wall.findByRole('alert')).toHaveTextContent(en.common.errorGeneric)
    expect(await within(section(en.achievements.challenges)).findByText('Draw today')).toBeInTheDocument()
    expect(await within(section(en.achievements.leaderboard)).findByText('Minh')).toBeInTheDocument()
  })

  it('says so on the leaderboard, and retries only that list', async () => {
    let up = false
    serve({ ...OK, 'GET /leaderboard?scope=weekly': () => (up ? json(200, [ME, OTHER]) : failure(503, 'server_error')) })
    mount()
    const board = within(section(en.achievements.leaderboard))
    const alert = await board.findByRole('alert')
    up = true
    const before = calls().filter((c) => c === 'GET /challenges').length
    fireEvent.click(within(alert).getByRole('button', { name: en.common.retry }))
    expect(await board.findByText('Minh')).toBeInTheDocument()
    expect(calls().filter((c) => c === 'GET /challenges')).toHaveLength(before)
  })

  it('treats an answer that is not a list as a failure, not as "nobody here"', async () => {
    serve({ ...OK, 'GET /leaderboard?scope=weekly': json(200, { oops: true }) })
    mount()
    expect(await within(section(en.achievements.leaderboard)).findByRole('alert')).toBeInTheDocument()
  })
})

describe('AchievementsPage — the leaderboard shows real people only', () => {
  it('no longer says the other artists are fictional samples', async () => {
    serve(OK)
    mount()
    expect(await within(section(en.achievements.leaderboard)).findByText('Minh')).toBeInTheDocument()
    expect(screen.queryByText(/fictional|sample/i)).not.toBeInTheDocument()
  })

  it('marks the signed-in person and numbers the rows by their order', async () => {
    serve(OK)
    mount()
    const board = within(section(en.achievements.leaderboard))
    const rows = await board.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    expect(rows[0]).toHaveTextContent(/1.*Lan.*you/s)
    expect(rows[1]).not.toHaveAttribute('aria-current')
    expect(rows[1]).toHaveTextContent(/2.*Minh/s)
  })

  it('shows the real rank the server gives, also for someone far below the top list', async () => {
    // the server always includes the person asking, with their real rank, even past its cut
    serve({
      ...OK,
      'GET /leaderboard?scope=weekly': json(200, [
        { ...OTHER, id: '1' },
        { ...OTHER, id: '2', name: 'Hoa' },
        { ...ME, id: '57' },
      ]),
    })
    mount()
    const rows = await within(section(en.achievements.leaderboard)).findAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[2]).toHaveTextContent(/57.*Lan/s)
    expect(rows[2]).not.toHaveTextContent(/^3/)
  })

  it('tells the person they are the only one so far, instead of a lonely list', async () => {
    serve({ ...OK, 'GET /leaderboard?scope=weekly': json(200, [ME]) })
    mount()
    const board = within(section(en.achievements.leaderboard))
    expect(await board.findByText(en.achievements.leaderboardAlone)).toBeInTheDocument()
    expect(board.getByText('Lan')).toBeInTheDocument() // their own row is still shown
  })

  it('does not say “you are the only one” about a list with one other person in it', async () => {
    serve({ ...OK, 'GET /leaderboard?scope=weekly': json(200, [OTHER]) })
    mount()
    const board = within(section(en.achievements.leaderboard))
    expect(await board.findByText('Minh')).toBeInTheDocument()
    expect(board.queryByText(en.achievements.leaderboardAlone)).not.toBeInTheDocument()
  })

  it('does not say it when there is someone else, or nobody at all', async () => {
    serve({ ...OK, 'GET /leaderboard?scope=weekly': json(200, []) })
    mount()
    const board = within(section(en.achievements.leaderboard))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/leaderboard?scope=weekly', expect.anything()))
    await waitFor(() => expect(board.queryByRole('listitem')).not.toBeInTheDocument())
    expect(board.queryByText(en.achievements.leaderboardAlone)).not.toBeInTheDocument()
    expect(board.getByText(en.achievements.leaderboardEmpty)).toBeInTheDocument()
  })

  it('asks the server for the other scope when the tab changes', async () => {
    serve(OK)
    mount()
    await within(section(en.achievements.leaderboard)).findByText('Minh')
    fireEvent.click(screen.getByRole('tab', { name: en.achievements.allTime }))
    await waitFor(() => expect(calls()).toContain('GET /leaderboard?scope=all'))
  })
})

describe('AchievementsPage — claiming a reward', () => {
  const claimButton = async () => within(section(en.achievements.challenges)).findByRole('button', { name: en.achievements.claim })

  it('claims with the period the server named, then thanks the person', async () => {
    serve({
      ...OK,
      'POST /challenges/d-draw/claim': json(200, {
        xpGained: 20, xpBefore: 100, xpAfter: 120, levelBefore: 2, levelAfter: 2,
        newBadges: [], streak: 1, streakExtended: false, completedChallenges: [],
      }), // prettier-ignore
      'GET /me/progress': json(500, { error: { code: 'server_error', message: 'x' } }), // the refresh failing must not undo the claim
    })
    mount()
    fireEvent.click(await claimButton())
    await waitFor(() => expect(lastToast()?.title).toBe(en.achievements.claimedToast.replace('{{xp}}', '20')))
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({ periodKey: '2026-11-02' })
  })

  it.each([
    [409, 'already_claimed', en.achievements.claimError.already_claimed],
    [422, 'incomplete', en.achievements.claimError.incomplete],
    [404, 'not_found', en.achievements.claimError.not_found],
  ])('explains %i %s in the person’s language, not with the server’s English text', async (status, code, sentence) => {
    serve({ ...OK, 'POST /challenges/d-draw/claim': failure(status, code) })
    mount()
    fireEvent.click(await claimButton())
    await waitFor(() => expect(lastToast()?.tone).toBe('error'))
    expect(lastToast()?.title).toBe(sentence)
    expect(lastToast()?.title).not.toMatch(/English text from the server/)
  })

  it('uses the shared sentences for the other failures (offline, too many requests...)', async () => {
    serve({ ...OK, 'POST /challenges/d-draw/claim': failure(429, 'rate_limited') })
    mount()
    fireEvent.click(await claimButton())
    await waitFor(() => expect(lastToast()?.title).toBe(en.errors.api.rate_limited))
  })

  it('falls back to the generic sentence for a code nobody knows', async () => {
    serve({ ...OK, 'POST /challenges/d-draw/claim': failure(400, 'something_new') })
    mount()
    fireEvent.click(await claimButton())
    await waitFor(() => expect(lastToast()?.title).toBe(en.common.errorGeneric))
  })

  it('refreshes the challenges after a refused claim, so a stale “claim” button goes away', async () => {
    // someone claimed it on another device: the page still shows the button until it asks again
    let claimed = false
    serve({
      ...OK,
      'GET /challenges': () => json(200, [{ ...CHALLENGE, claimed }]),
      'POST /challenges/d-draw/claim': () => {
        claimed = true
        return failure(409, 'already_claimed')
      },
    })
    mount()
    fireEvent.click(await claimButton())
    expect(await within(section(en.achievements.challenges)).findByText(en.achievements.claimed)).toBeInTheDocument()
  })
})

describe('AchievementsPage — a guest', () => {
  it('asks the server nothing (the route sends guests to sign in; this is the second lock)', async () => {
    act(() => useSession.setState({ user: GUEST, token: null }))
    serve(OK)
    fetchMock.mockClear() // the sign-in of the line above `beforeEach` made the app fetch the account's learning
    mount()
    await act(async () => {})
    expect(calls()).toEqual([])
  })
})
