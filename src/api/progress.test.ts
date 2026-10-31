import { emptyProgress } from '@/features/gamification/types'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { recordActivity, syncProgress } from './progress'

const fetchMock = vi.fn()

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const REWARD = {
  xpGained: 5,
  xpBefore: 100,
  xpAfter: 105,
  levelBefore: 1,
  levelAfter: 1,
  newBadges: [],
  streak: 2,
  streakExtended: false,
  completedChallenges: [],
}

// what GET /me/progress sends (it has `level` and `streak.live`, which the app works out itself)
const SERVER = () => {
  const base = emptyProgress()
  return {
    xp: 105,
    level: { level: 1, current: 105, needed: 200, ratio: 0.5 },
    badges: { 'first-stroke': '2026-10-31T08:00:00Z' },
    streak: { current: 2, longest: 3, lastDay: '2026-10-31', freezes: 0, frozenDays: ['2026-10-29'], live: 2 },
    activity: { '2026-10-31': 2 },
    stats: { ...base.stats, artworks: 2, downloads: 1, templatesTried: ['fox'] },
    scoreHistory: [{ at: '2026-10-31T08:00:00Z', overall: 80, similarity: 70, colour: 90, artworkId: 'a1' }],
  }
}

const urls = () => fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${c[0]}`)

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useProgress.getState().reset()
  useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('syncProgress (GET /me/progress)', () => {
  it("makes the device's numbers the account's numbers", async () => {
    fetchMock.mockResolvedValue(json(200, SERVER()))
    await syncProgress()
    const s = useProgress.getState()
    expect(urls()).toEqual(['GET /api/v1/me/progress'])
    expect(s.xp).toBe(105)
    expect(s.badges).toEqual({ 'first-stroke': '2026-10-31T08:00:00Z' })
    expect(s.activity).toEqual({ '2026-10-31': 2 })
    expect(s.stats.artworks).toBe(2)
    expect(s.stats.templatesTried).toEqual(['fox'])
    expect(s.scoreHistory).toHaveLength(1)
    expect(s.streak).toEqual({ current: 2, longest: 3, lastDay: '2026-10-31', freezes: 0, frozenDays: ['2026-10-29'] })
  })

  it('does not copy what the app does not keep (level, streak.live)', async () => {
    fetchMock.mockResolvedValue(json(200, SERVER()))
    await syncProgress()
    const s = useProgress.getState()
    expect('level' in s.streak).toBe(false)
    expect('live' in s.streak).toBe(false)
  })

  it('leaves the challenges alone: the server does not send them here', async () => {
    useProgress.setState({ challenges: { 'daily@2026-10-31': { progress: 1, claimed: false } } })
    fetchMock.mockResolvedValue(json(200, SERVER()))
    await syncProgress()
    expect(useProgress.getState().challenges).toEqual({ 'daily@2026-10-31': { progress: 1, claimed: false } })
  })

  it('does nothing for a guest (no account to ask)', async () => {
    useSession.setState({ user: GUEST, token: null })
    await syncProgress()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps what the device had when the server cannot be reached, and says so', async () => {
    useProgress.setState({ xp: 42 })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(syncProgress()).rejects.toMatchObject({ code: 'network_error' })
    expect(useProgress.getState().xp).toBe(42)
  })
})

describe('syncProgress: answers that arrive at the wrong time', () => {
  const later = () => {
    let done!: (r: Response) => void
    const p = new Promise<Response>((res) => (done = res))
    return { p, done }
  }

  it('keeps the newest answer when an older one arrives after it', async () => {
    const first = later()
    const second = later()
    fetchMock.mockReturnValueOnce(first.p).mockReturnValueOnce(second.p)
    const a = syncProgress()
    const b = syncProgress()
    second.done(json(200, { ...SERVER(), xp: 300 }))
    await b
    first.done(json(200, { ...SERVER(), xp: 100 }))
    await a
    expect(useProgress.getState().xp).toBe(300)
  })

  it('drops an answer meant for someone who has signed out or been replaced', async () => {
    const slow = later()
    fetchMock.mockReturnValueOnce(slow.p)
    const pending = syncProgress()
    useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
    slow.done(json(200, SERVER()))
    await pending
    expect(useProgress.getState().xp).toBe(0)
  })

  it('refuses an answer that is not progress, rather than emptying what is shown', async () => {
    useProgress.setState({ xp: 42 })
    fetchMock.mockResolvedValue(json(200, { id: 'something-else' }))
    await expect(syncProgress()).rejects.toMatchObject({ code: 'server_error' })
    expect(useProgress.getState().xp).toBe(42)
    expect(useProgress.getState().stats).toBeDefined()
  })
})

describe('recordActivity: what the account decides', () => {
  it('reports a download to the server and shows the reward the server gives', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/progress/events') ? json(200, REWARD) : json(200, SERVER())))
    const reward = await recordActivity({ type: 'download' })
    expect(reward).toEqual(REWARD)
    const [first] = fetchMock.mock.calls as [string, RequestInit][]
    expect(first[0]).toBe('/api/v1/progress/events')
    expect(first[1].method).toBe('POST')
    expect(JSON.parse(first[1].body as string)).toEqual({ type: 'download' })
  })

  it('then brings the numbers up to date (one XP, never counted twice)', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/progress/events') ? json(200, REWARD) : json(200, SERVER())))
    await recordActivity({ type: 'download' })
    expect(urls()).toEqual(['POST /api/v1/progress/events', 'GET /api/v1/me/progress'])
    expect(useProgress.getState().xp).toBe(105) // the server's total, not 0 + 5 on this device
    expect(useProgress.getState().stats.downloads).toBe(1)
  })

  it('still gives the reward when only the refresh afterwards fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/progress/events')) return json(200, REWARD)
      throw new TypeError('Failed to fetch')
    })
    await expect(recordActivity({ type: 'download' })).resolves.toEqual(REWARD)
  })

  it.each([
    ['the daily event limit', () => json(429, { error: { code: 'rate_limited', message: 'Slow down' } })],
    ['a server fault', () => json(500, { error: { code: 'internal_error', message: 'x' } })],
  ])('a download refused by %s earns nothing and fails quietly (the file was already saved)', async (_n, answer) => {
    useProgress.setState({ xp: 42 })
    fetchMock.mockImplementation(async () => answer())
    const reward = await recordActivity({ type: 'download' })
    expect(reward).toMatchObject({ xpGained: 0, xpBefore: 42, xpAfter: 42, newBadges: [], completedChallenges: [], streakExtended: false })
    expect(useProgress.getState().xp).toBe(42) // nothing was added on this device either
  })

  it('a download while offline earns nothing and fails quietly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(recordActivity({ type: 'download' })).resolves.toMatchObject({ xpGained: 0 })
  })

  it.each([
    ['artworkSaved', { type: 'artworkSaved', kind: 'free', seconds: 10 }],
    ['artworkScored', { type: 'artworkScored' }],
  ] as const)('never reports %s itself: the server decides it when the drawing is saved or scored', async (_n, ev) => {
    await expect(recordActivity(ev as never)).rejects.toMatchObject({ code: 'event_not_allowed' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useProgress.getState().xp).toBe(0)
  })
})

describe('recordActivity: what is not on the account yet stays on this device', () => {
  it('counts a glossary visit locally and asks nobody', async () => {
    const reward = await recordActivity({ type: 'glossary' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useProgress.getState().stats.glossaryOpened).toBe(1)
    expect(reward.xpGained).toBeGreaterThanOrEqual(0)
  })

  it('does the same for a guest, download included (there is no account to tell)', async () => {
    useSession.setState({ user: GUEST, token: null })
    await recordActivity({ type: 'download' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useProgress.getState().stats.downloads).toBe(1)
  })
})
