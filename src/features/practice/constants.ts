import type { Difficulty } from '@/types'

export const DIFF_LEVEL: Record<Difficulty, 1 | 2 | 3 | 4> = { beginner: 1, intermediate: 2, advanced: 3, master: 4 }
export const DIFF_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'master']
