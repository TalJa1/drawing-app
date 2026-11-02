import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en.json'
import { GUEST, useSession } from '@/store/session'
import type { Quiz as QuizT } from '@/types'
import { Quiz } from './Quiz'

/* The quiz runs on the real API layer; only the network (fetch) is faked. */

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const failure = (status: number, code: string) => json(status, { error: { code, message: 'English text from the server' } })
const loc = (s: string) => ({ en: s, vi: s })

const QUIZ: QuizT = {
  lessonSlug: 'rule-of-thirds',
  questions: [
    { id: 'q1', prompt: loc('First?'), options: [loc('A1'), loc('B1')] },
    { id: 'q2', prompt: loc('Second?'), options: [loc('A2'), loc('B2')] },
  ],
}
const RESULT = {
  correct: 1,
  total: 2,
  passed: false,
  reward: null,
  review: [
    { id: 'q1', answer: 0, explain: loc('because one') },
    { id: 'q2', answer: 1, explain: loc('because two') },
  ],
}
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))

/** answer both questions (first option, then `last`) and press the last button */
async function answerAll(last = 'B2') {
  fireEvent.click(screen.getByRole('radio', { name: /A1$/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`${last}$`) }))
  fireEvent.click(screen.getByRole('button', { name: 'See my score' }))
}

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  }))
})
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
  fetchMock.mockReset() // signing in started a fetch of the account's learning: not what these tests are about
})
afterEach(() => useSession.setState({ user: GUEST, token: null }))

describe('Quiz (signed in)', () => {
  it('sends all the answers at the end and shows the score and the explanations', async () => {
    fetchMock.mockResolvedValue(json(200, RESULT))
    render(<Quiz quiz={QUIZ} />)
    await answerAll()
    expect(await screen.findByText('because two')).toBeInTheDocument()
    expect(bodies()).toEqual([{ answers: [0, 1] }])
  })

  it('says so when the answers could not be sent, and keeps them', async () => {
    fetchMock.mockResolvedValueOnce(failure(503, 'server_error'))
    render(<Quiz quiz={QUIZ} />)
    await answerAll()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your answers weren’t sent.')
    expect(alert).toHaveTextContent('The studio is busy right now')
    expect(screen.queryByText('because two')).not.toBeInTheDocument()
  })

  it('sends the same answers again on "Try again"', async () => {
    fetchMock.mockResolvedValueOnce(failure(503, 'server_error')).mockResolvedValueOnce(json(200, RESULT))
    render(<Quiz quiz={QUIZ} />)
    await answerAll()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('because two')).toBeInTheDocument()
    expect(bodies()).toEqual([{ answers: [0, 1] }, { answers: [0, 1] }])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends a changed last answer in place of the old one (never one answer too many)', async () => {
    fetchMock.mockResolvedValueOnce(failure(503, 'server_error')).mockResolvedValueOnce(json(200, RESULT))
    render(<Quiz quiz={QUIZ} />)
    await answerAll('A2')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('radio', { name: /B2$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'See my score' }))
    await screen.findByText('because two')
    expect(bodies()).toEqual([{ answers: [0, 0] }, { answers: [0, 1] }])
  })

  it('can be retaken after a failure without the old error showing', async () => {
    fetchMock.mockResolvedValueOnce(failure(429, 'rate_limited')).mockResolvedValueOnce(json(200, RESULT))
    render(<Quiz quiz={QUIZ} />)
    await answerAll()
    expect(await screen.findByRole('alert')).toHaveTextContent('limit')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
