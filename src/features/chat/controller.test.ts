import type { ChatMessage, ChatStreamEvent, Conversation } from '@/types'
import type { ChatTransport } from '@/api/ai/transport'
import { AiTransportError } from '@/api/ai/errors'
import { putFile } from '@/api/imageStore'
import { useChat } from '@/store/chat'
import { createChatController } from './controller'
import { useChatStream } from './streamStore'
import { buildTurnRequest } from './request'
import * as images from './chatImages'

vi.mock('@/api/imageStore', () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn(), listKeys: vi.fn().mockResolvedValue([]) }))

function channel() {
  type Item = ChatStreamEvent | Error | null
  const queue: Item[] = []
  let pending: ((item: Item) => void) | undefined
  return {
    push(item: Item) {
      if (pending) {
        const resolve = pending
        pending = undefined
        resolve(item)
      } else queue.push(item)
    },
    async next(): Promise<IteratorResult<ChatStreamEvent>> {
      const item = queue.length
        ? queue.shift()!
        : await new Promise<Item>((resolve) => {
            pending = resolve
          })
      if (item instanceof Error) throw item
      return item === null ? { done: true, value: undefined } : { done: false, value: item }
    },
    async return(): Promise<IteratorResult<ChatStreamEvent>> {
      return { done: true, value: undefined }
    },
  }
}

function setup() {
  const channels: ReturnType<typeof channel>[] = []
  const signals: AbortSignal[] = []
  const streamTurn = vi.fn<ChatTransport['streamTurn']>((_request, signal) => {
    const source = channel()
    channels.push(source)
    signals.push(signal)
    return { [Symbol.asyncIterator]: () => source }
  })
  const buildRequest = vi.fn((conv: Conversation, turnId: string, action: 'send' | 'regenerate') =>
    buildTurnRequest(conv, turnId, action, null),
  )
  const activity = vi.fn()
  const controller = createChatController({ transport: { streamTurn }, buildRequest, recordTurnActivity: activity })
  const convId = useChat.getState().create('ideas')
  return { controller, channels, signals, streamTurn, buildRequest, activity, convId }
}
const settle = () => vi.advanceTimersByTimeAsync(0)
const reply = (convId: string) =>
  useChat
    .getState()
    .conversations.find((c) => c.id === convId)!
    .messages.at(-1)!
const done = { type: 'done', finish: 'completed' } as const

beforeEach(() => {
  vi.useFakeTimers()
  useChat.getState().reset()
  useChatStream.setState({ active: null })
})
afterEach(() => {
  useChat.getState().reset()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('ignores a second send while a turn is streaming', async () => {
  const h = setup()
  const first = h.controller.send(h.convId, 'first question', 'ideas', [])
  await settle()
  await h.controller.send(h.convId, 'second question', 'colour', [])
  expect(h.streamTurn).toHaveBeenCalledTimes(1)
  expect(useChat.getState().conversations[0].messages).toHaveLength(2)
  h.channels[0].push(done)
  await first
})

it('stop keeps received text and marks the reply stopped', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Partial text' })
  await settle()
  h.controller.stop()
  await pending
  expect(reply(h.convId)).toMatchObject({ content: 'Partial text', status: 'stopped' })
  expect(h.signals[0].aborted).toBe(true)
  expect(useChatStream.getState().active).toBeNull()
})

it('stop before the first token leaves an empty stopped reply without error', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  h.controller.stop()
  await pending
  expect(reply(h.convId)).toMatchObject({ content: '', status: 'stopped' })
  expect(reply(h.convId).errorCode).toBeUndefined()
  expect(h.activity).not.toHaveBeenCalled()
})

it('stores retryAt when a turn fails with retryAfterMs', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  const now = Date.now()
  h.channels[0].push({ type: 'error', code: 'rate_limited', retryAfterMs: 5000 })
  await pending
  expect(reply(h.convId).retryAt).toBe(new Date(now + 5000).toISOString())
  const retry = h.controller.retry(h.convId)
  expect(reply(h.convId).retryAt).toBeUndefined()
  await settle()
  const next = Date.now()
  h.channels[1].push(new AiTransportError('ai_busy', 3000))
  await retry
  expect(reply(h.convId).retryAt).toBe(new Date(next + 3000).toISOString())
})

it('network error marks the reply failed with code network', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push(new TypeError('Failed to fetch'))
  await pending
  expect(reply(h.convId)).toMatchObject({ status: 'failed', errorCode: 'network' })
})

it('upstream error after tokens keeps the partial text', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Keep this' })
  h.channels[0].push({ type: 'error', code: 'upstream' })
  await pending
  expect(reply(h.convId)).toMatchObject({ content: 'Keep this', status: 'failed', errorCode: 'upstream' })
  const retry = h.controller.retry(h.convId)
  await settle()
  h.channels[1].push(new AiTransportError('rate_limited', 5000))
  await retry
  expect(reply(h.convId)).toMatchObject({ status: 'failed', errorCode: 'rate_limited' })
})

it('unexpected client error marks failed with code client', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push(new Error('Unexpected failure'))
  await pending
  expect(reply(h.convId)).toMatchObject({ status: 'failed', errorCode: 'client' })
})

it('EOF without done marks the reply interrupted', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Not finished' })
  h.channels[0].push(null)
  await pending
  expect(reply(h.convId)).toMatchObject({ content: 'Not finished', status: 'interrupted' })
})

it('done incomplete marks interrupted with the reason', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Not finished' })
  h.channels[0].push({ type: 'done', finish: 'incomplete', reason: 'max_output_tokens' })
  await pending
  expect(reply(h.convId)).toMatchObject({ status: 'interrupted', incompleteReason: 'max_output_tokens', content: 'Not finished' })
})

it('late events after stop are ignored', async () => {
  const h = setup()
  const first = h.controller.send(h.convId, 'first', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Original' })
  await settle()
  h.controller.stop()
  const second = h.controller.send(h.convId, 'second', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'Stale text' })
  h.channels[1].push({ type: 'token', text: 'New reply' })
  h.channels[1].push(done)
  await Promise.all([first, second])
  expect(reply(h.convId)).toMatchObject({ content: 'New reply', status: 'completed' })
  expect(useChat.getState().conversations[0].messages[1].content).toBe('Original')
})

it('writes the persisted store only at start, checkpoints and end', async () => {
  for (const [duration, expected] of [
    [1000, 2],
    [5000, 4],
  ]) {
    const h = setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    spy.mockClear()
    const pending = h.controller.send(h.convId, 'question', 'ideas', [])
    await settle()
    for (let i = 0; i < duration / 100; i++) {
      h.channels[0].push({ type: 'token', text: 'x' })
      await vi.advanceTimersByTimeAsync(100)
    }
    if (duration === 5000) {
      const state = JSON.parse(localStorage.getItem('artspark:chat')!).state
      expect(state.conversations.find((c: Conversation) => c.id === h.convId).messages.at(-1)).toMatchObject({
        content: 'x'.repeat(40),
        status: 'streaming',
      })
    }
    h.channels[0].push(done)
    await pending
    expect(spy.mock.calls.filter(([key]) => key === 'artspark:chat')).toHaveLength(expected)
    spy.mockRestore()
  }
})

it('images are written to IndexedDB only on send', async () => {
  const h = setup()
  const spy = vi.spyOn(images, 'saveChatImages')
  vi.mocked(putFile).mockClear()
  const prepared = {
    id: 'a_1',
    name: 'art.jpg',
    previewBlob: new Blob(['preview']),
    analysisBlob: new Blob(['full']),
    width: 100,
    height: 100,
    hash: 'hash',
    mime: 'image/jpeg' as const,
  }
  expect(spy).not.toHaveBeenCalled()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [prepared])
  await settle()
  h.channels[0].push(done)
  await pending
  expect(spy).toHaveBeenCalledOnce()
  expect(putFile).toHaveBeenCalledTimes(2)
  expect(useChat.getState().conversations[0].imageContextTurnId).toBe(reply(h.convId).turnId)
  const again = h.controller.regenerate(h.convId)
  await settle()
  h.channels[1].push(done)
  await again
  expect(spy).toHaveBeenCalledOnce()
})

it('retry and regenerate act only on the last turn', async () => {
  const h = setup()
  const date = new Date().toISOString()
  const user: ChatMessage = {
    id: 'u_1',
    turnId: 't_1',
    role: 'user',
    content: 'old',
    cards: [],
    attachments: [],
    createdAt: date,
    mode: 'ideas',
  }
  const assistant: ChatMessage = { ...user, id: 'a_1', role: 'assistant', status: 'failed' }
  useChat.setState((s) => ({
    conversations: s.conversations.map((c) => ({ ...c, messages: [user, assistant, { ...user, id: 'u_2', turnId: 't_2' }] })),
  }))
  await h.controller.retry(h.convId)
  await h.controller.regenerate(h.convId)
  expect(h.streamTurn).not.toHaveBeenCalled()
  useChat.getState().addMessage(h.convId, { ...assistant, id: 'a_2', turnId: 't_2' })
  const retry = h.controller.retry(h.convId)
  await settle()
  h.channels[0].push(done)
  await retry
  expect(useChat.getState().conversations[0].messages).toHaveLength(4)
  expect(useChat.getState().conversations[0].messages[1]).toEqual(assistant)
  await h.controller.retry(h.convId)
  expect(h.streamTurn).toHaveBeenCalledOnce()
})

it('regenerate keeps the previous answer as a variant', async () => {
  const h = setup()
  const first = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push({ type: 'token', text: 'First answer' })
  h.channels[0].push(done)
  await first
  const messageId = reply(h.convId).id
  const again = h.controller.regenerate(h.convId)
  await settle()
  h.channels[1].push({ type: 'token', text: 'Second answer' })
  h.channels[1].push(done)
  await again
  expect(reply(h.convId)).toMatchObject({
    id: messageId,
    content: 'Second answer',
    variants: [{ content: 'First answer', status: 'completed' }],
  })
  expect(useChat.getState().conversations[0].messages).toHaveLength(2)
})

it('regenerate uses the mode of the original turn', async () => {
  const h = setup()
  const first = h.controller.send(h.convId, 'question', 'colour', [])
  await settle()
  h.channels[0].push(done)
  await first
  useChat.getState().setMode(h.convId, 'history')
  const again = h.controller.regenerate(h.convId)
  await settle()
  expect(h.streamTurn.mock.calls[1][0]).toMatchObject({
    action: 'regenerate',
    mode: 'colour',
    history: [],
    message: { text: 'question', images: [] },
  })
  h.channels[1].push(done)
  await again
})

it('records chat activity once per turn', async () => {
  const h = setup()
  const first = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  h.channels[0].push(new TypeError('offline'))
  await first
  expect(h.activity).not.toHaveBeenCalled()
  const retry = h.controller.retry(h.convId)
  await settle()
  h.channels[1].push(done)
  await retry
  const again = h.controller.regenerate(h.convId)
  await settle()
  h.channels[2].push(done)
  await again
  expect(h.activity).toHaveBeenCalledOnce()
  const stopped = h.controller.send(h.convId, 'another', 'ideas', [])
  await settle()
  h.channels[3].push({ type: 'token', text: 'Partial' })
  await settle()
  h.controller.stop()
  await stopped
  expect(h.activity).toHaveBeenCalledTimes(2)
  const empty = h.controller.send(h.convId, 'empty', 'ideas', [])
  h.controller.stop()
  await empty
  expect(h.activity).toHaveBeenCalledTimes(2)
})

it('deleting the streaming conversation aborts the request', async () => {
  const h = setup()
  const pending = h.controller.send(h.convId, 'question', 'ideas', [])
  await settle()
  useChat.getState().remove(h.convId)
  await pending
  expect(h.signals[0].aborted).toBe(true)
  expect(useChat.getState().conversations).toEqual([])
  expect(useChatStream.getState().active).toBeNull()
})
