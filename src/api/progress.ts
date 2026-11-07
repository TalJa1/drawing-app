/* Gamification endpoints. For a signed-in user the server is the one that decides XP, badges and
   streaks (the same rules as features/gamification/rules.ts); the events not connected yet, and a
   guest's activity, still run those rules here on the device. */
import type { Badge, Challenge, LeaderboardEntry, RewardSummary } from '@/types'
import { applyEvent, levelFromXp, type RulesContext } from '@/features/gamification/rules'
import type { ProgressEvent, ProgressStats, StreakState } from '@/features/gamification/types'
import { LESSONS } from '@/mocks/lessons'
import { MOVEMENTS } from '@/mocks/movements'
import { ART_FORMS } from '@/mocks/artForms'
import { TEMPLATE_CATEGORIES } from '@/mocks/templates'
import { progressSnapshot, useProgress } from '@/store/progress'
import { useSession } from '@/store/session'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { ApiError, request } from './client'

type ProgressOut = components['schemas']['ProgressOut']
type StatsOut = components['schemas']['StatsOut']
type StreakOut = components['schemas']['StreakOut']

// The server's shape (from its OpenAPI) must match what the app keeps; if one side changes without the
// other, `tsc` fails here. (`categoriesTried` is a plain list of strings on the wire; the app narrows it.)
export type StatsKeysOnTheWire = Assert<keyof StatsOut, keyof ProgressStats>
export type StatsKeysInTheApp = Assert<keyof ProgressStats, keyof StatsOut>
export type StatsOnTheWire = Assert<Omit<Wire<StatsOut>, 'categoriesTried'>, Omit<ProgressStats, 'categoriesTried'>>

// Same idea for the challenge, badge and ranking answers. Only the names of the fields are compared here (the
// server says `string` where the app narrows to a few words), in both directions.
type ChallengeOut = components['schemas']['ChallengeOut']
type ChallengeStatusOut = components['schemas']['ChallengeStatusOut']
type BadgeOut = components['schemas']['BadgeOut']
type LeaderboardEntryOut = components['schemas']['LeaderboardEntryOut']
export type ChallengeKeysOnTheWire = Assert<keyof ChallengeOut, keyof Challenge>
export type ChallengeKeysInTheApp = Assert<keyof Challenge, keyof ChallengeOut>
export type ChallengeStatusKeysOnTheWire = Assert<keyof ChallengeStatusOut, keyof ChallengeStatus>
export type ChallengeStatusKeysInTheApp = Assert<keyof ChallengeStatus, keyof ChallengeStatusOut>
export type BadgeKeysOnTheWire = Assert<keyof BadgeOut, keyof Badge | 'unlockedAt'>
export type BadgeKeysInTheApp = Assert<keyof Badge | 'unlockedAt', keyof BadgeOut>
export type RankingKeysOnTheWire = Assert<keyof LeaderboardEntryOut, keyof LeaderboardEntry>
export type RankingKeysInTheApp = Assert<keyof LeaderboardEntry, keyof LeaderboardEntryOut>
// (no `Wire` here: `lastDay` is always sent, as a date or null, and the app keeps it as that)
export type StreakOnTheWire = Assert<Omit<StreakOut, 'live'>, StreakState>

export function rulesContext(now = new Date()): RulesContext {
  return {
    now,
    totals: {
      lessons: LESSONS.length,
      movements: MOVEMENTS.length,
      artForms: ART_FORMS.length,
      categories: TEMPLATE_CATEGORIES.length,
    },
  }
}

let syncCount = 0

/**
 * GET /me/progress — makes the account's numbers the ones this device shows. Challenges are not part of
 * that answer (they have their own endpoints), so the ones kept here stay as they are.
 * Rejects when the server cannot be reached; callers that already have what they came for ignore that.
 */
export async function syncProgress(): Promise<void> {
  const token = useSession.getState().token
  if (!token) return
  const mine = ++syncCount
  const p = await request<ProgressOut>('GET', '/me/progress')
  // an answer is dropped when a newer refresh was started meanwhile, or when someone else signed in
  if (mine !== syncCount || useSession.getState().token !== token) return
  if (typeof p?.xp !== 'number' || !p.stats || !p.streak) {
    throw new ApiError('The server sent something we could not read.', 200, 'server_error')
  }
  const { live: _live, ...streak } = p.streak
  void _live
  useProgress.getState().replace({
    xp: p.xp,
    badges: p.badges,
    streak: streak as StreakState,
    activity: p.activity,
    stats: p.stats as ProgressStats,
    scoreHistory: p.scoreHistory,
    challenges: useProgress.getState().challenges,
  })
}

function nothingEarned(): RewardSummary {
  const p = useProgress.getState()
  const level = levelFromXp(p.xp)
  return {
    xpGained: 0,
    xpBefore: p.xp,
    xpAfter: p.xp,
    levelBefore: level,
    levelAfter: level,
    newBadges: [],
    streak: p.streak.current,
    streakExtended: false,
    completedChallenges: [],
  }
}

/** Events the server decides by itself, when a drawing is saved or scored: the app never reports them. */
const DECIDED_BY_THE_SERVER = new Set<ProgressEvent['type']>(['artworkSaved', 'artworkScored'])

/**
 * What only the browser can witness (a page was viewed, a file was downloaded...): for a signed-in person the
 * server counts these (POST /progress/events). Not in it, on purpose: chat messages (the chat is outside the
 * backend, so the server refuses them) and lessons and quizzes (lot 4c) — those still run on the device.
 */
const REPORTED_TO_THE_SERVER = new Set<ProgressEvent['type']>([
  'download',
  'viewed',
  'flashcardReviewed',
  'spotStyle',
  'colorLab',
  'paletteSent',
  'glossary',
])

/** POST /progress/events — record an activity, get XP/badges back. */
export async function recordActivity(event: ProgressEvent): Promise<RewardSummary> {
  const signedIn = !!useSession.getState().token
  if (signedIn && DECIDED_BY_THE_SERVER.has(event.type)) {
    throw new ApiError('The server decides that by itself when the drawing is saved or scored.', 422, 'event_not_allowed')
  }
  if (signedIn && REPORTED_TO_THE_SERVER.has(event.type)) {
    // what was just done (a download, a page seen) is already done: if the server cannot count it (offline, too
    // many events a minute...) the person is not told off for it, they just earn nothing this time
    try {
      const reward = await request<RewardSummary>('POST', '/progress/events', { body: event })
      await syncProgress().catch(() => {}) // the reward stands even if the refresh does not get through
      return reward
    } catch {
      return nothingEarned()
    }
  }
  // a guest, or an event the account does not count yet: the rules run here
  const { data, reward } = applyEvent(progressSnapshot(), event, rulesContext())
  useProgress.getState().replace(data)
  return reward
}

export interface ChallengeStatus {
  challenge: Challenge
  periodKey: string
  progress: number
  claimed: boolean
  theme?: string[]
}

/** A list that is not a list is the server's fault, not "no challenges": better a retry button than an empty page. */
function listOf<T>(data: unknown): T[] {
  if (!Array.isArray(data)) throw new ApiError('The server sent something we could not read.', 200, 'server_error')
  return data as T[]
}

/** GET /challenges — what is on for this account today and this week, with its progress. */
export async function getChallenges(): Promise<ChallengeStatus[]> {
  return listOf<ChallengeStatus>(await request<unknown>('GET', '/challenges'))
}

/** POST /challenges/:id/claim — the server checks it is done and pays what the definition says. */
export async function claimChallenge(challengeId: string, periodKey: string): Promise<RewardSummary> {
  const reward = await request<RewardSummary>('POST', `/challenges/${encodeURIComponent(challengeId)}/claim`, { body: { periodKey } })
  await syncProgress().catch(() => {}) // the reward stands even if the refresh does not get through
  return reward
}

export interface AchievementsResponse {
  badges: (Badge & { unlockedAt?: string })[]
}

/** GET /achievements — every badge, with the time this account unlocked it. */
export async function getAchievements(): Promise<AchievementsResponse> {
  const res = await request<AchievementsResponse>('GET', '/achievements')
  return { badges: listOf<AchievementsResponse['badges'][number]>(res?.badges) }
}

/** GET /leaderboard?scope=weekly|all — real people only, best first, `id` is the rank. */
export async function getLeaderboard(scope: 'weekly' | 'all'): Promise<LeaderboardEntry[]> {
  return listOf<LeaderboardEntry>(await request<unknown>('GET', `/leaderboard?scope=${scope}`))
}
