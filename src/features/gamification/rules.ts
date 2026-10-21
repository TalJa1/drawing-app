/* ------------------------------------------------------------------
   Gamification rules — pure functions only (no stores, no Date.now()).
   A real back-end can run exactly the same logic server-side.
   ------------------------------------------------------------------ */
import type { Challenge, RewardSummary } from '@/types'
import { addDays, dayKey, daysBetween, weekKey } from '@/lib/date'
import { hashString } from '@/lib/random'
import { BADGES, BADGE_MAP } from '@/mocks/badges'
import { DAILY_POOL, RANKS, SPECIAL_EVENTS, WEEKLY_POOL } from '@/mocks/challenges'
import type { ProgressData, ProgressEvent, StreakState } from './types'

export interface RulesContext {
  now: Date
  totals: { lessons: number; movements: number; artForms: number; categories: number }
}

/* ---------- XP & levels ---------- */

export function xpForScore(score: number): number {
  const s = Math.max(0, Math.min(100, score))
  let xp = Math.round(10 + s * 0.9)
  if (s >= 85) xp += 25
  if (s >= 95) xp += 50
  return xp
}

/** Total XP needed to *reach* a level. Level 1 starts at 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return 50 * (level - 1) * (level + 2)
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export function levelProgress(xp: number): {
  level: number
  current: number
  needed: number
  ratio: number
} {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, current: xp - base, needed: next - base, ratio: (xp - base) / (next - base) }
}

export function rankForLevel(level: number) {
  let r = RANKS[0]
  for (const rank of RANKS) if (level >= rank.minLevel) r = rank
  return r
}

export function nextRank(level: number) {
  return RANKS.find((r) => r.minLevel > level) ?? null
}

/* ---------- Streaks ---------- */

export function updateStreak(s: StreakState, today: string): { streak: StreakState; extended: boolean } {
  if (s.lastDay === today) return { streak: s, extended: false }
  if (!s.lastDay) {
    const current = 1
    return { streak: { ...s, current, longest: Math.max(s.longest, current), lastDay: today }, extended: true }
  }
  const gap = daysBetween(s.lastDay, today)
  let current: number
  let freezes = s.freezes
  let frozenDays = s.frozenDays
  if (gap === 1) current = s.current + 1
  else if (gap === 2 && s.freezes > 0) {
    current = s.current + 1
    freezes -= 1
    frozenDays = [...frozenDays, addDays(s.lastDay, 1)]
  } else current = 1
  return {
    streak: { ...s, current, freezes, frozenDays, longest: Math.max(s.longest, current), lastDay: today },
    extended: true,
  }
}

/** Current streak as displayed today (it is broken if yesterday was missed). */
export function liveStreak(s: StreakState, today: string): number {
  if (!s.lastDay) return 0
  const gap = daysBetween(s.lastDay, today)
  if (gap <= 1) return s.current
  if (gap === 2 && s.freezes > 0) return s.current
  return 0
}

/* ---------- Challenges ---------- */

export interface ActiveChallenge {
  challenge: Challenge
  periodKey: string
  /** for specials: palette theme */
  theme?: string[]
}

export function activeChallenges(now: Date): ActiveChallenge[] {
  const day = dayKey(now)
  const week = weekKey(now)
  const daily = DAILY_POOL[hashString(day) % DAILY_POOL.length]
  const wh = hashString(week)
  const weekly: Challenge[] = []
  for (let i = 0; weekly.length < 3 && i < WEEKLY_POOL.length * 2; i++) {
    const cand = WEEKLY_POOL[(wh + i * 7) % WEEKLY_POOL.length]
    if (!weekly.includes(cand)) weekly.push(cand)
  }
  const month = now.getMonth()
  const special = SPECIAL_EVENTS.find((e) => e.months.includes(month)) ?? SPECIAL_EVENTS[0]
  return [
    { challenge: daily, periodKey: day },
    ...weekly.map((w) => ({ challenge: w, periodKey: week })),
    { challenge: special, periodKey: `${now.getFullYear()}-${special.id}`, theme: special.theme },
  ]
}

export const challengeKey = (a: ActiveChallenge) => `${a.challenge.id}@${a.periodKey}`

function challengeIncrement(ch: Challenge, e: ProgressEvent): number {
  switch (ch.metric) {
    case 'artworks':
      return e.type === 'artworkScored' || (e.type === 'artworkSaved' && e.kind === 'free') ? 1 : 0
    case 'practiceArtworks':
      return e.type === 'artworkScored' ? 1 : 0
    case 'highScores':
      return e.type === 'artworkScored' && e.score.overall >= 80 ? 1 : 0
    case 'lessons':
      return e.type === 'lessonCompleted' ? 1 : 0
    case 'quizzes':
      return e.type === 'quizCompleted' && e.correct / e.total >= 0.6 ? 1 : 0
    case 'freeDraws':
      return e.type === 'artworkSaved' && e.kind === 'free' ? 1 : 0
    case 'colourScore':
      return e.type === 'artworkScored' && e.score.colour >= Number(ch.param ?? 75) ? 1 : 0
    case 'templateCategory':
      return e.type === 'artworkScored' && e.category === ch.param ? 1 : 0
    case 'chat':
      return e.type === 'chatMessage' ? 1 : 0
    case 'dailyTemplate':
      return e.type === 'artworkScored' && e.isDaily ? 1 : 0
  }
}

/* ---------- Badges ---------- */

type BadgeRule = (d: ProgressData, e: ProgressEvent, ctx: RulesContext) => boolean

const scored = (e: ProgressEvent) => (e.type === 'artworkScored' ? e : null)
const isCreative = (e: ProgressEvent) => e.type === 'artworkScored' || e.type === 'artworkSaved'

export const BADGE_RULES: Record<string, BadgeRule> = {
  'first-stroke': (d) => d.stats.artworks >= 1,
  'sketchbook-habit': (d) => d.stats.artworks >= 5,
  prolific: (d) => d.stats.artworks >= 25,
  century: (d) => d.stats.artworks >= 100,
  'free-spirit': (d) => d.stats.freeDraws >= 1,
  'template-tourist': (d) => d.stats.categoriesTried.length >= 5,
  'grand-tour': (d, _e, ctx) => d.stats.categoriesTried.length >= ctx.totals.categories,
  'daily-devotee': (d) => d.stats.dailyChallenges >= 5,
  'speed-painter': (_d, e) => {
    const s = scored(e)
    return !!s && s.seconds > 0 && s.seconds < 300 && s.score.overall >= 60
  },
  marathon: (d) => d.stats.totalSeconds >= 5 * 3600,
  'rising-brush': (d) => d.stats.bestScore >= 60,
  'gallery-worthy': (d) => d.stats.bestScore >= 75,
  'first-masterpiece': (d) => d.stats.masterpieces >= 1,
  'ten-masterpieces': (d) => d.stats.masterpieces >= 10,
  perfectionist: (d) => d.stats.perfect >= 1,
  'hot-streak': (d) => d.stats.scoreRun >= 3,
  'on-fire': (d) => d.stats.scoreRun >= 5,
  comeback: (d) => d.stats.bigComeback,
  'warm-up': (d) => d.streak.longest >= 3,
  'week-warrior': (d) => d.streak.longest >= 7,
  fortnight: (d) => d.streak.longest >= 14,
  'moon-cycle': (d) => d.streak.longest >= 30,
  'weekend-artist': (d) => d.stats.weekendDraws >= 1,
  'first-lesson': (d) => d.stats.lessonsCompleted >= 1,
  bookworm: (d) => d.stats.lessonsCompleted >= 10,
  scholar: (d, _e, ctx) => d.stats.lessonsCompleted >= ctx.totals.lessons,
  'quiz-starter': (d) => d.stats.quizzesPassed >= 1,
  'quiz-champion': (d) => d.stats.perfectQuizzes >= 5,
  'flash-memory': (d) => d.stats.flashcardsReviewed >= 50,
  'style-spotter': (d) => d.stats.spotStyleBest >= 5,
  'eagle-eye': (d) => d.stats.spotStyleBest >= 15,
  'colour-whisperer': (d) => d.stats.colourHigh >= 5,
  'colour-curious': (d) => d.stats.colorLabUses >= 1,
  'palette-courier': (d) => d.stats.palettesSent >= 3,
  rainbow: (_d, e) => {
    const s = scored(e)
    return !!s && s.distinctHues >= 7
  },
  monochrome: (_d, e) => {
    const s = scored(e)
    return !!s && s.distinctHues <= 2 && s.score.overall >= 75
  },
  'time-traveller': (d, _e, ctx) => d.stats.movementsViewed.length >= ctx.totals.movements,
  'explorer-of-forms': (d, _e, ctx) => d.stats.artFormsViewed.length >= ctx.totals.artForms,
  'portrait-gallery': (d) => d.stats.artistsViewed.length >= 10,
  'muse-friend': (d) => d.stats.chatMessages >= 10,
  curator: (d) => d.stats.downloads >= 5,
  'word-collector': (d) => d.stats.glossaryOpened >= 1,
  'night-owl': (_d, e, ctx) => isCreative(e) && ctx.now.getHours() < 5,
  'early-bird': (_d, e, ctx) => isCreative(e) && ctx.now.getHours() >= 5 && ctx.now.getHours() < 7,
  'bold-minimalist': (_d, e) => {
    const s = scored(e)
    return !!s && s.score.overall < 15
  },
  'lucky-sevens': (_d, e) => {
    const s = scored(e)
    return !!s && s.score.overall === 77
  },
}

/** Returns ids of badges that become unlocked by this event (not already owned). */
export function evaluateBadges(d: ProgressData, e: ProgressEvent, ctx: RulesContext): string[] {
  return BADGES.filter((b) => !d.badges[b.id] && BADGE_RULES[b.id]?.(d, e, ctx)).map((b) => b.id)
}

/* ---------- Applying events ---------- */

const addUnique = <T>(arr: T[], v: T) => (arr.includes(v) ? arr : [...arr, v])

/** Base XP an event is worth before badges/challenges. */
export function baseXp(e: ProgressEvent): number {
  switch (e.type) {
    case 'artworkScored':
      return xpForScore(e.score.overall) + (e.isDaily ? 40 : 0)
    case 'artworkSaved':
      return e.kind === 'free' ? 25 : 0
    case 'lessonCompleted':
      return e.xp
    case 'quizCompleted':
      return Math.round((e.correct / e.total) * 40) + (e.correct === e.total ? 20 : 0)
    case 'spotStyle':
      return Math.min(5, e.streak)
    case 'flashcardReviewed':
      return e.count
    case 'challengeClaimed':
      return e.xp
    default:
      return 0
  }
}

export function applyEvent(
  prev: ProgressData,
  e: ProgressEvent,
  ctx: RulesContext,
): { data: ProgressData; reward: RewardSummary } {
  const today = dayKey(ctx.now)
  const stats = { ...prev.stats }
  let streak = prev.streak
  let streakExtended = false
  const activity = { ...prev.activity }
  let scoreHistory = prev.scoreHistory
  const challenges = { ...prev.challenges }

  const creative =
    e.type === 'artworkScored' ||
    e.type === 'artworkSaved' ||
    e.type === 'lessonCompleted' ||
    e.type === 'quizCompleted'

  if (creative) {
    const r = updateStreak(prev.streak, today)
    streak = r.streak
    streakExtended = r.extended
    activity[today] = (activity[today] ?? 0) + 1
  }

  if (isCreative(e)) {
    const h = ctx.now.getHours()
    if (h < 5) stats.nightDraws++
    if (h >= 5 && h < 7) stats.earlyDraws++
    const dow = ctx.now.getDay()
    if (dow === 0 || dow === 6) stats.weekendDraws++
  }

  switch (e.type) {
    case 'artworkScored': {
      const o = e.score.overall
      stats.artworks++
      stats.practiceArtworks++
      stats.totalSeconds += e.seconds
      if (o >= 85) stats.highScores++
      if (o >= 90) stats.masterpieces++
      if (o >= 95) stats.perfect++
      if (e.score.colour >= 90) stats.colourHigh++
      stats.bestScore = Math.max(stats.bestScore, o)
      stats.scoreRun = o >= 80 ? stats.scoreRun + 1 : 0
      if (e.seconds > 0 && e.seconds < 300 && o >= 60) stats.speedDraws++
      if (e.previousBest !== undefined && o - e.previousBest >= 25) stats.bigComeback = true
      if (e.isDaily) stats.dailyChallenges++
      stats.templatesTried = addUnique(stats.templatesTried, e.templateId)
      stats.categoriesTried = addUnique(stats.categoriesTried, e.category)
      scoreHistory = [
        ...scoreHistory,
        {
          at: ctx.now.toISOString(),
          overall: o,
          similarity: e.score.similarity,
          colour: e.score.colour,
          artworkId: e.score.artworkId,
        },
      ].slice(-200)
      break
    }
    case 'artworkSaved':
      if (e.kind === 'free') {
        stats.artworks++
        stats.freeDraws++
      }
      stats.totalSeconds += e.seconds
      break
    case 'lessonCompleted':
      stats.lessonsCompleted++
      break
    case 'quizCompleted':
      if (e.correct / e.total >= 0.6) stats.quizzesPassed++
      if (e.correct === e.total) stats.perfectQuizzes++
      break
    case 'viewed':
      if (e.what === 'movement') stats.movementsViewed = addUnique(stats.movementsViewed, e.slug)
      if (e.what === 'artForm') stats.artFormsViewed = addUnique(stats.artFormsViewed, e.slug)
      if (e.what === 'artist') stats.artistsViewed = addUnique(stats.artistsViewed, e.slug)
      break
    case 'chatMessage':
      stats.chatMessages++
      break
    case 'download':
      stats.downloads++
      break
    case 'flashcardReviewed':
      stats.flashcardsReviewed += e.count
      break
    case 'spotStyle':
      stats.spotStyleBest = Math.max(stats.spotStyleBest, e.streak)
      break
    case 'colorLab':
      stats.colorLabUses++
      break
    case 'paletteSent':
      stats.palettesSent++
      break
    case 'glossary':
      stats.glossaryOpened++
      break
    case 'challengeClaimed': {
      const key = `${e.challengeId}@${e.periodKey}`
      const cur = challenges[key] ?? { progress: 0, claimed: false }
      challenges[key] = { ...cur, claimed: true }
      break
    }
  }

  // Challenge progress
  const completedChallenges: string[] = []
  if (e.type !== 'challengeClaimed') {
    for (const a of activeChallenges(ctx.now)) {
      const inc = challengeIncrement(a.challenge, e)
      if (!inc) continue
      const key = challengeKey(a)
      const cur = challenges[key] ?? { progress: 0, claimed: false }
      const progress = Math.min(a.challenge.target, cur.progress + inc)
      if (cur.progress < a.challenge.target && progress >= a.challenge.target) completedChallenges.push(a.challenge.id)
      challenges[key] = { ...cur, progress }
    }
  }

  let data: ProgressData = { ...prev, stats, streak, activity, scoreHistory, challenges }
  const newBadges = evaluateBadges(data, e, ctx)
  const badgeXp = newBadges.reduce((sum, id) => sum + (BADGE_MAP[id]?.xp ?? 0), 0)
  const xpGained = baseXp(e) + badgeXp
  const stamp = ctx.now.toISOString()
  data = {
    ...data,
    xp: prev.xp + xpGained,
    badges: { ...prev.badges, ...Object.fromEntries(newBadges.map((id) => [id, stamp])) },
  }

  return {
    data,
    reward: {
      xpGained,
      xpBefore: prev.xp,
      xpAfter: data.xp,
      levelBefore: levelFromXp(prev.xp),
      levelAfter: levelFromXp(data.xp),
      newBadges,
      streak: streak.current,
      streakExtended,
      completedChallenges,
    },
  }
}
