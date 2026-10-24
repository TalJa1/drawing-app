import type { Artist, ArtForm, ArtMovement, GlossaryTerm, Lesson, RewardSummary } from '@/types'
import { LESSONS, LESSON_MAP } from '@/mocks/lessons'
import { MOVEMENTS, MOVEMENT_MAP } from '@/mocks/movements'
import { ARTISTS, ARTIST_MAP } from '@/mocks/artists'
import { ART_FORMS, ART_FORM_MAP } from '@/mocks/artForms'
import { GLOSSARY } from '@/mocks/glossary'
import { useLearn } from '@/store/learn'
import { ApiError, simulate } from './client'
import { recordActivity } from './progress'

/* Content endpoints (a CMS later). Short latency; cached forever by TanStack Query. */
const content = { latency: [250, 600] as [number, number] }

function found<T>(v: T | undefined, what: string): T {
  if (!v) throw new ApiError(`${what} not found`, 404, 'not_found')
  return v
}

export async function getLessons(): Promise<Lesson[]> {
  await simulate(content)
  return LESSONS
}
export async function getLesson(slug: string): Promise<Lesson> {
  await simulate(content)
  return found(LESSON_MAP[slug], 'Lesson')
}
export async function getMovements(): Promise<ArtMovement[]> {
  await simulate(content)
  return MOVEMENTS
}
export async function getMovement(slug: string): Promise<ArtMovement> {
  await simulate(content)
  return found(MOVEMENT_MAP[slug], 'Movement')
}
export async function getArtists(): Promise<Artist[]> {
  await simulate(content)
  return ARTISTS
}
export async function getArtist(slug: string): Promise<Artist> {
  await simulate(content)
  return found(ARTIST_MAP[slug], 'Artist')
}
export async function getArtForms(): Promise<ArtForm[]> {
  await simulate(content)
  return ART_FORMS
}
export async function getArtForm(slug: string): Promise<ArtForm> {
  await simulate(content)
  return found(ART_FORM_MAP[slug], 'Art form')
}
export async function getGlossary(): Promise<GlossaryTerm[]> {
  await simulate(content)
  return GLOSSARY
}

/** POST /lessons/:slug/progress */
export async function saveLessonProgress(slug: string, progress: number): Promise<void> {
  useLearn.getState().setLessonProgress(slug, { progress, lastOpened: new Date().toISOString() })
}

/** POST /lessons/:slug/complete */
export async function completeLesson(slug: string): Promise<RewardSummary | null> {
  const lesson = found(LESSON_MAP[slug], 'Lesson')
  const prev = useLearn.getState().lessons[slug]
  useLearn.getState().setLessonProgress(slug, { progress: 1, completed: true })
  if (prev?.completed) return null
  return recordActivity({ type: 'lessonCompleted', slug, xp: lesson.xp })
}

export interface QuizResult {
  correct: number
  total: number
  passed: boolean
  reward: RewardSummary | null
}

/** POST /lessons/:slug/quiz — grades answers server-side. */
export async function submitQuiz(slug: string, answers: number[]): Promise<QuizResult> {
  await simulate({ latency: [400, 800], canFail: false })
  const lesson = found(LESSON_MAP[slug], 'Lesson')
  const qs = lesson.quiz.questions
  const correct = qs.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0)
  const passed = correct / qs.length >= 0.6
  const prev = useLearn.getState().lessons[slug]
  useLearn.getState().setLessonProgress(slug, {
    quizBest: Math.max(prev?.quizBest ?? 0, correct / qs.length),
    quizPassed: (prev?.quizPassed ?? false) || passed,
  })
  // only the first attempt that improves the best score earns XP
  const improved = correct / qs.length > (prev?.quizBest ?? 0)
  const reward = improved ? await recordActivity({ type: 'quizCompleted', slug, correct, total: qs.length }) : null
  return { correct, total: qs.length, passed, reward }
}
