import { Profiler } from 'react'
import type { ComponentProps, ProfilerOnRenderCallback } from 'react'
import { act, cleanup, screen } from '@testing-library/react'
import { useChat } from '@/store/chat'
import { useSettings } from '@/store/settings'
import { MessageList } from './components/MessageList'
import { useChatStream } from './streamStore'
import { makeLongThread } from './fixtures/longThread'
import { installDomStubs, renderChat } from './test-utils'

const measurements = vi.hoisted(() => ({ item: vi.fn(), thread: vi.fn(), avatars: vi.fn(), mutations: vi.fn() }))

vi.mock('./components/MessageItem', async (original) => {
  const actual = await original<typeof import('./components/MessageItem')>()
  const { Profiler, memo } = await import('react')
  return {
    MessageItem: memo(function MeasuredItem(props: ComponentProps<typeof actual.MessageItem>) {
      return (
        <Profiler id={props.message.id} onRender={measurements.item}>
          <actual.MessageItem {...props} />
        </Profiler>
      )
    }),
  }
})
vi.mock('./Muse', async (original) => {
  const actual = await original<typeof import('./Muse')>()
  return {
    Muse: (props: ComponentProps<typeof actual.Muse>) => {
      measurements.avatars(props)
      return <actual.Muse {...props} />
    },
  }
})

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
  useChatStream.setState({ active: null })
  useSettings.setState({ motion: 'full' })
  Object.values(measurements).forEach((spy) => spy.mockClear())
  const NativeObserver = globalThis.MutationObserver
  vi.stubGlobal(
    'MutationObserver',
    class extends NativeObserver {
      constructor(callback: MutationCallback) {
        super((records, observer) => {
          measurements.mutations(records.length)
          callback(records, observer)
        })
      }
    },
  )
})
afterEach(() => {
  cleanup()
  useChat.getState().reset()
  useChatStream.setState({ active: null })
  useSettings.setState({ motion: 'system' })
  vi.unstubAllGlobals()
})

it('100-message thread: one token re-renders only the streaming item', async () => {
  const conversation = makeLongThread()
  const last = conversation.messages.at(-1)!
  const active = {
    requestId: 'perf_request',
    conversationId: conversation.id,
    turnId: last.turnId,
    messageId: last.id,
    phase: 'streaming' as const,
    content: last.content,
    cards: last.cards,
  }
  useChat.setState({ conversations: [conversation], activeId: conversation.id })
  useChatStream.setState({ active })
  await renderChat(
    <Profiler id="thread" onRender={measurements.thread as ProfilerOnRenderCallback}>
      <MessageList conversation={conversation} />
    </Profiler>,
  )
  await act(async () => {})
  expect(screen.getByRole('region', { name: 'Messages' }).querySelector('ol.mx-auto')?.children).toHaveLength(100)
  const mountMs = measurements.thread.mock.calls[0][2] as number
  measurements.item.mockClear()
  measurements.thread.mockClear()
  measurements.avatars.mockClear()
  measurements.mutations.mockClear()
  for (let index = 1; index <= 20; index++) {
    await act(async () => useChatStream.setState({ active: { ...active, content: `${active.content}\n\nChunk ${index}` } }))
  }
  const itemIds = [...new Set(measurements.item.mock.calls.map(([id]) => id))]
  expect(itemIds).toEqual([last.id])
  expect(measurements.avatars.mock.calls.every(([props]) => props.still === true)).toBe(true)
  const updates = measurements.thread.mock.calls.map((call) => call[2] as number)
  expect(updates.length).toBeGreaterThanOrEqual(20)
  expect(Math.max(...updates)).toBeLessThan(100)
  console.info('Chat profiler (100 messages, 20 chunks)', {
    mountMs: Number(mountMs.toFixed(3)),
    meanChunkMs: Number((updates.reduce((sum, value) => sum + value, 0) / updates.length).toFixed(3)),
    maxChunkMs: Number(Math.max(...updates).toFixed(3)),
    updatedItemIds: itemIds,
    mutationCallbacks: measurements.mutations.mock.calls.length,
  })
})

it('history avatars are still', async () => {
  await renderChat(<MessageList conversation={makeLongThread()} />)
  const avatars = screen.getByRole('region', { name: 'Messages' }).querySelectorAll('svg[data-state]')
  expect(avatars).toHaveLength(50)
  for (const avatar of avatars) expect(avatar).toHaveStyle({ transform: 'none' })
  expect(measurements.avatars).toHaveBeenCalled()
  expect(measurements.avatars.mock.calls.every(([props]) => props.still === true)).toBe(true)
})
