import { BADGE_MAP } from '@/mocks/badges'
import { LESSONS, QUIZ_KEYS } from '@/mocks/lessons'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { GUEST, useSession } from '@/store/session'
import { ApiError } from './client'
import {
  completeLesson,
  getArtForm,
  getArtForms,
  getGlossary,
  getLesson,
  getLessons,
  reviewCard,
  saveLessonProgress,
  setBookmark,
  submitQuiz,
  syncLearning,
} from './learn'

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

/* ---------------------------------------------------------------------------------------------
   Lot 4c: a signed-in person's learning lives on the server; a guest's stays on the device.
   --------------------------------------------------------------------------------------------- */
describe('learning of a signed-in person (the server decides)', () => {
  const fetchMock = vi.fn()
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const noContent = () => new Response(null, { status: 204 })
  const failure = (status: number, code: string) => json(status, { error: { code, message: 'x', traceId: 't' } })
  const calls = () => fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${c[0]}`)
  const bodyOf = (n: number) => JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string)
  const REWARD = {
    xpGained: 13,
    xpBefore: 0,
    xpAfter: 13,
    levelBefore: 1,
    levelAfter: 1,
    newBadges: [],
    streak: 1,
    streakExtended: false,
    completedChallenges: [],
  }
  // GET /me/progress, which a reward is followed by
  const PROGRESS = {
    xp: 13,
    level: { level: 1, current: 13, needed: 100, ratio: 0.1 },
    badges: {},
    streak: { current: 1, longest: 1, lastDay: '2026-11-02', freezes: 0, frozenDays: [], live: 1 },
    activity: {},
    stats: useProgress.getState().stats,
    scoreHistory: [],
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
    useLearn.getState().reset() // the token change above already cleared it; this keeps the intent plain
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    useSession.setState({ user: GUEST, token: null })
  })

  describe('reading progress', () => {
    it('shows it at once and tells the server', async () => {
      fetchMock.mockResolvedValue(noContent())
      await saveLessonProgress(THREE, 0.5)
      expect(useLearn.getState().lessons[THREE].progress).toBe(0.5)
      expect(calls()).toEqual([`PUT /api/v1/lessons/${THREE}/progress`])
      expect(bodyOf(0)).toEqual({ progress: 0.5 })
    })

    it('does not fail the page when the server cannot be reached (the next scroll sends it again)', async () => {
      fetchMock.mockResolvedValue(failure(429, 'rate_limited'))
      await expect(saveLessonProgress(THREE, 0.5)).resolves.toBeUndefined()
      expect(useLearn.getState().lessons[THREE].progress).toBe(0.5)
    })

    it('asks nothing of a guest', async () => {
      useSession.setState({ user: GUEST, token: null })
      await saveLessonProgress(THREE, 0.5)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useLearn.getState().lessons[THREE].progress).toBe(0.5)
    })
  })

  describe('finishing a lesson', () => {
    it('is paid by the server, then the numbers are refreshed', async () => {
      fetchMock.mockResolvedValueOnce(json(200, REWARD)).mockResolvedValueOnce(json(200, PROGRESS))
      const r = await completeLesson(THREE)
      expect(r).toEqual(REWARD)
      expect(calls()).toEqual([`POST /api/v1/lessons/${THREE}/complete`, 'GET /api/v1/me/progress'])
      expect(useLearn.getState().lessons[THREE]).toMatchObject({ completed: true, progress: 1 })
      expect(useProgress.getState().xp).toBe(13) // the server's, not a local rule's
    })

    it('returns null the second time (nothing is paid twice)', async () => {
      fetchMock.mockResolvedValue(json(200, null))
      expect(await completeLesson(THREE)).toBeNull()
      expect(calls()).toEqual([`POST /api/v1/lessons/${THREE}/complete`]) // nothing earned, nothing to refresh
      expect(useLearn.getState().lessons[THREE].completed).toBe(true)
    })

    it('is not marked finished when the server did not get it (so opening the lesson again retries)', async () => {
      fetchMock.mockResolvedValue(failure(500, 'server_error'))
      await expect(completeLesson(THREE)).rejects.toBeInstanceOf(ApiError)
      expect(useLearn.getState().lessons[THREE]?.completed ?? false).toBe(false)
    })

    it('keeps the reward when only the refresh fails', async () => {
      fetchMock.mockResolvedValueOnce(json(200, REWARD)).mockResolvedValueOnce(failure(500, 'server_error'))
      expect(await completeLesson(THREE)).toEqual(REWARD)
    })

    it('does not use the local rules for a signed-in person', async () => {
      fetchMock.mockResolvedValue(json(200, null))
      await completeLesson(THREE)
      expect(useProgress.getState().xp).toBe(0)
    })
  })

  describe('quiz', () => {
    const OUT = (reward: unknown) => ({
      correct: 2,
      total: 3,
      passed: true,
      reward,
      review: [
        { id: 'q1', answer: 1, explain: { en: 'a', vi: 'b' } },
        { id: 'q2', answer: 0, explain: { en: 'c', vi: 'd' } },
        { id: 'q3', answer: 1, explain: { en: 'e', vi: 'f' } },
      ],
    })

    it('is graded by the server, which sends back the right answers', async () => {
      fetchMock.mockResolvedValueOnce(json(200, OUT(REWARD))).mockResolvedValueOnce(json(200, PROGRESS))
      const r = await submitQuiz(THREE, [1, 0, 0])
      expect(calls()).toEqual([`POST /api/v1/lessons/${THREE}/quiz`, 'GET /api/v1/me/progress'])
      expect(bodyOf(0)).toEqual({ answers: [1, 0, 0] })
      expect(r).toEqual(OUT(REWARD))
    })

    it('remembers the best result and whether it passed', async () => {
      fetchMock.mockResolvedValueOnce(json(200, OUT(REWARD))).mockResolvedValueOnce(json(200, PROGRESS))
      await submitQuiz(THREE, [1, 0, 0])
      expect(useLearn.getState().lessons[THREE]).toMatchObject({ quizBest: 2 / 3, quizPassed: true })
    })

    it('does not lower the best result, and refreshes nothing when nothing was paid', async () => {
      useLearn.getState().setLessonProgress(THREE, { quizBest: 1, quizPassed: true })
      fetchMock.mockResolvedValue(json(200, OUT(null)))
      const r = await submitQuiz(THREE, [1, 0, 0])
      expect(r.reward).toBeNull()
      expect(calls()).toEqual([`POST /api/v1/lessons/${THREE}/quiz`])
      expect(useLearn.getState().lessons[THREE]).toMatchObject({ quizBest: 1, quizPassed: true })
    })

    it('never takes back a pass: a later result below the line keeps quizPassed', async () => {
      useLearn.getState().setLessonProgress(THREE, { quizBest: 1, quizPassed: true })
      fetchMock.mockResolvedValue(json(200, { ...OUT(null), correct: 0, passed: false }))
      await submitQuiz(THREE, [0, 0, 0])
      expect(useLearn.getState().lessons[THREE].quizPassed).toBe(true)
    })

    it('keeps nothing when the server refuses the answers', async () => {
      fetchMock.mockResolvedValue(failure(422, 'validation_error'))
      const err = (await submitQuiz(THREE, [1]).catch((e: unknown) => e)) as ApiError
      expect([err.status, err.code]).toEqual([422, 'validation_error'])
      expect(useLearn.getState().lessons[THREE]).toBeUndefined()
    })

    it('asks nothing of the server for a guest', async () => {
      useSession.setState({ user: GUEST, token: null })
      const r = await submitQuiz(THREE, answers(THREE, 3))
      expect(fetchMock).not.toHaveBeenCalled()
      expect(r.correct).toBe(3)
    })
  })

  describe('bookmarks', () => {
    it('saves with PUT and removes with DELETE', async () => {
      fetchMock.mockResolvedValue(noContent())
      await setBookmark(THREE, true)
      expect(useLearn.getState().bookmarks).toEqual([THREE])
      await setBookmark(THREE, false)
      expect(useLearn.getState().bookmarks).toEqual([])
      expect(calls()).toEqual([`PUT /api/v1/me/bookmarks/${THREE}`, `DELETE /api/v1/me/bookmarks/${THREE}`])
    })

    it('puts the bookmark back the way it was when the server says no', async () => {
      useLearn.setState({ bookmarks: [FOUR] })
      fetchMock.mockResolvedValue(failure(404, 'not_found'))
      await expect(setBookmark(THREE, true)).rejects.toBeInstanceOf(ApiError)
      expect(useLearn.getState().bookmarks).toEqual([FOUR])
      await expect(setBookmark(FOUR, false)).rejects.toBeInstanceOf(ApiError)
      expect(useLearn.getState().bookmarks).toEqual([FOUR])
    })

    it('does not add one twice', async () => {
      fetchMock.mockResolvedValue(noContent())
      await setBookmark(THREE, true)
      await setBookmark(THREE, true)
      expect(useLearn.getState().bookmarks).toEqual([THREE])
    })

    it('asks nothing of a guest', async () => {
      useSession.setState({ user: GUEST, token: null })
      await setBookmark(THREE, true)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useLearn.getState().bookmarks).toEqual([THREE])
    })
  })

  describe('flashcards', () => {
    const NOW = new Date('2026-11-02T12:00:00Z') // this device's clock, two hours ahead of the server's
    const SERVER_NOW = '2026-11-02T10:00:00Z'
    const LEARNING_EMPTY = { lessons: {}, bookmarks: [], lastLesson: null, flashcards: {}, spotBest: 0, serverTime: SERVER_NOW }

    it('sends only whether the card was known, and keeps the box and due time the server chose', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      fetchMock.mockResolvedValue(json(200, { termId: 'g1', box: 1, due: '2026-11-02T10:10:00Z', serverTime: SERVER_NOW }))
      await reviewCard('g1', true)
      expect(calls()).toEqual(['PUT /api/v1/me/flashcards/g1'])
      expect(bodyOf(0)).toEqual({ knewIt: true })
      // "10 minutes after the server's now" is 10 minutes after THIS device's now, whatever its clock says
      expect(useLearn.getState().flashcards.g1).toEqual({ box: 1, due: NOW.getTime() + 10 * 60_000 })
    })

    it('does not write the card for the next person when the account changed while it was saved', async () => {
      let release!: (r: Response) => void
      fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)))
      const pending = reviewCard('g1', true)
      fetchMock.mockResolvedValue(json(200, LEARNING_EMPTY)) // the new person's own sync
      useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
      release(json(200, { termId: 'g1', box: 1, due: '2026-11-02T10:10:00Z', serverTime: SERVER_NOW }))
      await pending
      await vi.waitFor(() => expect(calls()).toContain('GET /api/v1/me/learning'))
      expect(useLearn.getState().flashcards.g1).toBeUndefined()
    })

    it('keeps the old card when the server cannot be reached', async () => {
      useLearn.setState({ flashcards: { g1: { box: 2, due: 5 } } })
      fetchMock.mockResolvedValue(failure(503, 'server_error'))
      await expect(reviewCard('g1', true)).rejects.toBeInstanceOf(ApiError)
      expect(useLearn.getState().flashcards.g1).toEqual({ box: 2, due: 5 })
    })
  })

  describe('syncLearning (GET /me/learning)', () => {
    const NOW = new Date('2026-11-02T12:00:00Z')
    const LEARNING = {
      lessons: {
        [THREE]: { progress: 1, completed: true, quizBest: 2 / 3, quizPassed: true, lastOpened: '2026-11-01T09:00:00Z' },
        [FOUR]: { progress: 0.4, completed: false, quizBest: 0, quizPassed: false, lastOpened: null },
      },
      bookmarks: [FOUR],
      lastLesson: THREE,
      flashcards: { g1: { box: 2, due: '2026-11-03T10:00:00Z' } },
      spotBest: 7,
      serverTime: '2026-11-02T10:00:00Z',
    }

    it("makes the account's learning the one this device shows", async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      useLearn.setState({ bookmarks: ['from-before'], spotBest: 99 })
      fetchMock.mockResolvedValue(json(200, LEARNING))
      await syncLearning()
      const s = useLearn.getState()
      expect(calls()).toEqual(['GET /api/v1/me/learning'])
      expect(s.lessons[THREE]).toEqual({
        progress: 1,
        completed: true,
        quizBest: 2 / 3,
        quizPassed: true,
        lastOpened: '2026-11-01T09:00:00Z',
      })
      expect(s.bookmarks).toEqual([FOUR])
      expect(s.lastLesson).toBe(THREE)
      expect(s.spotBest).toBe(7) // replaced, not the larger of the two
      expect(s.flashcards.g1).toEqual({ box: 2, due: NOW.getTime() + 86_400_000 }) // 24 h after the server's now
    })

    it('never shows a missing "last opened" as the time of the sync', async () => {
      fetchMock.mockResolvedValue(json(200, LEARNING))
      await syncLearning()
      expect(useLearn.getState().lessons[FOUR].lastOpened).toBe(new Date(0).toISOString())
    })

    it('does nothing for a guest', async () => {
      useSession.setState({ user: GUEST, token: null })
      useLearn.setState({ bookmarks: ['mine'] })
      await syncLearning()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useLearn.getState().bookmarks).toEqual(['mine'])
    })

    it('keeps what it has when the server cannot be reached', async () => {
      useLearn.setState({ bookmarks: ['mine'] })
      fetchMock.mockResolvedValue(failure(503, 'server_error'))
      await expect(syncLearning()).rejects.toBeInstanceOf(ApiError)
      expect(useLearn.getState().bookmarks).toEqual(['mine'])
    })

    it('refuses an answer it cannot read', async () => {
      fetchMock.mockResolvedValue(json(200, { nothing: true }))
      await expect(syncLearning()).rejects.toMatchObject({ code: 'server_error' })
    })

    it('drops an answer that arrives after someone else signed in', async () => {
      let release!: (r: Response) => void
      fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)))
      const pending = syncLearning()
      fetchMock.mockResolvedValue(json(200, { ...LEARNING, bookmarks: ['of-u2'] })) // the new person's own sync
      useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
      release(json(200, LEARNING))
      await pending
      await vi.waitFor(() => expect(useLearn.getState().bookmarks).toEqual(['of-u2']))
    })

    it('drops an answer that arrives after the person signed out (nobody is left to ask again)', async () => {
      let release!: (r: Response) => void
      fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)))
      const pending = syncLearning()
      useSession.getState().signOut()
      release(json(200, LEARNING))
      await pending
      expect(useLearn.getState().bookmarks).toEqual([])
      expect(useLearn.getState().lessons).toEqual({})
    })

    it('drops an older answer when a newer one was asked for', async () => {
      let first!: (r: Response) => void
      fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (first = res)))
      const older = syncLearning()
      fetchMock.mockResolvedValueOnce(json(200, { ...LEARNING, bookmarks: ['newer'] }))
      await syncLearning()
      first(json(200, LEARNING))
      await older
      expect(useLearn.getState().bookmarks).toEqual(['newer'])
    })
  })

  describe('when the person changes', () => {
    it("clears learning and progress of the one who left, and loads the new one's learning", async () => {
      useLearn.setState({ bookmarks: ['old'] })
      useProgress.setState({ xp: 500 })
      fetchMock.mockResolvedValue(
        json(200, { lessons: {}, bookmarks: ['of-u2'], lastLesson: null, flashcards: {}, spotBest: 0, serverTime: '2026-11-02T10:00:00Z' }),
      )
      useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
      expect(useLearn.getState().bookmarks).toEqual([]) // at once, before the answer
      expect(useProgress.getState().xp).toBe(0)
      await vi.waitFor(() => expect(useLearn.getState().bookmarks).toEqual(['of-u2']))
      expect(calls()).toEqual(['GET /api/v1/me/learning'])
    })

    it('clears both on sign-out and asks for nothing', () => {
      useLearn.setState({ bookmarks: ['old'] })
      useProgress.setState({ xp: 500 })
      useSession.getState().signOut()
      expect(useLearn.getState().bookmarks).toEqual([])
      expect(useProgress.getState().xp).toBe(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("replaces a guest's local learning with the account's on sign-in", async () => {
      useSession.setState({ user: GUEST, token: null })
      useLearn.setState({ bookmarks: ['guest-one'] })
      fetchMock.mockResolvedValue(
        json(200, { lessons: {}, bookmarks: [], lastLesson: null, flashcards: {}, spotBest: 0, serverTime: '2026-11-02T10:00:00Z' }),
      )
      useSession.setState({ user: { ...GUEST, id: 'u3', isGuest: false }, token: 'tok-3' })
      await vi.waitFor(() => expect(calls()).toEqual(['GET /api/v1/me/learning']))
      await vi.waitFor(() => expect(useLearn.getState().bookmarks).toEqual([]))
    })

    it('does nothing when the token stays the same (a profile edit)', () => {
      useLearn.setState({ bookmarks: ['keep'] })
      useSession.getState().updateProfile({ displayName: 'New name' })
      expect(useLearn.getState().bookmarks).toEqual(['keep'])
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
