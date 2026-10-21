import { dayKey } from '@/lib/date'
import { useNow } from '@/lib/hooks'
import { useProgress } from '@/store/progress'
import { levelProgress, liveStreak, rankForLevel } from './rules'

/** Live streak for the current user (0 if broken). */
export function useLiveStreak(): number {
  const streak = useProgress((s) => s.streak)
  const now = useNow(60_000)
  return liveStreak(streak, dayKey(now))
}

export function useLevel() {
  const xp = useProgress((s) => s.xp)
  const lp = levelProgress(xp)
  return { xp, ...lp, rank: rankForLevel(lp.level) }
}
