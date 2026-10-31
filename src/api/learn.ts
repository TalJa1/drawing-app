import type { Artist, ArtForm, ArtMovement, GlossaryTerm, Lesson, Localized, RewardSummary } from '@/types'
import { LESSON_MAP, QUIZ_KEYS } from '@/mocks/lessons'
import { MOVEMENTS, MOVEMENT_MAP } from '@/mocks/movements'
import { ARTISTS, ARTIST_MAP } from '@/mocks/artists'
import { useLearn } from '@/store/learn'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { ApiError, request, simulate } from './client'
import { recordActivity } from './progress'

// The server's shapes (from its OpenAPI) must be usable as the app's types; if one side changes
// without the other, `tsc` fails here.
export type LessonOnTheWire = Assert<Wire<components['schemas']['LessonOut']>, Lesson>
export type ArtFormOnTheWire = Assert<Wire<components['schemas']['ArtFormOut']>, ArtForm>
export type GlossaryTermOnTheWire = Assert<Wire<components['schemas']['GlossaryTermOut']>, GlossaryTerm>

/* Movements and artists have no endpoint on the server (plan 6.4): they stay local, with a short
   simulated wait. Cached forever by TanStack Query. */
const content = { latency: [250, 600] as [number, number] }

function found<T>(v: T | undefined, what: string): T {
  if (!v) throw new ApiError(`${what} not found`, 404, 'not_found')
  return v
}

/** GET /lessons */
export function getLessons(): Promise<Lesson[]> {
  return request<Lesson[]>('GET', '/lessons')
}
/** GET /lessons/{slug} — the quiz comes without its right answers; they are given on submit. */
export function getLesson(slug: string): Promise<Lesson> {
  return request<Lesson>('GET', `/lessons/${encodeURIComponent(slug)}`)
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
/** GET /art-forms */
export function getArtForms(): Promise<ArtForm[]> {
  return request<ArtForm[]>('GET', '/art-forms')
}
/** GET /art-forms/{slug} */
export function getArtForm(slug: string): Promise<ArtForm> {
  return request<ArtForm>('GET', `/art-forms/${encodeURIComponent(slug)}`)
}
/** GET /glossary */
export function getGlossary(): Promise<GlossaryTerm[]> {
  return request<GlossaryTerm[]>('GET', '/glossary')
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

/** What a reader learns about one question once the quiz is submitted. */
export interface QuizReview {
  id: string
  /** index of the right option */
  answer: number
  explain: Localized
}

export interface QuizResult {
  correct: number
  total: number
  passed: boolean
  reward: RewardSummary | null
  /** one per question, in order: the right option and why */
  review: QuizReview[]
}

/** POST /lessons/:slug/quiz — grades answers server-side and only then reveals the right ones. */
export async function submitQuiz(slug: string, answers: number[]): Promise<QuizResult> {
  await simulate({ latency: [400, 800], canFail: false })
  const lesson = found(LESSON_MAP[slug], 'Lesson')
  const keys = found(QUIZ_KEYS[slug], 'Lesson')
  const qs = lesson.quiz.questions
  const correct = keys.reduce((n, k, i) => n + (answers[i] === k.answer ? 1 : 0), 0)
  const passed = correct / qs.length >= 0.6
  const prev = useLearn.getState().lessons[slug]
  useLearn.getState().setLessonProgress(slug, {
    quizBest: Math.max(prev?.quizBest ?? 0, correct / qs.length),
    quizPassed: (prev?.quizPassed ?? false) || passed,
  })
  // only a result that improves the best score earns XP, and only for the part that is new
  const improved = correct / qs.length > (prev?.quizBest ?? 0)
  const prevCorrect = Math.round((prev?.quizBest ?? 0) * qs.length) // right answers of the best result so far
  const reward = improved ? await recordActivity({ type: 'quizCompleted', slug, correct, total: qs.length, prevCorrect }) : null
  return { correct, total: qs.length, passed, reward, review: keys.map(({ id, answer, explain }) => ({ id, answer, explain })) }
}
