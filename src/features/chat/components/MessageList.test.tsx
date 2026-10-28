import { act, fireEvent, screen } from '@testing-library/react'
import type { ChatMessage, Conversation } from '@/types'
import { MessageList } from './MessageList'
import { ChatStatus } from './ChatStatus'
import { useChat } from '@/store/chat'
import { useChatStream } from '../streamStore'
import { installDomStubs, renderChat } from '../test-utils'

vi.mock('@/lib/utils', async (original) => ({ ...(await original<object>()), copyText: vi.fn(async () => true) }))

const renders = vi.hoisted(() => vi.fn())
vi.mock('@/components/Markdown', () => ({
  Markdown: ({ text }: { text: string }) => {
    renders(text)
    return <p>{text}</p>
  },
}))
const date = '2026-10-27T00:00:00.000Z'
const reply = (id: string, patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  turnId: `t_${id}`,
  role: 'assistant',
  content: id,
  cards: [],
  attachments: [],
  createdAt: date,
  status: 'completed',
  ...patch,
})
const conversation = (messages: ChatMessage[], id = 'c_1'): Conversation => ({
  id,
  title: id,
  mode: 'ideas',
  createdAt: date,
  updatedAt: date,
  messages,
})
const stream = {
  requestId: 'r_1',
  conversationId: 'c_1',
  turnId: 't_live',
  messageId: 'live',
  phase: 'streaming' as const,
  content: 'first',
  cards: [],
}
beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
  useChatStream.setState({ active: null })
  renders.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('committed messages do not re-render on stream tokens', async () => {
  const c = conversation([reply('old'), reply('live', { content: '', status: 'streaming' })])
  useChat.setState({ conversations: [c], activeId: c.id })
  useChatStream.setState({ active: stream })
  await renderChat(<MessageList conversation={c} />)
  const oldRenders = renders.mock.calls.filter(([text]) => text === 'old').length
  expect(oldRenders).toBeGreaterThan(0)
  act(() => useChatStream.setState({ active: { ...stream, content: 'second chunk' } }))
  expect(screen.getByText('second chunk')).toBeInTheDocument()
  expect(renders.mock.calls.filter(([text]) => text === 'old')).toHaveLength(oldRenders)
})
it('status region announces completion once', async () => {
  const live = conversation([reply('live', { status: 'streaming' })])
  useChatStream.setState({ active: stream })
  const page = await renderChat(<ChatStatus conversation={live} />)
  const status = screen.getByRole('status')
  const observer = vi.fn()
  const mutations = new MutationObserver(observer)
  mutations.observe(status, { childList: true, subtree: true, characterData: true })
  act(() => useChatStream.setState({ active: { ...stream, content: 'another chunk' } }))
  await act(async () => {})
  expect(observer).not.toHaveBeenCalled()
  const completed = conversation([reply('live')])
  act(() => useChatStream.setState({ active: null }))
  page.rerender(<ChatStatus conversation={completed} />)
  await act(async () => {})
  expect(status).toHaveTextContent('Reply complete.')
  expect(observer).toHaveBeenCalledTimes(1)
  page.rerender(<ChatStatus conversation={completed} />)
  await act(async () => {})
  expect(observer).toHaveBeenCalledTimes(1)
  mutations.disconnect()
})
it('retry is shown only on the last turn', async () => {
  const c = conversation([reply('old', { status: 'failed', errorCode: 'network' }), reply('last', { status: 'interrupted' })])
  useChat.setState({ conversations: [c], activeId: c.id })
  await renderChat(<MessageList conversation={c} />)
  expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1)
  expect(screen.getByText('The connection was lost. Try again.')).toBeInTheDocument()
  expect(screen.getByRole('list')).not.toHaveAttribute('aria-live')
})
it('rate limited reply counts down and enables retry at retryAt', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(date))
  const c = conversation([
    reply('limited', { status: 'failed', errorCode: 'rate_limited', retryAt: new Date(Date.now() + 2000).toISOString() }),
  ])
  useChat.setState({ conversations: [c], activeId: c.id })
  await renderChat(<MessageList conversation={c} />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  expect(screen.getByText('Try again in 2 seconds.')).toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
})
it('reading older messages keeps the scroll position and exposes the latest button', async () => {
  const c = conversation([reply('live', { status: 'streaming' })])
  useChatStream.setState({ active: stream })
  await renderChat(<MessageList conversation={c} />)
  const thread = screen.getByRole('region', { name: 'Messages' })
  Object.defineProperties(thread, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, writable: true, value: 100 },
  })
  fireEvent.scroll(thread)
  vi.mocked(thread.scrollTo).mockClear()
  act(() => useChatStream.setState({ active: { ...stream, content: 'new token' } }))
  expect(thread.scrollTo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
  expect(thread.scrollTo).toHaveBeenCalled()
})

it('remembers the scroll position of each conversation', async () => {
  const first = conversation([reply('first')], 'c_scroll_first')
  const second = conversation([reply('second')], 'c_scroll_second')
  const page = await renderChat(<MessageList key={first.id} conversation={first} />)
  const thread = screen.getByRole('region', { name: 'Messages' })
  Object.defineProperty(thread, 'scrollTop', { configurable: true, writable: true, value: 450 })
  fireEvent.scroll(thread)
  page.rerender(<MessageList key={second.id} conversation={second} />)
  expect(screen.getByRole('region', { name: 'Messages' }).scrollTop).toBe(0)
  page.rerender(<MessageList key={first.id} conversation={first} />)
  expect(screen.getByRole('region', { name: 'Messages' }).scrollTop).toBe(450)
})

it('the latest-message button ignores countdown and copy updates', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(date))
  const c = conversation(
    [reply('copy'), reply('limited', { status: 'failed', errorCode: 'rate_limited', retryAt: new Date(Date.now() + 2000).toISOString() })],
    'c_countdown_copy',
  )
  useChat.setState({ conversations: [c], activeId: c.id })
  await renderChat(<MessageList conversation={c} />)
  await act(async () => {})
  const thread = screen.getByRole('region', { name: 'Messages' })
  Object.defineProperties(thread, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, writable: true, value: 100 },
  })
  fireEvent.scroll(thread)
  expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]))
  expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(1200))
  expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
})

it('new messages expose the latest button while reading above', async () => {
  const c = conversation([reply('first')], 'c_appended')
  useChat.setState({ conversations: [c], activeId: c.id })
  const page = await renderChat(<MessageList conversation={c} />)
  const thread = screen.getByRole('region', { name: 'Messages' })
  Object.defineProperties(thread, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, writable: true, value: 100 },
  })
  fireEvent.scroll(thread)
  const appended = { ...c, messages: [...c.messages, reply('second')] }
  act(() => useChat.setState({ conversations: [appended] }))
  page.rerender(<MessageList conversation={appended} />)
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument()
  expect(thread.scrollTop).toBe(100)
})

it('unknown incomplete reasons use the fallback and content filters have distinct copy', async () => {
  const c = conversation([
    reply('filtered', { status: 'interrupted', incompleteReason: 'content_filter' }),
    reply('unknown', { status: 'interrupted', incompleteReason: 'future_reason' }),
  ])
  await renderChat(<MessageList conversation={c} />)
  expect(screen.getByText('This reply was stopped by a safety filter. Try rephrasing your question.')).toBeInTheDocument()
  expect(screen.getByText('The reply ended before it was complete. Try again.')).toBeInTheDocument()
})
