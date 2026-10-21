import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyProgress, type ProgressData } from '@/features/gamification/types'
import { persistStorage, STORE_KEYS } from './storage'

interface ProgressState extends ProgressData {
  replace: (d: ProgressData) => void
  reset: () => void
}

/** Gamification data. Only `src/api/progress.ts` should write to it. */
export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...emptyProgress(),
      replace: (d) => set(d),
      reset: () => set(emptyProgress()),
    }),
    {
      name: STORE_KEYS.progress,
      storage: persistStorage,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressData>
        const base = emptyProgress()
        return { ...current, ...p, stats: { ...base.stats, ...(p.stats ?? {}) } }
      },
    },
  ),
)

export function progressSnapshot(): ProgressData {
  const s = useProgress.getState()
  return {
    xp: s.xp,
    badges: s.badges,
    streak: s.streak,
    activity: s.activity,
    stats: s.stats,
    challenges: s.challenges,
    scoreHistory: s.scoreHistory,
  }
}
