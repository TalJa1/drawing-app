import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import ChatPage from '@/pages/chat/ChatPage'
import { useChat } from '@/store/chat'
import { useChatStream } from '../streamStore'
import { useMuse } from '../useMuse'
import { installDomStubs, renderChat } from '../test-utils'

vi.mock('@/api/ai/transport', () => ({
  getChatTransport: () => ({
    async *streamTurn(_request: unknown, signal: AbortSignal) {
      yield { type: 'status', phase: 'thinking' }
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
    },
  }),
}))
vi.mock('@/api/queries', () => ({ useArtworks: () => ({ data: [] }) }))

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
})
afterEach(() => {
  cleanup()
  useChat.getState().reset()
  vi.unstubAllGlobals()
})

it('ArrowRight moves the checked mode and focus', async () => {
  await renderChat(<ChatPage />)
  const ideas = screen.getByRole('radio', { name: 'Find ideas' })
  ideas.focus()
  fireEvent.keyDown(ideas, { key: 'ArrowRight' })
  const colour = screen.getByRole('radio', { name: 'Mix colours' })
  expect(colour).toHaveAttribute('aria-checked', 'true')
  expect(colour).toHaveFocus()
  expect(ideas).toHaveAttribute('tabindex', '-1')
})

it('prompt card fills the composer instead of sending', async () => {
  await renderChat(<ChatPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Give me 5 drawing ideas for beginners' }))
  expect(screen.getByRole('textbox')).toHaveValue('Give me 5 drawing ideas for beginners')
  expect(screen.getByRole('textbox')).toHaveFocus()
  expect(useChat.getState().conversations).toEqual([])
})

it('leaving the chat page stops the active stream', async () => {
  const page = await renderChat(<ChatPage />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me draw' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  page.unmount()
  expect(useChatStream.getState().active).toBeNull()
  expect(useChat.getState().conversations[0].messages.at(-1)?.status).toBe('stopped')
})

it('unmounting a child that uses useMuse keeps the page stream active', async () => {
  await renderChat(<ChatPage />)
  const child = renderHook(() => useMuse())
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me draw' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  child.unmount()
  expect(useChatStream.getState().active).not.toBeNull()
  act(() => child.result.current.stop())
})
