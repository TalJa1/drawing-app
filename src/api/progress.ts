/* Gamification endpoints. The server would run the same pure rules
   (features/gamification/rules.ts) and return a RewardSummary. */
import type { Badge, Challenge, LeaderboardEntry, RewardSummary } from '@/types'
import { activeChallenges, applyEvent, challengeKey, levelFromXp, type RulesContext } from '@/features/gamification/rules'
import type { ProgressEvent } from '@/features/gamification/types'
import { BADGES } from '@/mocks/badges'
import { LESSONS } from '@/mocks/lessons'
import { MOVEMENTS } from '@/mocks/movements'
import { ART_FORMS } from '@/mocks/artForms'
import { TEMPLATE_CATEGORIES } from '@/mocks/templates'
import { LEADERBOARD_SAMPLE } from '@/mocks/leaderboard'
import { progressSnapshot, useProgress } from '@/store/progress'
import { useSession } from '@/store/session'
import { ApiError, simulate } from './client'

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

/** POST /progress/events — record an activity, get XP/badges back. */
export async function recordActivity(event: ProgressEvent): Promise<RewardSummary> {
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

/** GET /leaderboard?scope=weekly|all&filter=global|friends */
export async function getLeaderboard(scope: 'weekly' | 'all', filter: 'global' | 'friends'): Promise<LeaderboardEntry[]> {
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
    isFriend: true,
    isCurrentUser: true,
    sample: false,
  }
  const others = LEADERBOARD_SAMPLE.filter((e) => filter === 'global' || e.isFriend).map((e) => ({ ...e, level: levelFromXp(e.xp) }))
  const key = scope === 'weekly' ? 'weeklyXp' : 'xp'
  return [...others, me].sort((a, b) => b[key] - a[key])
}
