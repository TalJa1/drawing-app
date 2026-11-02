import { emptyProgress } from '@/features/gamification/types'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { claimChallenge, getAchievements, getChallenges, getLeaderboard, recordActivity, syncProgress } from './progress'

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

describe('recordActivity: the events the server counts (type B)', () => {
  const EVENTS = [
    { type: 'download' },
    { type: 'glossary' },
    { type: 'colorLab' },
    { type: 'paletteSent' },
    { type: 'viewed', what: 'movement', slug: 'cubism' },
    { type: 'flashcardReviewed', count: 7 },
    { type: 'spotStyle', streak: 4 },
  ] as const

  it.each(EVENTS)('reports %o to the server, exactly as it is, and shows the server reward', async (ev) => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/progress/events') ? json(200, REWARD) : json(200, SERVER())))
    const reward = await recordActivity(ev)
    expect(reward).toEqual(REWARD)
    const [first] = fetchMock.mock.calls as [string, RequestInit][]
    expect(first[0]).toBe('/api/v1/progress/events')
    expect(first[1].method).toBe('POST')
    expect(JSON.parse(first[1].body as string)).toEqual(ev) // nothing added (no xp), nothing left out
    expect(urls()).toEqual(['POST /api/v1/progress/events', 'GET /api/v1/me/progress'])
  })

  it.each(EVENTS)('%o counts on the account only: this device does not add it a second time', async (ev) => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/progress/events') ? json(200, REWARD) : json(200, SERVER())))
    await recordActivity(ev)
    expect(useProgress.getState().xp).toBe(105) // the server's total, not 0 + whatever the local rules say
    expect(useProgress.getState().stats.glossaryOpened).toBe(0)
  })

  it.each([
    ['refused (event limit)', () => json(429, { error: { code: 'rate_limited', message: 'Slow down' } })],
    ['refused (not valid)', () => json(422, { error: { code: 'validation_error', message: 'x' } })],
    ['a server fault', () => json(500, { error: { code: 'internal_error', message: 'x' } })],
  ])('an event that is %s earns nothing and fails quietly', async (_n, answer) => {
    useProgress.setState({ xp: 42 })
    fetchMock.mockImplementation(async () => answer())
    const reward = await recordActivity({ type: 'viewed', what: 'artist', slug: 'monet' })
    expect(reward).toMatchObject({ xpGained: 0, xpBefore: 42, xpAfter: 42, newBadges: [], completedChallenges: [] })
    expect(useProgress.getState().xp).toBe(42)
    expect(useProgress.getState().stats.artistsViewed).toEqual([]) // not counted on the device instead
  })

  it('offline: earns nothing and fails quietly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(recordActivity({ type: 'colorLab' })).resolves.toMatchObject({ xpGained: 0 })
  })
})

describe('recordActivity: what is not on the account yet stays on this device', () => {
  it.each([
    ['a chat message (the server refuses it: the chat is outside the backend)', { type: 'chatMessage' }],
    ['a lesson (lot 4c)', { type: 'lessonCompleted', slug: 'rule-of-thirds', xp: 40 }],
    ['a quiz (lot 4c)', { type: 'quizCompleted', slug: 'rule-of-thirds', correct: 3, total: 3 }],
  ] as const)('counts %s locally and asks nobody', async (_n, ev) => {
    await recordActivity(ev)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useProgress.getState().xp).toBeGreaterThanOrEqual(0)
  })

  it('counts a chat message on the device', async () => {
    await recordActivity({ type: 'chatMessage' })
    expect(useProgress.getState().stats.chatMessages).toBe(1)
  })

  it.each([{ type: 'download' }, { type: 'glossary' }, { type: 'viewed', what: 'movement', slug: 'cubism' }] as const)(
    'does the same for a guest, %o included (there is no account to tell)',
    async (ev) => {
      useSession.setState({ user: GUEST, token: null })
      await recordActivity(ev)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('a guest download is counted on the device', async () => {
    useSession.setState({ user: GUEST, token: null })
    await recordActivity({ type: 'download' })
    expect(useProgress.getState().stats.downloads).toBe(1)
  })
})

/* ---------- challenges, achievements, leaderboard (lot 4b) ---------- */
const CHALLENGE = {
  challenge: {
    id: 'd-free',
    kind: 'daily',
    title: { en: 'Free spirit', vi: 'Tự do' },
    description: { en: 'Make one free drawing', vi: 'Vẽ một bức tự do' },
    metric: 'freeDraws',
    target: 1,
    xp: 40,
    icon: 'brush',
  },
  periodKey: '2026-11-02',
  progress: 1,
  claimed: false,
}
const answerWith = (map: Record<string, () => Response>) =>
  fetchMock.mockImplementation(async (url: string) => {
    const key = Object.keys(map).find((k) => url.includes(k))
    if (!key) throw new Error(`unexpected request ${url}`)
    return map[key]()
  })

describe('getChallenges (GET /challenges)', () => {
  it("asks the server for the account's challenges and returns them as they are", async () => {
    answerWith({ '/challenges': () => json(200, [CHALLENGE, { ...CHALLENGE, periodKey: '2026-W44', theme: ['animals'] }]) })
    const list = await getChallenges()
    expect(urls()).toEqual(['GET /api/v1/challenges'])
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual(CHALLENGE)
    expect(list[1].theme).toEqual(['animals'])
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-1')
  })

  it('does not fall back to made-up progress when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getChallenges()).rejects.toBeTruthy()
  })
})

describe('claimChallenge (POST /challenges/:id/claim)', () => {
  it('sends only the period, gets the reward the server decided, then refreshes the numbers', async () => {
    answerWith({
      '/claim': () => json(200, { ...REWARD, xpGained: 40, completedChallenges: ['d-free'] }),
      '/me/progress': () => json(200, SERVER()),
    })
    const reward = await claimChallenge('d-free', '2026-11-02')
    expect(reward.xpGained).toBe(40)
    const [first] = fetchMock.mock.calls as [string, RequestInit][]
    expect(first[0]).toBe('/api/v1/challenges/d-free/claim')
    expect(first[1].method).toBe('POST')
    expect(JSON.parse(first[1].body as string)).toEqual({ periodKey: '2026-11-02' }) // never an xp from the client
    expect(urls()).toEqual(['POST /api/v1/challenges/d-free/claim', 'GET /api/v1/me/progress'])
    expect(useProgress.getState().xp).toBe(105)
  })

  it('writes the id safely into the path', async () => {
    answerWith({ '/claim': () => json(200, REWARD), '/me/progress': () => json(200, SERVER()) })
    await claimChallenge('a/b c', '2026-11-02')
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/v1/challenges/a%2Fb%20c/claim')
  })

  it.each([
    [409, 'already_claimed'],
    [422, 'incomplete'],
    [404, 'not_found'],
  ])('a %i (%s) is passed on and nothing is refreshed or paid', async (status, code) => {
    useProgress.setState({ xp: 42 })
    answerWith({ '/claim': () => json(status, { error: { code, message: 'x' } }) })
    await expect(claimChallenge('d-free', '2026-11-02')).rejects.toMatchObject({ code, status })
    expect(urls()).toEqual(['POST /api/v1/challenges/d-free/claim'])
    expect(useProgress.getState().xp).toBe(42)
  })

  it('still gives the reward when only the refresh afterwards fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/claim')) return json(200, REWARD)
      throw new TypeError('Failed to fetch')
    })
    await expect(claimChallenge('d-free', '2026-11-02')).resolves.toEqual(REWARD)
  })
})

describe('getAchievements (GET /achievements)', () => {
  it('returns every badge with the time it was unlocked, as the server sends them', async () => {
    const badges = [
      {
        id: 'first-stroke',
        name: { en: 'First stroke', vi: 'Nét đầu' },
        description: { en: 'a', vi: 'b' },
        category: 'creation',
        rarity: 'common',
        icon: 'x',
        xp: 10,
        unlockedAt: '2026-10-31T08:00:00Z',
      },
      {
        id: 'muse-friend',
        name: { en: 'Muse', vi: 'Muse' },
        description: { en: 'a', vi: 'b' },
        category: 'social',
        rarity: 'rare',
        icon: 'y',
        xp: 30,
        secret: true,
      },
    ]
    answerWith({ '/achievements': () => json(200, { badges }) })
    const res = await getAchievements()
    expect(urls()).toEqual(['GET /api/v1/achievements'])
    expect(res.badges).toEqual(badges)
  })

  it('does not take the unlocked badges from this device', async () => {
    useProgress.setState({ badges: { 'first-stroke': '2020-01-01T00:00:00Z' } })
    answerWith({ '/achievements': () => json(200, { badges: [] }) })
    expect((await getAchievements()).badges).toEqual([])
  })
})

describe('getLeaderboard (GET /leaderboard)', () => {
  const ENTRIES = [
    { id: '1', name: 'Mia', avatarSeed: 'a', xp: 900, weeklyXp: 120, level: 5 },
    { id: '2', name: 'Lan', avatarSeed: 'b', xp: 400, weeklyXp: 300, level: 3, isCurrentUser: true },
  ]

  it.each(['weekly', 'all'] as const)('asks for the %s ranking and returns it in the order the server gives', async (scope) => {
    answerWith({ '/leaderboard': () => json(200, ENTRIES) })
    const res = await getLeaderboard(scope)
    expect(urls()).toEqual([`GET /api/v1/leaderboard?scope=${scope}`])
    expect(res.map((e) => e.id)).toEqual(['1', '2'])
    expect(res[1].isCurrentUser).toBe(true)
  })

  it('has no invented people: an empty ranking stays empty', async () => {
    answerWith({ '/leaderboard': () => json(200, []) })
    expect(await getLeaderboard('all')).toEqual([])
  })

  it('does not mark anybody as a sample or give them a country', async () => {
    answerWith({ '/leaderboard': () => json(200, ENTRIES) })
    const [first] = await getLeaderboard('weekly')
    expect(first).not.toHaveProperty('sample')
    expect(first).not.toHaveProperty('country')
  })
})

describe('answers that are not what they should be', () => {
  it.each([
    ['challenges', () => getChallenges(), '/challenges', { oops: true }],
    ['the ranking', () => getLeaderboard('all'), '/leaderboard', 'nope'],
    ['achievements', () => getAchievements(), '/achievements', { badges: 'x' }],
    ['achievements (no badges)', () => getAchievements(), '/achievements', {}],
  ])('%s: something unreadable is an error, not an empty page', async (_n, call, path, body) => {
    answerWith({ [path]: () => json(200, body) })
    await expect(call()).rejects.toMatchObject({ code: 'server_error' })
  })
})
