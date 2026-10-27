import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AttachmentPicker } from './AttachmentPicker'
import { getImageBlob, getImageUrl } from '@/api/artworks'
import { AttachmentError, prepareImage } from '../attachments'
import { useToasts } from '@/store/ui'
import { installDomStubs, renderChat } from '../test-utils'

vi.mock('@/api/queries', () => ({
  useArtworks: () => ({ data: [{ id: 'art', title: 'My art', thumbKey: 'thumb-key', imageKey: 'full-key' }] }),
}))
vi.mock('@/api/artworks', () => ({ getImageBlob: vi.fn(), getImageUrl: vi.fn() }))
vi.mock('../attachments', async (original) => ({ ...(await original<typeof import('../attachments')>()), prepareImage: vi.fn() }))
const prepared = {
  id: 'a_1',
  name: 'My art',
  previewBlob: new Blob(['preview']),
  analysisBlob: new Blob(['full']),
  width: 40,
  height: 40,
  hash: 'hash',
  mime: 'image/jpeg' as const,
}
beforeEach(() => {
  installDomStubs()
  vi.clearAllMocks()
  useToasts.setState({ toasts: [] })
  vi.mocked(getImageBlob).mockResolvedValue(new Blob(['image']))
  vi.mocked(getImageUrl).mockResolvedValue('blob:cached-thumb')
  vi.mocked(prepareImage).mockResolvedValue(prepared)
})
afterEach(() => vi.unstubAllGlobals())
const setup = async () => {
  const onPick = vi.fn()
  await renderChat(<AttachmentPicker open onClose={vi.fn()} onPick={onPick} />)
  return onPick
}
it('picker uses imageKey for analysis and thumbKey for the grid', async () => {
  const onPick = await setup()
  await waitFor(() => expect(getImageUrl).toHaveBeenCalledWith('thumb-key'))
  fireEvent.click(screen.getByRole('button', { name: 'My art' }))
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(prepared))
  expect(getImageBlob).toHaveBeenCalledWith('full-key')
  expect(getImageBlob).not.toHaveBeenCalledWith('thumb-key')
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
it('picker shows the decode error copy when an image cannot be decoded', async () => {
  vi.mocked(prepareImage).mockRejectedValue(new AttachmentError('decode'))
  const onPick = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'My art' }))
  await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe('This image could not be opened. Try another image.'))
  expect(onPick).not.toHaveBeenCalled()
})
it('picker: missing blob shows the missing error and adds nothing', async () => {
  vi.mocked(getImageBlob).mockResolvedValue(undefined)
  const onPick = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'My art' }))
  await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe('This image is no longer available. Attach it again.'))
  expect(onPick).not.toHaveBeenCalled()
  expect(prepareImage).not.toHaveBeenCalled()
})
