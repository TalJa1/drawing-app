import { BADGE_MAP } from '@/mocks/badges'
import { LESSONS, QUIZ_KEYS } from '@/mocks/lessons'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { ApiError } from './client'
import { getArtForm, getArtForms, getGlossary, getLesson, getLessons, submitQuiz } from './learn'

// no waiting in tests
vi.mock('./client', async (original) => ({ ...(await original<typeof import('./client')>()), simulate: async () => {} }))

const THREE = 'rule-of-thirds' // 3 questions
const FOUR = 'hue-value-saturation' // 4 questions

/** answers with exactly `right` correct ones (the first ones) */
function answers(slug: string, right: number) {
  return QUIZ_KEYS[slug].map((k, i) => (i < right ? k.answer : (k.answer + 1) % 2))
}

/** the XP of the quiz itself: the reward less the XP of the badges it unlocked */
const quizXp = (r: { xpGained: number; newBadges: string[] }) => r.xpGained - r.newBadges.reduce((n, id) => n + BADGE_MAP[id].xp, 0)

beforeEach(() => {
  useLearn.getState().reset()
  useProgress.getState().reset()
})

describe('quiz', () => {
  it('never gives an answer or an explanation before it is submitted', () => {
    for (const lesson of LESSONS) {
      for (const q of lesson.quiz.questions) {
        expect(Object.keys(q).sort()).toEqual(['id', 'options', 'prompt'])
      }
    }
  })

  it('reveals the right option and the explanation of every question once submitted', async () => {
    const r = await submitQuiz(THREE, answers(THREE, 0))
    expect(r.correct).toBe(0)
    expect(r.review).toEqual(QUIZ_KEYS[THREE])
  })

  it('has a key for every question of every lesson', () => {
    for (const lesson of LESSONS) {
      expect(QUIZ_KEYS[lesson.slug].map((k) => k.id)).toEqual(lesson.quiz.questions.map((q) => q.id))
    }
  })

  it.each([
    [THREE, [1, 2, 3], [13, 14, 33]],
    [THREE, [3], [60]],
    [FOUR, [1, 2, 3, 4], [10, 10, 10, 30]],
    [FOUR, [1, 4], [10, 50]],
  ])('pays only the part that is new (%s %j)', async (slug, path, paid) => {
    const got: number[] = []
    for (const right of path) {
      const r = await submitQuiz(slug, answers(slug, right))
      got.push(quizXp(r.reward!))
    }
    expect(got).toEqual(paid)
  })

  it('pays nothing for a result that is not better', async () => {
    await submitQuiz(THREE, answers(THREE, 2))
    expect((await submitQuiz(THREE, answers(THREE, 2))).reward).toBeNull()
    expect((await submitQuiz(THREE, answers(THREE, 1))).reward).toBeNull()
  })

  it('never gives a lesson more than 60 XP of quiz', async () => {
    let total = 0
    for (const right of [0, 1, 2, 3, 3, 3]) {
      const r = await submitQuiz(THREE, answers(THREE, right))
      if (r.reward) total += quizXp(r.reward)
    }
    expect(total).toBe(60)
  })
})

describe('content reads (the server serves them)', () => {
  const fetchMock = vi.fn()
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const notFound = () => json(404, { error: { code: 'not_found', message: 'x', traceId: 't' } })
  const lastUrl = () => (fetchMock.mock.calls.at(-1) as [string, RequestInit])[0]
  const lastMethod = () => (fetchMock.mock.calls.at(-1) as [string, RequestInit])[1].method

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['getLessons', () => getLessons(), '/api/v1/lessons'],
    ['getLesson', () => getLesson('rule-of-thirds'), '/api/v1/lessons/rule-of-thirds'],
    ['getArtForms', () => getArtForms(), '/api/v1/art-forms'],
    ['getArtForm', () => getArtForm('watercolour'), '/api/v1/art-forms/watercolour'],
    ['getGlossary', () => getGlossary(), '/api/v1/glossary'],
  ])('%s asks GET %s and returns what the server sent', async (_name, call, url) => {
    fetchMock.mockResolvedValue(json(200, [{ marker: 1 }]))
    expect(await call()).toEqual([{ marker: 1 }])
    expect(lastUrl()).toBe(url)
    expect(lastMethod()).toBe('GET')
  })

  it('escapes a slug so it can not change the path', async () => {
    fetchMock.mockImplementation(async () => json(200, {})) // a Response body can be read once
    await getLesson('../me')
    await getArtForm('a b/c')
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/v1/lessons/..%2Fme', '/api/v1/art-forms/a%20b%2Fc'])
  })

  it.each([
    ['getLesson', () => getLesson('nope')],
    ['getArtForm', () => getArtForm('nope')],
  ])('%s turns a 404 into an ApiError not_found', async (_name, call) => {
    fetchMock.mockResolvedValue(notFound())
    const err = (await call().catch((e: unknown) => e)) as ApiError
    expect(fetchMock).toHaveBeenCalledTimes(1) // it asked the server; a mock would not have
    expect(err).toBeInstanceOf(ApiError)
    expect([err.status, err.code]).toEqual([404, 'not_found'])
  })
})
