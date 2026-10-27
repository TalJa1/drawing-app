import type { ChatStreamEvent } from '@/types'
import type { ChatTurnRequest } from '@/features/chat/contract'
import { chatCardSchema } from '@/features/chat/contract'
import { buildReply } from '@/api/chat'
import { useSettings } from '@/store/settings'
import { AiTransportError } from './errors'
import { mockTransport } from './mockTransport'
import { getChatTransport } from './transport'

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

beforeEach(() => {
  vi.useFakeTimers()
  useSettings.setState({ simulateErrors: false })
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

it('mock palettes contain no duplicate hex (case-insensitive)', () => {
  for (const lang of ['en', 'vi'] as const) {
    const reply = buildReply({ message: lang === 'en' ? 'colours that go with gray' : 'màu nào hợp với xám', mode: 'colour', lang })
    const palettes = reply.cards.filter((c) => c.type === 'palette')
    expect(palettes).toHaveLength(3)
    for (const card of palettes) expect(new Set(card.colors.map((c) => c.toLowerCase())).size).toBe(card.colors.length)
  }
})
