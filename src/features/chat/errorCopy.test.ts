import { createElement } from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { AiErrorCode, ChatMessage } from '@/types'
import en from '@/i18n/en.json'
import viMessages from '@/i18n/vi.json'
import { MessageItem } from './components/MessageItem'
import { installDomStubs, renderChat } from './test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('every AiErrorCode and incomplete reason has copy in en and vi', () => {
  for (const messages of [en, viMessages]) {
    const errors: Record<AiErrorCode, string> = messages.chat.errors
    for (const text of Object.values(errors)) expect(text.trim()).not.toBe('')
    for (const reason of ['max_output_tokens', 'content_filter', 'max_messages', 'steered', 'budget', 'other'] as const) {
      expect(messages.chat.incomplete[reason].trim()).not.toBe('')
    }
    expect(messages.chat).toHaveProperty('notConfigured', expect.any(String))
    expect(messages.chat.subtitle).not.toMatch(/preview|bản xem trước/i)
  }
})

it('an unknown incomplete reason uses the other copy', async () => {
  installDomStubs()
  const message: ChatMessage = {
    id: 'reply',
    turnId: 'turn',
    role: 'assistant',
    content: 'Partial reply',
    cards: [],
    attachments: [],
    createdAt: '2026-10-28T00:00:00Z',
    status: 'interrupted',
    incompleteReason: 'future_reason',
  }
  await renderChat(createElement(MessageItem, { message, conversationId: 'conversation', last: false }))
  expect(screen.getByText(en.chat.incomplete.other)).toBeInTheDocument()
})

it('explains data handling in a keyboard dismissible disclosure', async () => {
  const { ChatPrivacy } = await import('./components/ChatPrivacy')
  await renderChat(createElement(ChatPrivacy))
  const trigger = screen.getByText('Learn more')
  fireEvent.click(trigger)
  expect(trigger.closest('details')).toHaveAttribute('open')
  expect(screen.getByRole('link', { name: 'OpenAI data controls' })).toHaveAttribute(
    'href',
    'https://developers.openai.com/api/docs/guides/your-data',
  )
  expect(screen.getByText(/abuse monitoring/i)).toBeInTheDocument()
  fireEvent.keyDown(trigger, { key: 'Escape' })
  expect(trigger.closest('details')).not.toHaveAttribute('open')
  expect(trigger).toHaveFocus()
})
