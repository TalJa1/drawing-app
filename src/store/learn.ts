import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LessonProgress } from '@/types'
import { persistStorage, STORE_KEYS } from './storage'

export interface FlashcardState {
  /** Leitner box 0–4 */
  box: number
  /** epoch ms when the card is due again */
  due: number
}

interface LearnState {
  lessons: Record<string, LessonProgress>
  bookmarks: string[]
  lastLesson: string | null
  flashcards: Record<string, FlashcardState>
  spotBest: number
  setLessonProgress: (slug: string, p: Partial<LessonProgress>) => void
  toggleBookmark: (slug: string) => void
  setFlashcard: (id: string, f: FlashcardState) => void
  setSpotBest: (n: number) => void
  reset: () => void
}

const emptyLesson = (): LessonProgress => ({
  progress: 0,
  completed: false,
  quizBest: 0,
  quizPassed: false,
  lastOpened: new Date().toISOString(),
})

export const useLearn = create<LearnState>()(
  persist(
    (set) => ({
      lessons: {},
      bookmarks: [],
      lastLesson: null,
      flashcards: {},
      spotBest: 0,
      setLessonProgress: (slug, p) =>
        set((s) => {
          const cur = s.lessons[slug] ?? emptyLesson()
          const next = { ...cur, ...p, progress: Math.max(cur.progress, p.progress ?? 0) }
          return { lessons: { ...s.lessons, [slug]: next }, lastLesson: slug }
        }),
      toggleBookmark: (slug) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(slug)
            ? s.bookmarks.filter((b) => b !== slug)
            : [...s.bookmarks, slug],
        })),
      setFlashcard: (id, f) => set((s) => ({ flashcards: { ...s.flashcards, [id]: f } })),
      setSpotBest: (n) => set((s) => ({ spotBest: Math.max(s.spotBest, n) })),
      reset: () => set({ lessons: {}, bookmarks: [], lastLesson: null, flashcards: {}, spotBest: 0 }),
    }),
    { name: STORE_KEYS.learn, storage: persistStorage, version: 1 },
  ),
)
