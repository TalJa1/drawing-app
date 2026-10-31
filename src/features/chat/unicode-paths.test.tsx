import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ChatComposer } from './components/ChatComposer'
import { installDomStubs, renderChat } from './test-utils'
import { buildTurnRequest } from './request'
import { useChat } from '@/store/chat'
import type { ChatMessage } from '@/types'

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
})
afterEach(cleanup)

it('allows 4000 astral characters in restored and edited composer text', async () => {
  const onSend = vi.fn()
  await renderChat(<ChatComposer conversationId="__new__" initialText={'🎨'.repeat(4000)} busy={false} onSend={onSend} onStop={vi.fn()} />)
  const input = screen.getByRole('textbox')
  expect(input).toHaveValue('🎨'.repeat(4000))
  expect(input).not.toHaveAttribute('maxlength', '4000')
  fireEvent.change(input, { target: { value: '🎨'.repeat(4001) } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSend).toHaveBeenCalledWith('🎨'.repeat(4000), [])
})

it('keeps whole history turns until the Unicode code-point budget is exceeded', async () => {
  const id = useChat.getState().create()
  const base = { attachments: [], cards: [], createdAt: new Date().toISOString() }
  const messages: ChatMessage[] = [
    { ...base, id: 'm1', turnId: 't1', role: 'user', content: '🎨'.repeat(30_000) },
    { ...base, id: 'm2', turnId: 't1', role: 'assistant', content: '🎨'.repeat(30_000), status: 'completed' },
    { ...base, id: 'm3', turnId: 't2', role: 'user', content: 'Next' },
  ]
  const conversation = { ...useChat.getState().conversations[0], messages }
  expect(conversation.id).toBe(id)
  const payload = await buildTurnRequest(conversation, 't2', 'send', null)
  expect(payload.history).toHaveLength(2)
  messages[1] = { ...messages[1], content: messages[1].content + 'x' }
  expect((await buildTurnRequest({ ...conversation, messages }, 't2', 'send', null)).history).toHaveLength(0)
})
