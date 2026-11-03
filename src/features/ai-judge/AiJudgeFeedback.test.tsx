import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Artwork, ScoreResult, Template } from '@/types'
import { AiTransportError } from '@/api/ai/errors'
import type { JudgeFeedback } from '@/api/ai/judgeContract'
import { useSettings } from '@/store/settings'
import { installDomStubs, renderChat } from '@/features/chat/test-utils'
import { AiJudgeFeedback } from './AiJudgeFeedback'
import { clearJudgeCache } from './useJudgeFeedback'

const mocks = vi.hoisted(() => ({
  requestFeedback: vi.fn<(req: unknown, signal: AbortSignal) => Promise<unknown>>(),
  buildJudgeRequest: vi.fn(async () => ({ requestId: 'j_test' })),
}))
vi.mock('@/api/ai/judgeTransport', () => ({ getJudgeTransport: () => ({ requestFeedback: mocks.requestFeedback }) }))
vi.mock('./judgeRequest', () => ({ buildJudgeRequest: mocks.buildJudgeRequest }))

const feedback: JudgeFeedback = {
  summary: 'Your fox reads clearly and the warm colours sit well together.',
  strengths: ['The orange body stays inside the outline.', 'The tail has a clear shape.'],
  tips: ['Fill the small gaps around the ears.', 'Add one darker shade under the tail.'],
  exercise: 'Colour the tail again using two shades of one colour.',
}
const score = {
  artworkId: 'art_1',
  similarity: 78,
  colour: 63,
  overall: 71,
  sub: { lineAccuracy: 80, composition: 84, proportion: 70, harmony: 52, suitability: 66, aesthetics: 71 },
  rank: 'steady',
  strengths: [],
  weaknesses: [],
  feedback: [],
  tips: [],
  judgeNote: { en: 'note', vi: 'ghi chú' },
  scoredAt: '2026-11-03T08:00:00.000Z',
} as ScoreResult
const artwork = { id: 'art_1', imageKey: 'img:art_1', score } as Artwork
const template = { id: 'fox', title: { en: 'Sitting Fox', vi: 'Cáo ngồi' } } as Template

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const panel = () => renderChat(<AiJudgeFeedback artwork={artwork} template={template} score={score} />)
const ask = () => fireEvent.click(screen.getByRole('button', { name: 'Ask Muse for feedback' }))

beforeEach(() => {
  installDomStubs()
  clearJudgeCache()
  mocks.requestFeedback.mockReset()
  mocks.buildJudgeRequest.mockClear()
  useSettings.setState({ language: 'en' })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('sends nothing until the learner asks, and says where the drawing goes', async () => {
  await panel()
  expect(screen.getByRole('heading', { name: "Muse's feedback" })).toBeVisible()
  expect(screen.getByText(/sent through the Art Spark server to OpenAI/)).toBeVisible()
  expect(screen.getByText(/not used to train models/)).toBeVisible()
  expect(screen.getByText(/abuse-monitoring logs .* up to 30 days/)).toBeVisible()
  expect(screen.getByText(/score does not change/)).toBeVisible()
  expect(mocks.buildJudgeRequest).not.toHaveBeenCalled()
  expect(mocks.requestFeedback).not.toHaveBeenCalled()
})

it('announces loading in a status region, then shows the feedback with the formula label', async () => {
  const pending = deferred<JudgeFeedback>()
  mocks.requestFeedback.mockReturnValue(pending.promise)
  await panel()
  ask()
  expect(await screen.findByRole('status')).toHaveTextContent('Muse is looking at your drawing')
  expect(screen.queryByRole('button', { name: 'Ask Muse for feedback' })).toBeNull()
  expect(mocks.buildJudgeRequest).toHaveBeenCalledWith(artwork, template, score, 'en')
  await act(async () => pending.resolve(feedback))
  expect(screen.getByRole('status')).toHaveTextContent("Muse's feedback is ready.")
  expect(screen.getByText(feedback.summary)).toBeVisible()
  const strengths = screen.getByRole('list', { name: 'What works' })
  expect(
    within(strengths)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(feedback.strengths)
  const tips = screen.getByRole('list', { name: 'Tips' })
  expect(tips.tagName).toBe('OL')
  expect(
    within(tips)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(feedback.tips)
  expect(screen.getByRole('heading', { name: 'Try it now' })).toBeVisible()
  expect(screen.getByText(feedback.exercise)).toBeVisible()
  expect(screen.getByText('Muse · AI — the score comes from the formula')).toBeVisible()
})

it.each([
  ['rate_limited', "You've asked Muse a lot just now."],
  ['ai_busy', 'Muse is helping other learners right now.'],
  ['ai_budget_exceeded', "Muse has used today's feedback allowance."],
  ['unauthorized', 'Please sign in to ask Muse for feedback.'],
  ['ai_not_configured', "Muse's feedback isn't set up on this server yet."],
  ['network', "Can't reach the Art Spark server. Check your connection."],
  ['timeout', 'Muse took too long to answer.'],
  ['upstream', "Muse couldn't write feedback this time."],
  ['image_missing', "Your drawing couldn't be read on this device."],
  ['validation_error', 'Something went wrong while asking Muse.'],
] as const)('explains %s in plain words and offers a retry', async (code, message) => {
  mocks.requestFeedback.mockRejectedValueOnce(new AiTransportError(code)).mockResolvedValueOnce(feedback)
  await panel()
  ask()
  expect(await screen.findByText(message)).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(message)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(feedback.summary)).toBeVisible()
  expect(mocks.requestFeedback).toHaveBeenCalledTimes(2)
})

it.each([
  ['rate_limited', 30_000, 'Try again in 30 s.'],
  ['ai_busy', 5_000, 'Try again in 5 s.'],
  ['ai_budget_exceeded', 7_200_000, 'Try again in 2 h.'],
  ['rate_limited', 150_000, 'Try again in 3 min.'],
] as const)('shows the %s wait from Retry-After', async (code, retryAfterMs, wait) => {
  mocks.requestFeedback.mockRejectedValue(new AiTransportError(code, retryAfterMs))
  await panel()
  ask()
  expect(await screen.findByText(wait)).toBeVisible()
})

it('falls back to a generic message for unexpected failures', async () => {
  mocks.buildJudgeRequest.mockRejectedValueOnce(new Error('boom'))
  await panel()
  ask()
  expect(await screen.findByText('Something went wrong while asking Muse.')).toBeVisible()
})

it('aborts the request when the panel unmounts', async () => {
  mocks.requestFeedback.mockReturnValue(new Promise(() => undefined))
  const view = await panel()
  ask()
  await waitFor(() => expect(mocks.requestFeedback).toHaveBeenCalled())
  const signal = mocks.requestFeedback.mock.calls[0][1]
  expect(signal.aborted).toBe(false)
  view.unmount()
  expect(signal.aborted).toBe(true)
})

it('keeps feedback for the session per artwork, score time and language', async () => {
  mocks.requestFeedback.mockResolvedValue(feedback)
  const first = await panel()
  ask()
  expect(await screen.findByText(feedback.summary)).toBeVisible()
  first.unmount()
  await panel()
  expect(screen.getByText(feedback.summary)).toBeVisible()
  expect(mocks.requestFeedback).toHaveBeenCalledTimes(1)
  act(() => useSettings.setState({ language: 'vi' }))
  expect(screen.getByRole('button', { name: 'Ask Muse for feedback' })).toBeVisible()
  expect(screen.queryByText(feedback.summary)).toBeNull()
  const stored = [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
  expect(stored.filter((key) => /judge|feedback/i.test(key))).toEqual([])
})
