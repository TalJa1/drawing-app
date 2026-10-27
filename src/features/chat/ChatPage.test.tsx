import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatPage from '@/pages/chat/ChatPage'
import { useChat } from '@/store/chat'
import { useToasts } from '@/store/ui'
import { AttachmentError, prepareImage } from './attachments'
import { installDomStubs } from './test-utils'
import viMessages from '@/i18n/vi.json'

it('keeps Vietnamese attachment errors in readable UTF-8', () => {
  expect(viMessages.chat.attach).toMatchObject({
    unsupported: 'Hãy chọn ảnh PNG, JPEG, WebP hoặc GIF.',
    decode: 'Không thể mở ảnh này. Hãy thử một ảnh khác.',
    too_many_pixels: 'Ảnh này vượt giới hạn 40 megapixel.',
  })
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => (key.endsWith('.prompts') ? [] : key), i18n: { language: 'en' } }),
}))
vi.mock('@/api/queries', () => ({
  useArtworks: () => ({ data: [{ id: 'art_1', title: 'My art', imageKey: 'full-key', thumbKey: 'thumb-key' }] }),
}))
vi.mock('@/api/artworks', () => ({ getImageBlob: vi.fn(async () => new Blob(['image'])) }))
vi.mock('./attachments', async (original) => ({ ...(await original<typeof import('./attachments')>()), prepareImage: vi.fn() }))

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
  useToasts.setState({ toasts: [] })
  vi.mocked(prepareImage).mockRejectedValue(new AttachmentError('unsupported'))
})
afterEach(() => vi.unstubAllGlobals())

it('reports image preparation failures without adding an attachment', async () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ChatPage />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'chat.attach.button' }))
  const picker = await screen.findByRole('dialog', { name: 'chat.attach.title' })
  const input = picker.querySelector('input[type="file"]')!
  for (const code of ['unsupported', 'decode', 'too_many_pixels', 'too_big'] as const) {
    vi.mocked(prepareImage).mockRejectedValueOnce(new AttachmentError(code))
    fireEvent.change(input, { target: { files: [new File(['invalid image'], 'bad.png', { type: 'image/png' })] } })
    await waitFor(() =>
      expect(useToasts.getState().toasts.at(-1)).toMatchObject({
        title: code === 'too_big' ? 'chat.attach.tooBig' : `chat.attach.${code}`,
        tone: 'error',
      }),
    )
  }
  useToasts.setState({ toasts: [] })
  fireEvent.click(within(picker).getByText('My art').closest('button')!)
  await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ title: 'chat.attach.unsupported', tone: 'error' }))
  expect(screen.queryByRole('button', { name: 'chat.removeAttachment' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'chat.send' })).toBeDisabled()
  expect(useChat.getState().conversations).toEqual([])
})
