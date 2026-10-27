import { serverTransport } from './serverTransport'
import { getChatTransport, checkAiHealth } from './transport'
import { mockTransport } from './mockTransport'
import { useSession } from '@/store/session'
import type { ChatTurnRequest } from '@/features/chat/contract'

const request: ChatTurnRequest = {
  protocolVersion: 1,
  requestId: 'r_1',
  conversationId: 'c_1',
  turnId: 't_1',
  action: 'send',
  mode: 'ideas',
  lang: 'vi',
  message: { text: 'Help me draw', images: [] },
  history: [],
  learner: null,
}
const consume = async (transport = serverTransport) => {
  const events = []
  for await (const event of transport.streamTurn(request, new AbortController().signal)) events.push(event)
  return events
}
const success = () =>
  new Response('data: {"type":"done","finish":"completed"}\n\n', { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(success())
  useSession.setState({ token: null })
  vi.stubEnv('VITE_CHAT_TRANSPORT', '')
})
afterEach(() => {
  useSession.setState({ token: null })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
it('maps 429 rate_limited + Retry-After to retryAfterMs', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'wait', traceId: 'trace' } }), {
      status: 429,
      headers: { 'Retry-After': '5' },
    }),
  )
  await expect(consume()).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 5000 })
})
it('maps 429 ai_busy', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'ai_busy' } }), { status: 429, headers: { 'Retry-After': '2' } }),
  )
  await expect(consume()).rejects.toMatchObject({ code: 'ai_busy', retryAfterMs: 2000 })
})
it('maps 503 ai_not_configured', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'ai_not_configured' } }), { status: 503 }))
  await expect(consume()).rejects.toMatchObject({ code: 'ai_not_configured' })
})
it('sends the Bearer token when the session has one', async () => {
  useSession.setState({ token: 'test-session-token' })
  await consume()
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/v1\/ai\/chat\/stream$/)
  expect(init).toMatchObject({ method: 'POST', signal: expect.any(AbortSignal), body: JSON.stringify(request) })
  const headers = new Headers(init?.headers)
  expect(headers.get('Authorization')).toBe('Bearer test-session-token')
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('X-Request-ID')).toBe('r_1')
})
it('builds the URL from VITE_API_BASE', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE', 'http://x/api')
  const { serverTransport: configured } = await import('./serverTransport')
  await consume(configured)
  expect(fetchMock.mock.calls[0][0]).toBe('http://x/api/v1/ai/chat/stream')
})
it('defaults to mock in dev and server in production builds', () => {
  vi.stubEnv('PROD', false)
  expect(getChatTransport()).toBe(mockTransport)
  vi.stubEnv('PROD', true)
  expect(getChatTransport()).toBe(serverTransport)
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'mock')
  expect(getChatTransport()).toBe(mockTransport)
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'server')
  vi.stubEnv('PROD', false)
  expect(getChatTransport()).toBe(serverTransport)
})
it('health check sends the token', async () => {
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'server')
  useSession.setState({ token: 'test-session-token' })
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ configured: true, protocolVersion: 1 })))
  expect(await checkAiHealth()).toEqual({ configured: true })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/v1\/ai\/health$/)
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-session-token')
})
it('health check is skipped for mock and returns null on errors', async () => {
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'mock')
  expect(await checkAiHealth()).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
  vi.stubEnv('VITE_CHAT_TRANSPORT', 'server')
  fetchMock.mockRejectedValue(new TypeError('offline'))
  expect(await checkAiHealth()).toBeNull()
  fetchMock.mockResolvedValue(new Response('{}'))
  expect(await checkAiHealth()).toBeNull()
})
it('unknown HTTP error codes fall back to upstream', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'future_server_error' } }), { status: 500, headers: { 'Retry-After': 'invalid' } }),
  )
  await expect(consume()).rejects.toMatchObject({ code: 'upstream', retryAfterMs: undefined })
})
it('rejects a successful response without an SSE body', async () => {
  fetchMock.mockResolvedValue(new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }))
  await expect(consume()).rejects.toMatchObject({ code: 'protocol' })
})
