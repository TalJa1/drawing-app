import { useSettings } from '@/store/settings'
import { AiTransportError } from './errors'
import { judgeFeedbackSchema, type JudgeFeedback, type JudgeRequest } from './judgeContract'
import { mockJudgeTransport } from './judgeMockTransport'

const sub = { lineAccuracy: 80, composition: 84, proportion: 70, harmony: 52, suitability: 66, aesthetics: 71 }
const request = (lang: 'en' | 'vi', weakest?: keyof typeof sub): JudgeRequest => ({
  protocolVersion: 1,
  requestId: 'j_1',
  lang,
  templateId: 'fox',
  image: { id: 'a_1', name: 'fox.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA', width: 8, height: 6, hash: 'h_1' },
  score: { overall: 71, similarity: 78, colour: 63, rank: 'steady', sub: weakest ? { ...sub, [weakest]: 10 } : sub },
})

beforeEach(() => {
  vi.useFakeTimers()
  useSettings.setState({ simulateErrors: false })
})
afterEach(() => {
  vi.useRealTimers()
  useSettings.setState({ simulateErrors: false })
})

async function answer(req: JudgeRequest, signal = new AbortController().signal) {
  let result: JudgeFeedback | undefined
  const pending = mockJudgeTransport.requestFeedback(req, signal).then((value) => (result = value))
  await vi.advanceTimersByTimeAsync(700)
  expect(result).toBeUndefined()
  await vi.advanceTimersByTimeAsync(200)
  await pending
  return result!
}

it('answers after about 800 ms with feedback that fits the contract', async () => {
  const feedback = await answer(request('en'))
  expect(judgeFeedbackSchema.parse(feedback)).toEqual(feedback)
})

it('aims a tip at the weakest aspect in the requested language', async () => {
  const lines = await answer(request('en', 'lineAccuracy'))
  const harmony = await answer(request('en', 'harmony'))
  const vi = await answer(request('vi', 'harmony'))
  expect(lines.tips[0]).toMatch(/line/i)
  expect(harmony.tips[0]).toMatch(/colou?r/i)
  expect(vi.tips[0]).toMatch(/màu/)
  expect(vi.summary).not.toEqual(harmony.summary)
})

it('never mentions score numbers', async () => {
  const feedback = await answer(request('en'))
  expect(JSON.stringify(feedback)).not.toMatch(/\d/)
})

it('rejects with an AbortError when aborted', async () => {
  const controller = new AbortController()
  const pending = mockJudgeTransport.requestFeedback(request('en'), controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

it('honours the simulated error switch', async () => {
  useSettings.setState({ simulateErrors: true })
  const error = await mockJudgeTransport.requestFeedback(request('en'), new AbortController().signal).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AiTransportError)
  expect(error).toMatchObject({ code: 'upstream' })
})
