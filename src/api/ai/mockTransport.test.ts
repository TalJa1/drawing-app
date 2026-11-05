import type { ChatStreamEvent } from '@/types'
import type { ChatTurnRequest } from '@/features/chat/contract'
import { chatCardSchema } from '@/features/chat/contract'
import { buildReply } from '@/api/chat'
import { getTemplates } from '@/api/templates'
import { queryClient } from '@/app/queryClient'
import { TEMPLATES } from '@/mocks/templates'
import { useSettings } from '@/store/settings'
import { AiTransportError } from './errors'
import { createMockTransport, mockTransport } from './mockTransport'
import { getChatTransport } from './transport'

vi.mock('@/api/templates', () => ({ getTemplates: vi.fn() }))

const request: ChatTurnRequest = {
  protocolVersion: 1,
  requestId: 'r_1',
  conversationId: 'c_1',
  turnId: 't_1',
  action: 'send',
  mode: 'colour',
  lang: 'en',
  message: { text: 'colours that go with teal', images: [] },
  history: [],
  learner: null,
}

// the mock loads its template source on demand; load it before the fake clock starts so a timer run cannot outrun the import
beforeAll(async () => {
  await Promise.all([import('@/app/queryClient'), import('@/api/queries')])
})

beforeEach(() => {
  vi.useFakeTimers()
  useSettings.setState({ simulateErrors: false })
  queryClient.clear()
  vi.mocked(getTemplates).mockReset().mockResolvedValue(TEMPLATES)
})
afterEach(() => {
  vi.useRealTimers()
  useSettings.setState({ simulateErrors: false })
})

it('emits status, tokens, cards then done', async () => {
  const events: ChatStreamEvent[] = []
  const consume = (async () => {
    for await (const event of mockTransport.streamTurn(request, new AbortController().signal)) events.push(event)
  })()
  await vi.runAllTimersAsync()
  await consume
  expect(getChatTransport()).toBe(mockTransport)
  expect(events[0]).toEqual({ type: 'status', phase: 'thinking' })
  expect(events.at(-1)).toEqual({ type: 'done', finish: 'completed' })
  const tokens = events.filter((e) => e.type === 'token')
  expect(tokens.map((e) => e.text).join('')).toBe(
    buildReply({ message: request.message.text, mode: request.mode, lang: request.lang }).text,
  )
  const firstCard = events.findIndex((e) => e.type === 'card')
  expect(firstCard).toBeGreaterThan(tokens.length)
  expect(events.slice(firstCard, -1).every((e) => e.type === 'card' && chatCardSchema.safeParse(e.card).success)).toBe(true)
  useSettings.setState({ simulateErrors: true })
  const failing = mockTransport.streamTurn(request, new AbortController().signal)[Symbol.asyncIterator]()
  await expect(failing.next()).rejects.toMatchObject({ code: 'upstream', name: 'AiTransportError' })
  expect(new AiTransportError('ai_busy', 5000).retryAfterMs).toBe(5000)
})

it('abort rejects with AbortError and never emits done', async () => {
  const ctrl = new AbortController()
  const iterator = mockTransport.streamTurn(request, ctrl.signal)[Symbol.asyncIterator]()
  expect((await iterator.next()).value).toEqual({ type: 'status', phase: 'thinking' })
  const next = iterator.next()
  ctrl.abort()
  await expect(next).rejects.toMatchObject({ name: 'AbortError' })
  expect(await iterator.next()).toEqual({ done: true, value: undefined })
})

it('optionally emits valid cards before any text and keeps the guidance delay abortable', async () => {
  const transport = createMockTransport({ cardsFirst: true, textDelayMs: 3000 })
  const controller = new AbortController()
  const events: ChatStreamEvent[] = []
  const consume = (async () => {
    for await (const event of transport.streamTurn(request, controller.signal)) events.push(event)
  })()
  await vi.advanceTimersByTimeAsync(1500)
  expect(events.some((event) => event.type === 'card' && chatCardSchema.safeParse(event.card).success)).toBe(true)
  expect(events.some((event) => event.type === 'token')).toBe(false)
  const aborted = expect(consume).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await aborted
  expect(events.some((event) => event.type === 'done')).toBe(false)
})

it('mock palettes contain no duplicate hex (case-insensitive)', () => {
  for (const lang of ['en', 'vi'] as const) {
    const reply = buildReply({ message: lang === 'en' ? 'colours that go with gray' : 'màu nào hợp với xám', mode: 'colour', lang })
    const palettes = reply.cards.filter((c) => c.type === 'palette')
    expect(palettes).toHaveLength(3)
    for (const card of palettes) expect(new Set(card.colors.map((c) => c.toLowerCase())).size).toBe(card.colors.length)
  }
})

async function cardTypesFor(text: string) {
  const types: string[] = []
  const run = (async () => {
    for await (const event of mockTransport.streamTurn({ ...request, mode: 'ideas', message: { text, images: [] } }, new AbortController().signal)) {
      if (event.type === 'card') types.push(event.card.type)
    }
  })()
  await vi.runAllTimersAsync()
  await run
  return types
}

it('suggests a template card only from the templates the server has', async () => {
  expect(await cardTypesFor('Give me 5 drawing ideas for beginners')).toContain('template')
  queryClient.clear()
  vi.mocked(getTemplates).mockRejectedValue(new Error('offline'))
  const offline = await cardTypesFor('Give me 5 drawing ideas for beginners')
  expect(offline).toContain('idea')
  expect(offline).not.toContain('template')
})
