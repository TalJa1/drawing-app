import { act, createEvent, fireEvent, screen, waitFor } from '@testing-library/react'
import { ChatComposer } from './ChatComposer'
import ChatPage from '@/pages/chat/ChatPage'
import { useChat } from '@/store/chat'
import { prepareImage } from '../attachments'
import { putFile } from '@/api/imageStore'
import { installDomStubs, renderChat } from '../test-utils'

vi.mock('@/api/queries', () => ({ useArtworks: () => ({ data: [] }) }))
vi.mock('@/api/imageStore', () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn(), listKeys: vi.fn().mockResolvedValue([]) }))
vi.mock('../attachments', async (original) => ({ ...(await original<typeof import('../attachments')>()), prepareImage: vi.fn() }))
const prepared = {
  id: 'a_1',
  name: 'art.jpg',
  previewBlob: new Blob(['preview']),
  analysisBlob: new Blob(['full']),
  width: 40,
  height: 40,
  hash: 'hash',
  mime: 'image/jpeg' as const,
}
const setup = async (busy = false) => {
  const onSend = vi.fn()
  const view = await renderChat(
    <ChatComposer conversationId="c_1" initialText="Draw a tree" busy={busy} onSend={onSend} onStop={vi.fn()} />,
  )
  return { ...view, onSend, input: screen.getByRole('textbox') }
}
beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
  vi.clearAllMocks()
  vi.mocked(prepareImage).mockResolvedValue(prepared)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('does not submit on Enter while composing', async () => {
  const { input, onSend } = await setup()
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
  expect(onSend).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSend).toHaveBeenCalledWith('Draw a tree', [])
})
it('Shift+Enter does not submit and is not prevented', async () => {
  const { input, onSend } = await setup()
  expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true)
  expect(onSend).not.toHaveBeenCalled()
})
it('composer caps input at 4000 chars', async () => {
  const { input } = await setup()
  expect(input).toHaveAttribute('maxlength', '4000')
  fireEvent.change(input, { target: { value: 'x'.repeat(4001) } })
  expect(input).toHaveValue('x'.repeat(4000))
})
it('keeps a separate draft per conversation', async () => {
  const page = await renderChat(<ChatPage />)
  let first = ''
  let second = ''
  act(() => {
    first = useChat.getState().create()
    second = useChat.getState().create()
    useChat.getState().setActive(first)
  })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first draft' } })
  await waitFor(() => expect(useChat.getState().drafts[first]).toBe('first draft'))
  act(() => useChat.getState().setActive(second))
  expect(screen.getByRole('textbox')).toHaveValue('')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'second draft' } })
  act(() => useChat.getState().setActive(first))
  expect(screen.getByRole('textbox')).toHaveValue('first draft')
  expect(useChat.getState().drafts[second]).toBe('second draft')
  page.unmount()
})
it('a draft handed over via setDraft fills the composer once and is then cleared', async () => {
  const old = useChat.getState().create()
  useChat.getState().setDraft('From Free Draw')
  const page = await renderChat(<ChatPage />)
  expect(screen.getByRole('textbox')).toHaveValue('From Free Draw')
  expect(useChat.getState().activeId).toBeNull()
  expect(useChat.getState().draft).toBeNull()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited handoff' } })
  act(() => useChat.getState().setActive(old))
  act(() => useChat.getState().setActive(null))
  expect(screen.getByRole('textbox')).toHaveValue('Edited handoff')
  page.unmount()
})
it('removed attachment is not sent', async () => {
  const { input, onSend } = await setup()
  const event = createEvent.paste(input, { clipboardData: { files: [new File(['image'], 'art.png', { type: 'image/png' })] } })
  fireEvent(input, event)
  await screen.findByRole('button', { name: 'Remove image' })
  fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(onSend).toHaveBeenCalledWith('Draw a tree', [])
  expect(URL.revokeObjectURL).toHaveBeenCalled()
})
it('send and stop share the same size classes', async () => {
  const page = await setup()
  expect(screen.getByRole('button', { name: 'Send' })).toHaveClass('h-11', 'w-11')
  page.unmount()
  await setup(true)
  expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass('h-11', 'w-11')
})
it('prepared images are not written to IndexedDB before send', async () => {
  const { input } = await setup()
  fireEvent.paste(input, { clipboardData: { files: [new File(['image'], 'art.png', { type: 'image/png' })] } })
  await screen.findByRole('button', { name: 'Remove image' })
  expect(prepareImage).toHaveBeenCalled()
  expect(putFile).not.toHaveBeenCalled()
})
