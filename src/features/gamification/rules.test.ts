import type { ScoreResult } from '@/types'
import {
  applyEvent,
  evaluateBadges,
  levelFromXp,
  levelProgress,
  liveStreak,
  rankForLevel,
  updateStreak,
  xpForLevel,
  xpForScore,
  activeChallenges,
  type RulesContext,
} from './rules'
import { emptyProgress, type ProgressEvent } from './types'

const ctx = (iso = '2026-10-21T15:00:00'): RulesContext => ({
  now: new Date(iso),
  totals: { lessons: 26, movements: 31, artForms: 20, categories: 9 },
})

const score = (overall: number, colour = overall): ScoreResult => ({
  artworkId: 'a',
  similarity: overall,
  colour,
  overall,
  sub: { lineAccuracy: overall, composition: overall, proportion: overall, harmony: colour, suitability: colour, aesthetics: colour },
  rank: 'steady',
  strengths: [],
  weaknesses: [],
  feedback: [],
  tips: [],
  judgeNote: { en: '', vi: '' },
  scoredAt: '',
})

const scored = (overall: number, extra: Partial<Extract<ProgressEvent, { type: 'artworkScored' }>> = {}): ProgressEvent => ({
  type: 'artworkScored',
  score: score(overall),
  templateId: 'fox',
  category: 'animals',
  seconds: 600,
  isDaily: false,
  distinctHues: 4,
  ...extra,
})

describe('xp & levels', () => {
  it('rewards better scores with more XP', () => {
    expect(xpForScore(0)).toBe(10)
    expect(xpForScore(50)).toBeLessThan(xpForScore(80))
    expect(xpForScore(90)).toBeGreaterThan(xpForScore(84) + 25)
    expect(xpForScore(150)).toBe(xpForScore(100))
  })

  it('maps xp to levels monotonically', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(xpForLevel(2) - 1)).toBe(1)
    expect(levelFromXp(xpForLevel(2))).toBe(2)
    expect(levelFromXp(xpForLevel(10) + 5)).toBe(10)
    for (let xp = 0; xp < 20000; xp += 137) expect(levelFromXp(xp + 137)).toBeGreaterThanOrEqual(levelFromXp(xp))
  })

  it('reports progress within a level', () => {
    const p = levelProgress(xpForLevel(3) + 50)
    expect(p.level).toBe(3)
    expect(p.current).toBe(50)
    expect(p.ratio).toBeGreaterThan(0)
    expect(p.ratio).toBeLessThan(1)
  })

  it('assigns ranks by level', () => {
    expect(rankForLevel(1).id).toBe('doodler')
    expect(rankForLevel(5).id).toBe('colourist')
    expect(rankForLevel(99).id).toBe('grandmaster')
  })
})

describe('streaks', () => {
  const base = emptyProgress().streak
  it('starts, extends and resets', () => {
    let s = updateStreak(base, '2026-10-01').streak
    expect(s.current).toBe(1)
    s = updateStreak(s, '2026-10-02').streak
    expect(s.current).toBe(2)
    expect(updateStreak(s, '2026-10-02').extended).toBe(false)
    s = updateStreak({ ...s, freezes: 0 }, '2026-10-05').streak
    expect(s.current).toBe(1)
    expect(s.longest).toBe(2)
  })

  it('spends a freeze token to bridge one missed day', () => {
    const s = updateStreak({ ...base, current: 4, longest: 4, lastDay: '2026-10-01', freezes: 1 }, '2026-10-03').streak
    expect(s.current).toBe(5)
    expect(s.freezes).toBe(0)
    expect(s.frozenDays).toEqual(['2026-10-02'])
  })

  it('shows a broken streak as 0', () => {
    expect(liveStreak({ ...base, current: 6, lastDay: '2026-10-01', freezes: 0 }, '2026-10-05')).toBe(0)
    expect(liveStreak({ ...base, current: 6, lastDay: '2026-10-04' }, '2026-10-05')).toBe(6)
  })
})

describe('badges', () => {
  it('unlocks First Stroke after the first artwork', () => {
    const { data, reward } = applyEvent(emptyProgress(), scored(55), ctx())
    expect(reward.newBadges).toContain('first-stroke')
    expect(data.badges['first-stroke']).toBeDefined()
    // never awarded twice
    expect(applyEvent(data, scored(55), ctx()).reward.newBadges).not.toContain('first-stroke')
  })

  it('awards Perfectionist for 95+ and First Masterpiece for 90+', () => {
    const { reward } = applyEvent(emptyProgress(), scored(96), ctx())
    expect(reward.newBadges).toEqual(expect.arrayContaining(['perfectionist', 'first-masterpiece', 'gallery-worthy', 'rising-brush']))
  })

  it('needs three 80+ scores in a row for Hot Streak', () => {
    let d = emptyProgress()
    d = applyEvent(d, scored(85), ctx()).data
    d = applyEvent(d, scored(70), ctx()).data
    d = applyEvent(d, scored(81), ctx()).data
    d = applyEvent(d, scored(82), ctx()).data
    expect(d.badges['hot-streak']).toBeUndefined()
    const r = applyEvent(d, scored(88), ctx())
    expect(r.reward.newBadges).toContain('hot-streak')
  })

  it('detects secret badges from time and score', () => {
    expect(applyEvent(emptyProgress(), scored(77), ctx('2026-10-21T02:30:00')).reward.newBadges).toEqual(
      expect.arrayContaining(['night-owl', 'lucky-sevens']),
    )
    expect(applyEvent(emptyProgress(), scored(5), ctx()).reward.newBadges).toContain('bold-minimalist')
  })

  it('evaluateBadges is pure and ignores owned badges', () => {
    const d = { ...emptyProgress(), badges: { 'first-stroke': 'x' } }
    d.stats = { ...d.stats, artworks: 1 }
    expect(evaluateBadges(d, scored(10), ctx())).not.toContain('first-stroke')
  })

  it('counts unique movements for Time Traveller', () => {
    let d = emptyProgress()
    const small = { ...ctx(), totals: { ...ctx().totals, movements: 2 } }
    d = applyEvent(d, { type: 'viewed', what: 'movement', slug: 'cubism' }, small).data
    d = applyEvent(d, { type: 'viewed', what: 'movement', slug: 'cubism' }, small).data
    expect(d.stats.movementsViewed).toHaveLength(1)
    expect(applyEvent(d, { type: 'viewed', what: 'movement', slug: 'pop-art' }, small).reward.newBadges).toContain('time-traveller')
  })
})

describe('rewards & challenges', () => {
  it('reports level-ups in the reward summary', () => {
    const d = { ...emptyProgress(), xp: xpForLevel(2) - 5 }
    const { reward } = applyEvent(d, scored(80), ctx())
    expect(reward.levelBefore).toBe(1)
    expect(reward.levelAfter).toBeGreaterThanOrEqual(2)
    expect(reward.xpAfter - reward.xpBefore).toBe(reward.xpGained)
  })

  it('extends the streak on creative activity only', () => {
    expect(applyEvent(emptyProgress(), scored(50), ctx()).reward.streakExtended).toBe(true)
    expect(applyEvent(emptyProgress(), { type: 'chatMessage' }, ctx()).reward.streakExtended).toBe(false)
  })

  it('has one daily, three weekly and one special challenge', () => {
    const a = activeChallenges(new Date('2026-10-21T10:00:00'))
    expect(a.filter((c) => c.challenge.kind === 'daily')).toHaveLength(1)
    expect(a.filter((c) => c.challenge.kind === 'weekly')).toHaveLength(3)
    expect(a.filter((c) => c.challenge.kind === 'special')).toHaveLength(1)
    expect(new Set(a.map((c) => c.challenge.id)).size).toBe(5)
  })

  it('keeps one key for a special event that runs across New Year', () => {
    const special = (iso: string) => activeChallenges(new Date(iso)).find((c) => c.challenge.kind === 'special')!
    const dec = special('2026-12-20T10:00:00')
    const jan = special('2027-01-02T10:00:00')
    expect(dec.challenge.id).toBe(jan.challenge.id)
    expect(jan.periodKey).toBe(dec.periodKey) // same season, same key: progress and claims carry over
    expect(special('2027-12-05T10:00:00').periodKey).not.toBe(dec.periodKey) // next winter is a new one
    // an event inside a single year is untouched
    expect(special('2026-10-21T10:00:00').periodKey).toMatch(/^2026-/)
  })

  it('progresses and completes matching challenges', () => {
    const now = new Date('2026-10-21T10:00:00')
    const daily = activeChallenges(now)[0]
    let d = emptyProgress()
    let completed: string[] = []
    for (let i = 0; i < daily.challenge.target + 1; i++) {
      const ev: ProgressEvent =
        daily.challenge.metric === 'lessons'
          ? { type: 'lessonCompleted', slug: `l${i}`, xp: 10 }
          : daily.challenge.metric === 'freeDraws'
            ? { type: 'artworkSaved', kind: 'free', seconds: 60 }
            : scored(90, { isDaily: true })
      const r = applyEvent(d, ev, { ...ctx(), now })
      d = r.data
      completed = completed.concat(r.reward.completedChallenges)
    }
    expect(completed).toContain(daily.challenge.id)
  })
})
