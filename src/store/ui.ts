import { create } from 'zustand'
import type { RewardSummary } from '@/types'
import { uid } from '@/lib/random'

/* ---------- Toasts ---------- */

export type ToastTone = 'info' | 'success' | 'error' | 'gold'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: ToastTone
  icon?: string
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }) => string
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid('t_')
    set((s) => ({ toasts: [...s.toasts.slice(-3), { tone: 'info', ...t, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (t: Parameters<ToastState['push']>[0]) => useToasts.getState().push(t)

/* ---------- Celebrations (badge unlocks, level-ups) ---------- */

export type CelebrationInput = { kind: 'badge'; badgeId: string } | { kind: 'level'; level: number }
export type Celebration = CelebrationInput & { id: string }

interface CelebrationState {
  queue: Celebration[]
  enqueue: (c: CelebrationInput[]) => void
  shift: () => void
}

export const useCelebrations = create<CelebrationState>()((set) => ({
  queue: [],
  enqueue: (cs) =>
    set((s) => ({ queue: [...s.queue, ...cs.map((c) => ({ ...c, id: uid('cel_') }) as Celebration)] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}))

/** Turn a reward summary into level-up/badge celebration modals. */
export function presentReward(r: RewardSummary | null | undefined): void {
  if (!r) return
  const items: CelebrationInput[] = []
  if (r.levelAfter > r.levelBefore) items.push({ kind: 'level', level: r.levelAfter })
  for (const badgeId of r.newBadges) items.push({ kind: 'badge', badgeId })
  if (items.length) useCelebrations.getState().enqueue(items)
}
