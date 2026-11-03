import { act, cleanup } from '@testing-library/react'
import type { ChatMessage } from '@/types'
import { useChat } from '@/store/chat'
import { useChatStream } from '../streamStore'
import { installDomStubs, renderChat } from '../test-utils'
import { MessageItem } from './MessageItem'

const card = { type: 'idea', title: 'Pond', description: 'Draw a pond at dusk', difficulty: 'beginner', minutes: 15 } as const
const streaming: ChatMessage = {
  id: 'm_2',
  turnId: 't_1',
  role: 'assistant',
  content: '',
  cards: [],
  attachments: [],
  createdAt: '2026-11-02T00:00:00Z',
  status: 'streaming',
}

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
})
afterEach(() => {
  cleanup()
  useChatStream.setState({ active: null })
})

it('cards stay mounted when the stream settles', async () => {
  useChatStream.setState({
    active: {
      requestId: 'r_1',
      conversationId: 'c_1',
      turnId: 't_1',
      messageId: 'm_2',
      phase: 'streaming',
      content: 'Hello',
      cards: [card],
    },
  })
  const view = await renderChat(
    <ol>
      <MessageItem message={streaming} conversationId="c_1" last />
    </ol>,
  )
  const before = view.container.querySelector('[data-card-type="idea"]')
  expect(before).not.toBeNull()
  // The controller clears the live stream and commits the reply in the same tick.
  act(() => {
    useChatStream.setState({ active: null })
    view.rerender(
      <ol>
        <MessageItem message={{ ...streaming, status: 'completed', content: 'Hello', cards: [card] }} conversationId="c_1" last />
      </ol>,
    )
  })
  expect(view.container.querySelector('[data-card-type="idea"]')).toBe(before)
})

it('the streaming tail carries the ink caret, the settled reply does not', async () => {
  useChatStream.setState({
    active: {
      requestId: 'r_1',
      conversationId: 'c_1',
      turnId: 't_1',
      messageId: 'm_2',
      phase: 'streaming',
      content: 'One.\n\nTwo',
      cards: [],
    },
  })
  const view = await renderChat(
    <ol>
      <MessageItem message={streaming} conversationId="c_1" last />
    </ol>,
  )
  expect(view.container.querySelectorAll('[class*="last-child]:after:bg-accent-ink"]')).toHaveLength(1)
  act(() => useChatStream.setState({ active: null }))
  view.rerender(
    <ol>
      <MessageItem message={{ ...streaming, status: 'completed', content: 'One.\n\nTwo' }} conversationId="c_1" last />
    </ol>,
  )
  expect(view.container.querySelectorAll('[class*="last-child]:after:bg-accent-ink"]')).toHaveLength(0)
})
