import { useLearn } from './learn'

const LESSON = { progress: 0.5, completed: false, quizBest: 0, quizPassed: false, lastOpened: '2026-11-01T09:00:00.000Z' }

beforeEach(() => useLearn.getState().reset())

describe('useLearn', () => {
  it('replace() makes the given learning the whole state, forgetting what was there', () => {
    useLearn.setState({ bookmarks: ['old'], spotBest: 9, flashcards: { a: { box: 1, due: 1 } } })
    useLearn.getState().replace({ lessons: { x: LESSON }, bookmarks: ['new'], lastLesson: 'x', flashcards: {}, spotBest: 2 })
    const s = useLearn.getState()
    expect(s.lessons).toEqual({ x: LESSON })
    expect(s.bookmarks).toEqual(['new'])
    expect(s.lastLesson).toBe('x')
    expect(s.flashcards).toEqual({})
    expect(s.spotBest).toBe(2)
  })

  it('setBookmark() adds once and removes only that one', () => {
    const { setBookmark } = useLearn.getState()
    setBookmark('a', true)
    setBookmark('a', true)
    setBookmark('b', true)
    expect(useLearn.getState().bookmarks).toEqual(['a', 'b'])
    setBookmark('a', false)
    setBookmark('zzz', false)
    expect(useLearn.getState().bookmarks).toEqual(['b'])
  })

  it('reset() empties everything', () => {
    useLearn
      .getState()
      .replace({ lessons: { x: LESSON }, bookmarks: ['n'], lastLesson: 'x', flashcards: { a: { box: 1, due: 1 } }, spotBest: 2 })
    useLearn.getState().reset()
    const { lessons, bookmarks, lastLesson, flashcards, spotBest } = useLearn.getState()
    expect({ lessons, bookmarks, lastLesson, flashcards, spotBest }).toEqual({
      lessons: {},
      bookmarks: [],
      lastLesson: null,
      flashcards: {},
      spotBest: 0,
    })
  })
})
