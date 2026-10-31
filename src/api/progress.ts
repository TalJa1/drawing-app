/* Gamification endpoints. For a signed-in user the server is the one that decides XP, badges and
   streaks (the same rules as features/gamification/rules.ts); the events not connected yet, and a
   guest's activity, still run those rules here on the device. */
import type { Badge, Challenge, LeaderboardEntry, RewardSummary } from '@/types'
import { activeChallenges, applyEvent, challengeKey, levelFromXp, type RulesContext } from '@/features/gamification/rules'
import type { ProgressEvent, ProgressStats, StreakState } from '@/features/gamification/types'
import { BADGES } from '@/mocks/badges'
import { LESSONS } from '@/mocks/lessons'
import { MOVEMENTS } from '@/mocks/movements'
import { ART_FORMS } from '@/mocks/artForms'
import { TEMPLATE_CATEGORIES } from '@/mocks/templates'
import { LEADERBOARD_SAMPLE } from '@/mocks/leaderboard'
import { progressSnapshot, useProgress } from '@/store/progress'
import { useSession } from '@/store/session'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { ApiError, request, simulate } from './client'

type ProgressOut = components['schemas']['ProgressOut']
type StatsOut = components['schemas']['StatsOut']
type StreakOut = components['schemas']['StreakOut']

// The server's shape (from its OpenAPI) must match what the app keeps; if one side changes without the
// other, `tsc` fails here. (`categoriesTried` is a plain list of strings on the wire; the app narrows it.)
export type StatsKeysOnTheWire = Assert<keyof StatsOut, keyof ProgressStats>
export type StatsKeysInTheApp = Assert<keyof ProgressStats, keyof StatsOut>
export type StatsOnTheWire = Assert<Omit<Wire<StatsOut>, 'categoriesTried'>, Omit<ProgressStats, 'categoriesTried'>>
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

/** POST /progress/events — record an activity, get XP/badges back. */
export async function recordActivity(event: ProgressEvent): Promise<RewardSummary> {
  const signedIn = !!useSession.getState().token
  if (signedIn && DECIDED_BY_THE_SERVER.has(event.type)) {
    throw new ApiError('The server decides that by itself when the drawing is saved or scored.', 422, 'event_not_allowed')
  }
  if (signedIn && event.type === 'download') {
    // a download is a small bonus on top of a file that is already saved: if the bonus cannot be paid
    // (offline, a daily limit...) the person is not told off for it, they just earn nothing this time
    try {
      const reward = await request<RewardSummary>('POST', '/progress/events', { body: { type: 'download' } })
      await syncProgress().catch(() => {}) // the reward stands even if the refresh does not get through
      return reward
    } catch {
      return nothingEarned()
    }
  }
  // not connected to the account yet, or a guest: the rules run here
  await simulate({ latency: [60, 180], canFail: false })
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

/** GET /challenges */
export async function getChallenges(): Promise<ChallengeStatus[]> {
  await simulate({ latency: [250, 600] })
  return challengeStatuses()
}

export function challengeStatuses(now = new Date()): ChallengeStatus[] {
  const saved = useProgress.getState().challenges
  return activeChallenges(now).map((a) => {
    const s = saved[challengeKey(a)] ?? { progress: 0, claimed: false }
    return { challenge: a.challenge, periodKey: a.periodKey, progress: s.progress, claimed: s.claimed, theme: a.theme }
  })
}

/** POST /challenges/:id/claim */
export async function claimChallenge(challengeId: string, periodKey: string): Promise<RewardSummary> {
  await simulate({ latency: [300, 700] })
  const st = challengeStatuses().find((c) => c.challenge.id === challengeId && c.periodKey === periodKey)
  if (!st) throw new ApiError('Challenge not active', 404, 'not_found')
  if (st.claimed) throw new ApiError('Already claimed', 409, 'already_claimed')
  if (st.progress < st.challenge.target) throw new ApiError('Not complete yet', 422, 'incomplete')
  return recordActivity({ type: 'challengeClaimed', challengeId, periodKey, xp: st.challenge.xp })
}

export interface AchievementsResponse {
  badges: (Badge & { unlockedAt?: string })[]
}

/** GET /achievements */
export async function getAchievements(): Promise<AchievementsResponse> {
  await simulate({ latency: [250, 600] })
  const owned = useProgress.getState().badges
  return { badges: BADGES.map((b) => ({ ...b, unlockedAt: owned[b.id] })) }
}

/** GET /leaderboard?scope=weekly|all */
export async function getLeaderboard(scope: 'weekly' | 'all'): Promise<LeaderboardEntry[]> {
  await simulate({ latency: [400, 900] })
  const user = useSession.getState().user
  const p = useProgress.getState()
  const weekAgo = Date.now() - 7 * 86_400_000
  const weeklyXp = p.scoreHistory
    .filter((h) => new Date(h.at).getTime() > weekAgo)
    .reduce((s, h) => s + Math.round(10 + h.overall * 0.9), 0)
  const me: LeaderboardEntry = {
    id: user.id,
    name: user.displayName,
    avatarSeed: user.avatarSeed,
    xp: p.xp,
    weeklyXp,
    level: levelFromXp(p.xp),
    country: 'VN',
    isCurrentUser: true,
    sample: false,
  }
  const others = LEADERBOARD_SAMPLE.map((e) => ({ ...e, level: levelFromXp(e.xp) }))
  const key = scope === 'weekly' ? 'weeklyXp' : 'xp'
  return [...others, me].sort((a, b) => b[key] - a[key])
}
