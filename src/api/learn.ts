import type { Artist, ArtForm, ArtMovement, GlossaryTerm, Lesson, LessonProgress, Localized, RewardSummary } from '@/types'
import { LESSON_MAP, QUIZ_KEYS } from '@/mocks/lessons'
import { MOVEMENTS, MOVEMENT_MAP } from '@/mocks/movements'
import { ARTISTS, ARTIST_MAP } from '@/mocks/artists'
import { useLearn, type LearnData } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { useSession } from '@/store/session'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { ApiError, request, simulate } from './client'
import { recordActivity, syncProgress } from './progress'

// The server's shapes (from its OpenAPI) must be usable as the app's types; if one side changes
// without the other, `tsc` fails here.
export type LessonOnTheWire = Assert<Wire<components['schemas']['LessonOut']>, Lesson>
export type ArtFormOnTheWire = Assert<Wire<components['schemas']['ArtFormOut']>, ArtForm>
export type GlossaryTermOnTheWire = Assert<Wire<components['schemas']['GlossaryTermOut']>, GlossaryTerm>
// the learning endpoints: same names on both sides (the dates and nulls are turned into the app's form below)
export type LessonStateKeysOnTheWire = Assert<keyof components['schemas']['LessonStateOut'], keyof LessonProgress>
export type LessonStateKeysInTheApp = Assert<keyof LessonProgress, keyof components['schemas']['LessonStateOut']>
export type QuizKeysOnTheWire = Assert<keyof components['schemas']['app__schemas__learning__QuizOut'], keyof QuizResult>
export type QuizKeysInTheApp = Assert<keyof QuizResult, keyof components['schemas']['app__schemas__learning__QuizOut']>
export type QuizReviewOnTheWire = Assert<Wire<components['schemas']['QuestionReview']>, QuizReview>
export type LearningKeysOnTheWire = Assert<keyof components['schemas']['LearningOut'], keyof LearnData | 'serverTime'>
export type LearningKeysInTheApp = Assert<keyof LearnData | 'serverTime', keyof components['schemas']['LearningOut']>

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

/* ---------------------------------------------------------------------------------------------
   Learning state (lot 4c). A signed-in person's lives on the server; a guest's stays on this device
   (zustand store `useLearn`). Where an answer can arrive after the person changed, it is dropped.
   --------------------------------------------------------------------------------------------- */
const signedIn = () => !!useSession.getState().token
const lessonPath = (slug: string, what: string) => `/lessons/${encodeURIComponent(slug)}/${what}`

/** The same person is still signed in (an answer for someone who has left must not be shown to the next one). */
const stillSignedInAs = (token: string | null) => !!token && useSession.getState().token === token

/** PUT /lessons/:slug/progress — how far the lesson was read (0–1). Never fails the page. */
export async function saveLessonProgress(slug: string, progress: number): Promise<void> {
  useLearn.getState().setLessonProgress(slug, { progress, lastOpened: new Date().toISOString() })
  if (!signedIn()) return
  // The next scroll sends it again, so a refusal (rate limit, no network) is not worth an error on the page.
  await request('PUT', lessonPath(slug, 'progress'), { body: { progress } }).catch(() => {})
}

/**
 * POST /lessons/:slug/complete — the reward, or null when this lesson was finished before.
 * For a signed-in person the server decides; if it does not answer, the lesson is NOT marked finished, so
 * opening it again tries again.
 */
export async function completeLesson(slug: string): Promise<RewardSummary | null> {
  const token = useSession.getState().token
  if (token) {
    const reward = await request<RewardSummary | null>('POST', lessonPath(slug, 'complete'))
    if (!stillSignedInAs(token)) return reward ?? null
    useLearn.getState().setLessonProgress(slug, { progress: 1, completed: true })
    if (reward) await syncProgress().catch(() => {}) // the reward stands even if the refresh does not get through
    return reward ?? null
  }
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
  const token = useSession.getState().token
  if (token) {
    const result = await request<QuizResult>('POST', lessonPath(slug, 'quiz'), { body: { answers } })
    if (!stillSignedInAs(token)) return result
    const prev = useLearn.getState().lessons[slug]
    useLearn.getState().setLessonProgress(slug, {
      quizBest: Math.max(prev?.quizBest ?? 0, result.total ? result.correct / result.total : 0),
      quizPassed: (prev?.quizPassed ?? false) || result.passed,
    })
    if (result.reward) await syncProgress().catch(() => {}) // the reward stands even if the refresh does not get through
    return result
  }
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

/**
 * PUT | DELETE /me/bookmarks/:slug — saves or removes a bookmark. It shows at once; if the server says no,
 * it goes back to how it was and the error is thrown (for the page to say so).
 */
export async function setBookmark(slug: string, on: boolean): Promise<void> {
  const token = useSession.getState().token
  const was = useLearn.getState().bookmarks.includes(slug)
  useLearn.getState().setBookmark(slug, on)
  if (!token) return
  try {
    await request(on ? 'PUT' : 'DELETE', `/me/bookmarks/${encodeURIComponent(slug)}`)
  } catch (e) {
    if (stillSignedInAs(token)) useLearn.getState().setBookmark(slug, was)
    throw e
  }
}

/**
 * The server's times are its own clock's. A card is due "so long after the server's now"; on this device
 * that is the same wait after THIS device's now, whatever this device's clock says.
 */
function dueOnThisDevice(due: string, serverTime: string): number {
  return Date.now() + (Date.parse(due) - Date.parse(serverTime))
}

/** PUT /me/flashcards/:id — a signed-in reader answered a card; the server chooses the box and the due time. */
export async function reviewCard(termId: string, knewIt: boolean): Promise<{ box: number; due: number }> {
  const token = useSession.getState().token
  const r = await request<components['schemas']['ReviewOut']>('PUT', `/me/flashcards/${encodeURIComponent(termId)}`, {
    body: { knewIt },
  })
  const card = { box: r.box, due: dueOnThisDevice(r.due, r.serverTime) }
  if (stillSignedInAs(token)) useLearn.getState().setFlashcard(termId, card)
  return card
}

let learningSyncs = 0

/** GET /me/learning — the account's learning replaces what this device kept. Rejects when it cannot be fetched. */
export async function syncLearning(): Promise<void> {
  const token = useSession.getState().token
  if (!token) return
  const mine = ++learningSyncs
  const p = await request<components['schemas']['LearningOut']>('GET', '/me/learning')
  // an answer is dropped when a newer one was asked for meanwhile, or when someone else signed in
  if (mine !== learningSyncs || useSession.getState().token !== token) return
  if (!p || typeof p !== 'object' || !p.lessons || !Array.isArray(p.bookmarks) || !p.flashcards || typeof p.spotBest !== 'number') {
    throw new ApiError('The server sent something we could not read.', 200, 'server_error')
  }
  useLearn.getState().replace({
    lessons: Object.fromEntries(
      Object.entries(p.lessons).map(([slug, l]) => [
        slug,
        // "never opened" has no date on the server; the oldest date there is keeps it from looking recent
        { ...l, lastOpened: l.lastOpened ?? new Date(0).toISOString() },
      ]),
    ),
    bookmarks: p.bookmarks,
    lastLesson: p.lastLesson,
    flashcards: Object.fromEntries(
      Object.entries(p.flashcards).map(([id, c]) => [id, { box: c.box, due: dueOnThisDevice(c.due, p.serverTime) }]),
    ),
    spotBest: p.spotBest,
  })
}

// Another person (or nobody) is now signed in: nothing of the one before stays, neither the lessons nor the
// XP. A guest starts empty; an account's learning is fetched. (Its XP and badges are fetched by the sign-in page.)
useSession.subscribe((s, prev) => {
  if (s.token === prev.token) return
  useLearn.getState().reset()
  useProgress.getState().reset()
  if (s.token) void syncLearning().catch(() => {})
})
