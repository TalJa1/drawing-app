import { useSession } from '@/store/session'
import { AiTransportError } from './errors'
import { judgeFeedbackSchema, judgeResponseSchema, type JudgeFeedback, type JudgeRequest } from './judgeContract'
import { mockJudgeTransport } from './judgeMockTransport'
import { serverJudgeTransport } from './judgeServerTransport'
import { getJudgeTransport } from './judgeTransport'

const request: JudgeRequest = {
  protocolVersion: 1,
  requestId: 'j_1',
  lang: 'vi',
  templateId: 'fox',
  image: { id: 'a_1', name: 'fox.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA', width: 8, height: 6, hash: 'h_1' },
  score: {
    overall: 71,
    similarity: 78,
    colour: 63,
    rank: 'steady',
    sub: { lineAccuracy: 80, composition: 84, proportion: 70, harmony: 52, suitability: 66, aesthetics: 71 },
  },
}
const feedback: JudgeFeedback = {
  summary: 'Con cáo rõ hình, màu cam ấm.',
  strengths: ['Màu cam nằm gọn trong nét.'],
  tips: ['Tô kín khe nhỏ quanh tai.', 'Thêm một sắc độ đậm dưới đuôi.'],
  exercise: 'Tô lại đuôi bằng hai sắc độ của một màu.',
}
const ok = (body: unknown = { protocolVersion: 1, feedback }) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const envelope = (code: string, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message: 'private', traceId: 'trace' } }), { status, headers })
const send = (signal = new AbortController().signal) => serverJudgeTransport.requestFeedback(request, signal)

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(ok())
  useSession.setState({ token: null })
  vi.stubEnv('VITE_CHAT_TRANSPORT', '')
})
afterEach(() => {
  useSession.setState({ token: null })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('posts the request as JSON with the session token and returns the feedback', async () => {
  useSession.setState({ token: 'test-session-token' })
  const controller = new AbortController()
  await expect(send(controller.signal)).resolves.toEqual(feedback)
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/v1\/ai\/judge\/feedback$/)
  expect(init).toMatchObject({ method: 'POST', signal: controller.signal, body: JSON.stringify(request) })
  const headers = new Headers(init?.headers)
  expect(headers.get('Authorization')).toBe('Bearer test-session-token')
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('X-Request-ID')).toBe('j_1')
})

it('sends no Authorization header without a session token', async () => {
  await send()
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
})

// VITE_API_BASE already ends with the version (`/api/v1`, like the rest of the client), so the AI path adds only `/ai/...`.
it('builds the URL from VITE_API_BASE', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE', 'http://x/api/v1')
  const { serverJudgeTransport: configured } = await import('./judgeServerTransport')
  await configured.requestFeedback(request, new AbortController().signal)
  expect(fetchMock.mock.calls[0][0]).toBe('http://x/api/v1/ai/judge/feedback')
})

it('with the default base the feedback URL carries one /v1, the same prefix as every other request', async () => {
  vi.resetModules()
  const { serverJudgeTransport: configured } = await import('./judgeServerTransport')
  await configured.requestFeedback(request, new AbortController().signal)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/ai/judge/feedback')
})

it.each([
  ['rate_limited', 429, '30', 30_000],
  ['ai_busy', 429, '5', 5_000],
  ['ai_budget_exceeded', 429, '3600', 3_600_000],
  ['unauthorized', 401, undefined, undefined],
  ['ai_not_configured', 503, undefined, undefined],
  ['service_unavailable', 503, undefined, undefined],
  ['model_unavailable', 503, undefined, undefined],
  ['upstream', 502, undefined, undefined],
  ['timeout', 504, undefined, undefined],
  ['validation_error', 422, undefined, undefined],
  ['payload_too_large', 413, undefined, undefined],
])('maps the %s envelope and keeps Retry-After', async (code, status, retryAfter, retryAfterMs) => {
  fetchMock.mockResolvedValue(envelope(code, status, retryAfter ? { 'Retry-After': retryAfter } : {}))
  const error = await send().catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AiTransportError)
  expect(error).toMatchObject({ code, retryAfterMs })
})

it('falls back to upstream for unknown codes, invalid Retry-After and non-JSON errors', async () => {
  fetchMock.mockResolvedValue(envelope('future_code', 500, { 'Retry-After': 'soon' }))
  await expect(send()).rejects.toMatchObject({ code: 'upstream', retryAfterMs: undefined })
  fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
  await expect(send()).rejects.toMatchObject({ code: 'upstream' })
})

it('maps a failed fetch to network but keeps an abort as an AbortError', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(send()).rejects.toMatchObject({ code: 'network' })
  fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'))
  await expect(send()).rejects.toMatchObject({ name: 'AbortError' })
})

it.each([
  ['extra fields', { protocolVersion: 1, feedback, score: 80 }],
  ['a missing version', { feedback }],
  ['three strengths', { protocolVersion: 1, feedback: { ...feedback, strengths: ['a', 'b', 'c'] } }],
  ['four tips', { protocolVersion: 1, feedback: { ...feedback, tips: ['a', 'b', 'c', 'd'] } }],
  ['an empty exercise', { protocolVersion: 1, feedback: { ...feedback, exercise: '' } }],
  ['a long summary', { protocolVersion: 1, feedback: { ...feedback, summary: 'x'.repeat(241) } }],
  ['an extra feedback field', { protocolVersion: 1, feedback: { ...feedback, score: 80 } }],
])('rejects a success body with %s as protocol', async (_, body) => {
  fetchMock.mockResolvedValue(ok(body))
  await expect(send()).rejects.toMatchObject({ code: 'protocol' })
})

it('rejects a success response that is not JSON as protocol', async () => {
  fetchMock.mockResolvedValue(new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }))
  await expect(send()).rejects.toMatchObject({ code: 'protocol' })
})

it('counts Unicode code points like the server', () => {
  const emoji = '🎨'.repeat(240)
  expect(judgeFeedbackSchema.safeParse({ ...feedback, summary: emoji }).success).toBe(true)
  expect(judgeFeedbackSchema.safeParse({ ...feedback, summary: emoji + '🎨' }).success).toBe(false)
  expect(judgeResponseSchema.safeParse({ protocolVersion: 1, feedback }).success).toBe(true)
})

it('chooses transports like chat: mock in dev, server in builds or when asked', () => {
  vi.stubEnv('PROD', false)
  expect(getJudgeTransport()).toBe(mockJudgeTransport)
  vi.stubEnv('PROD', true)
  expect(getJudgeTransport()).toBe(serverJudgeTransport)
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'mock')
  expect(getJudgeTransport()).toBe(mockJudgeTransport)
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'server')
  vi.stubEnv('PROD', false)
  expect(getJudgeTransport()).toBe(serverJudgeTransport)
})
