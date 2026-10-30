import { act, cleanup, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import ChatPage from '@/pages/chat/ChatPage'
import { useChat } from '@/store/chat'
import { useChatStream } from '../streamStore'
import { useMuse } from '../useMuse'
import { installDomStubs, renderChat } from '../test-utils'
import { ChatHeader } from './ChatHeader'

vi.mock('@/api/ai/transport', () => ({
  checkAiHealth: async () => null,
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

it('small screens hide the subtitle and show all four modes', async () => {
  await renderChat(<ChatHeader mode="ideas" onModeChange={vi.fn()} desktop={false} onHistory={vi.fn()} />)
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveClass('truncate', 'sm:whitespace-normal')
  expect(heading.nextElementSibling).toHaveClass('hidden', 'sm:block')
  const modes = screen.getByRole('radiogroup')
  expect(modes).toHaveClass('grid', 'grid-cols-2', 'lg:flex')
  expect(modes).not.toHaveClass('overflow-x-auto')
  expect(screen.getAllByRole('radio')).toHaveLength(4)
})

it('desktop mode row hides its scrollbar while keeping the mobile grid', async () => {
  await renderChat(<ChatHeader mode="ideas" onModeChange={vi.fn()} desktop onHistory={vi.fn()} />)
  expect(screen.getByRole('radiogroup')).toHaveClass('no-scrollbar', 'lg:overflow-x-auto', 'grid-cols-2', 'lg:flex')
})

it.each([
  { short: false, hasMessages: false, select: false },
  { short: false, hasMessages: true, select: true },
  { short: true, hasMessages: false, select: true },
  { short: true, hasMessages: true, select: true },
])('adapts the mobile picker: %j', async ({ short, hasMessages, select }) => {
  const matchMedia = window.matchMedia
  vi.stubGlobal('matchMedia', (query: string) => ({ ...matchMedia(query), matches: query === '(max-height: 700px)' && short }))
  const onModeChange = vi.fn()
  await renderChat(<ChatHeader mode="colour" onModeChange={onModeChange} desktop={false} onHistory={vi.fn()} hasMessages={hasMessages} />)
  if (select) {
    const picker = screen.getByRole('combobox', { name: 'Muse mode' })
    expect(picker).toHaveValue('colour')
    expect(within(picker).getAllByRole('option')).toHaveLength(4)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(picker).toHaveAccessibleDescription('This mode applies to your next question.')
    fireEvent.change(picker, { target: { value: 'history' } })
    expect(onModeChange).toHaveBeenCalledExactlyOnceWith('history')
  } else {
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  }
})

it('switches picker on a height change and keeps desktop radios', async () => {
  let short = false
  let change = () => {}
  const matchMedia = window.matchMedia
  vi.stubGlobal('matchMedia', (query: string) =>
    query === '(max-height: 700px)'
      ? {
          ...matchMedia(query),
          get matches() {
            return short
          },
          addEventListener: (_event: string, listener: () => void) => {
            change = listener
          },
        }
      : matchMedia(query),
  )
  const props = { mode: 'ideas' as const, onModeChange: vi.fn(), onHistory: vi.fn() }
  const page = await renderChat(<ChatHeader {...props} desktop={false} />)
  expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  act(() => {
    short = true
    change()
  })
  expect(screen.getByRole('combobox')).toHaveValue('ideas')
  page.rerender(<ChatHeader {...props} desktop />)
  expect(screen.getAllByRole('radio')).toHaveLength(4)
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
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

it('new conversation does not add an empty conversation', async () => {
  await renderChat(<ChatPage />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me draw' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  const previousId = useChat.getState().activeId
  act(() => useChat.getState().setConversationDraft('__new__', 'Paint a small tree'))

  fireEvent.click(screen.getByRole('button', { name: 'Conversations' }))
  const sheet = await screen.findByRole('dialog', { name: 'Conversations' })
  fireEvent.click(within(sheet).getByRole('button', { name: 'New conversation' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conversations' })).not.toBeInTheDocument())

  expect(useChat.getState().activeId).toBeNull()
  expect(useChat.getState().conversations).toHaveLength(1)
  expect(useChat.getState().conversations[0].id).toBe(previousId)
  expect(useChat.getState().conversations[0].messages.at(-1)?.status).toBe('stopped')
  expect(useChatStream.getState().active).toBeNull()
  expect(screen.getByRole('textbox')).toHaveValue('Paint a small tree')
})

it('the first message creates the conversation with the selected mode', async () => {
  const matchMedia = window.matchMedia
  vi.stubGlobal('matchMedia', (query: string) => ({ ...matchMedia(query), matches: query === '(min-width: 1024px)' }))
  await renderChat(<ChatPage />)
  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Mix colours' }))
  expect(useChat.getState().conversations).toHaveLength(0)

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me choose colours' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  const { conversations, activeId } = useChat.getState()
  expect(conversations).toHaveLength(1)
  expect(conversations[0]).toMatchObject({ id: activeId, mode: 'colour' })
  expect(conversations[0].messages[0]).toMatchObject({ role: 'user', content: 'Help me choose colours', mode: 'colour' })
})

it('sending the first message restores focus to the new composer', async () => {
  await renderChat(<ChatPage />)
  const input = screen.getByRole('textbox')
  input.focus()
  fireEvent.change(input, { target: { value: 'Help me draw' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  expect(screen.getByRole('textbox')).toHaveFocus()
})

it('retry returns focus to the composer', async () => {
  await renderChat(<ChatPage />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me draw' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(useChatStream.getState().active).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
  const retry = screen.getByRole('button', { name: 'Try again' })
  retry.focus()
  await act(async () => {
    fireEvent.click(retry)
  })
  expect(screen.getByRole('textbox')).toHaveFocus()
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
