import type { ArtworkAnalysis } from '@/types'
import { useCollection } from '@/store/collection'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { buildScore, computeSubScores, rankForScore, scoreArtwork } from './scoring'

const grid = (v: number) => Array.from({ length: 9 }, () => Array.from({ length: 12 }, () => v))

const empty: ArtworkAnalysis = {
  coverage: 0,
  spill: 0,
  lineTrace: 0,
  distinctHues: 0,
  dominant: [],
  harmony: 0,
  paletteMatch: 0,
  valueRange: 0,
  saturation: 0,
  inkAmount: 0,
  grid: grid(0),
  strokes: 0,
}

const great: ArtworkAnalysis = {
  coverage: 0.94,
  spill: 0.01,
  lineTrace: 0.8,
  distinctHues: 4,
  dominant: ['#e4572e', '#2f80c4'],
  harmony: 0.85,
  paletteMatch: 0.7,
  valueRange: 0.75,
  saturation: 0.55,
  inkAmount: 0.7,
  grid: grid(0.9),
  strokes: 300,
}

const messy: ArtworkAnalysis = { ...great, spill: 0.2, harmony: 0.3, distinctHues: 9, valueRange: 0.2, saturation: 0.95 }
const half: ArtworkAnalysis = { ...great, coverage: 0.45, grid: grid(0.4) }

describe('scoring heuristics', () => {
  it('gives an empty canvas a very low score', () => {
    const s = buildScore('empty-1', empty)
    expect(s.overall).toBeLessThan(20)
    expect(s.colour).toBeLessThan(5)
    expect(s.rank).toBe('starter')
  })

  it('gives a well-coloured drawing a high score (≥ 85)', () => {
    const s = buildScore('great-1', great)
    expect(s.overall).toBeGreaterThanOrEqual(85)
  })

  it('ranks great > half-done > empty, and great > messy', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const g = buildScore(seed, great).overall
      const h = buildScore(seed, half).overall
      const e = buildScore(seed, empty).overall
      const m = buildScore(seed, messy).overall
      expect(g).toBeGreaterThan(h)
      expect(h).toBeGreaterThan(e)
      expect(g).toBeGreaterThan(m)
    }
  })

  it('is deterministic per artwork id (jitter is seeded)', () => {
    expect(computeSubScores(great, 'x')).toEqual(computeSubScores(great, 'x'))
  })

  it('keeps every sub-score within 0–100', () => {
    for (const a of [empty, great, messy, half]) {
      for (const v of Object.values(computeSubScores(a, 'z'))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('always returns three tips and a judge note', () => {
    for (const a of [empty, great, messy]) {
      const s = buildScore('t', a)
      expect(s.tips).toHaveLength(3)
      expect(s.judgeNote.en.length).toBeGreaterThan(5)
      expect(s.strengths.length).toBeGreaterThan(0)
    }
  })

  it('maps rank labels to the spec thresholds', () => {
    expect(rankForScore(39)).toBe('starter')
    expect(rankForScore(40)).toBe('rising')
    expect(rankForScore(60)).toBe('steady')
    expect(rankForScore(75)).toBe('gallery')
    expect(rankForScore(90)).toBe('masterpiece')
  })
})

describe('scoreArtwork (POST /artworks/:id/score)', () => {
  const fetchMock = vi.fn()
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const ID = '3f1c2a64-8e1b-4f0e-9a55-0b8d2c1e7a10'
  const loc = (t: string) => ({ en: t, vi: t })
  const REWARD = {
    xpGained: 60,
    xpBefore: 100,
    xpAfter: 160,
    levelBefore: 1,
    levelAfter: 1,
    newBadges: ['first-score'],
    streak: 1,
    streakExtended: true,
    completedChallenges: [],
  }
  const SCORED = {
    artworkId: ID,
    similarity: 70,
    colour: 80,
    overall: 74,
    sub: { lineAccuracy: 70, composition: 70, proportion: 70, harmony: 80, suitability: 80, aesthetics: 80 },
    rank: 'steady',
    strengths: [loc('s')],
    weaknesses: [loc('w')],
    feedback: [loc('f')],
    tips: [loc('t1'), loc('t2'), loc('t3')],
    judgeNote: loc('note'),
    scoredAt: '2026-10-31T08:00:00Z',
    reward: REWARD,
  }
  const PROGRESS = {
    xp: 160,
    level: { level: 1, current: 160, needed: 200, ratio: 0.8 },
    badges: {},
    streak: { current: 1, longest: 1, lastDay: '2026-10-31', freezes: 1, frozenDays: [], live: 1 },
    activity: {},
    stats: useProgress.getState().stats,
    scoreHistory: [],
  }
  const route = (scored: Response = json(200, SCORED)) =>
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/score') ? scored : json(200, PROGRESS)))

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    useProgress.getState().reset()
    useCollection.setState({ artworks: [] })
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('asks the server to judge, with no body (it judges the saved drawing itself)', async () => {
    route()
    await scoreArtwork(ID)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/v1/artworks/${ID}/score`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-1')
  })

  it('gives the score and, apart from it, the reward', async () => {
    route()
    const out = await scoreArtwork(ID)
    expect(out.reward).toEqual(REWARD)
    expect(out.score).toMatchObject({ artworkId: ID, overall: 74, rank: 'steady', similarity: 70, colour: 80 })
    expect('reward' in out.score).toBe(false)
  })

  it("then brings the account's numbers up to date", async () => {
    route()
    await scoreArtwork(ID)
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([`/api/v1/artworks/${ID}/score`, '/api/v1/me/progress'])
    expect(useProgress.getState().xp).toBe(160)
  })

  it('still gives the score when only the refresh afterwards fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/score')) return json(200, SCORED)
      throw new TypeError('Failed to fetch')
    })
    await expect(scoreArtwork(ID)).resolves.toMatchObject({ reward: REWARD })
  })

  it('does not wait for a made-up delay (the server answers when it has judged)', async () => {
    vi.useFakeTimers() // with fake timers any sleep would never end, and this test would time out
    route()
    await expect(scoreArtwork(ID)).resolves.toBeDefined()
  })

  it('keeps nothing on this device and never judges here', async () => {
    route()
    await scoreArtwork(ID)
    expect(useCollection.getState().artworks).toEqual([])
  })

  it.each([
    [422, 'missing_analysis'],
    [422, 'not_scorable'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [501, 'scoring_not_configured'],
  ])('passes %i %s on with its code', async (status, code) => {
    route(json(status, { error: { code, message: 'x' } }))
    await expect(scoreArtwork(ID)).rejects.toMatchObject({ status, code })
    expect(useProgress.getState().xp).toBe(0)
  })
})
