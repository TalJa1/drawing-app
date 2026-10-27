import { act, renderHook, waitFor } from '@testing-library/react'
import type { Conversation } from '@/types'
import { useChat } from '@/store/chat'
import { STORE_KEYS } from '@/store/storage'
import { deleteFile, getFile, listKeys, putFile } from '@/api/imageStore'
import { cleanupOrphanChatImages, collectOrphanChatImages, loadChatImage, saveChatImages, useChatImageUrl } from './chatImages'

vi.mock('@/api/imageStore', () => ({ putFile: vi.fn(), getFile: vi.fn(), deleteFile: vi.fn(), listKeys: vi.fn().mockResolvedValue([]) }))
const previewBlob = new Blob(['preview image bytes'], { type: 'image/jpeg' })
const analysisBlob = new Blob(['full image bytes'], { type: 'image/jpeg' })
const prepared = {
  id: 'a_1',
  name: 'drawing.jpg',
  previewBlob,
  analysisBlob,
  width: 1600,
  height: 1000,
  hash: 'hash',
  mime: 'image/jpeg' as const,
}
const date = '2026-10-27T00:00:00.000Z'
const makeConversation = (attachments: Conversation['messages'][number]['attachments']): Conversation => ({
  id: 'c_1',
  title: 'Drawing',
  mode: 'ideas',
  createdAt: date,
  updatedAt: date,
  messages: [{ id: 'm_1', turnId: 't_1', role: 'user', content: '', cards: [], attachments, createdAt: date }],
})

beforeEach(() => {
  vi.resetAllMocks()
  useChat.getState().reset()
  vi.mocked(listKeys).mockResolvedValue([])
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

it('stores preview and full blobs under chat:<id> keys', async () => {
  const attachment = await saveChatImages(prepared)
  expect(putFile).toHaveBeenCalledWith('chat:a_1:preview', previewBlob)
  expect(putFile).toHaveBeenCalledWith('chat:a_1:full', analysisBlob)
  expect(attachment).toEqual({
    kind: 'image',
    id: 'a_1',
    name: 'drawing.jpg',
    previewKey: 'chat:a_1:preview',
    blobKey: 'chat:a_1:full',
    hash: 'hash',
    width: 1600,
    height: 1000,
  })
  vi.mocked(getFile).mockResolvedValue(analysisBlob)
  expect(await loadChatImage(attachment.blobKey!)).toBe(analysisBlob)
})

it('persisted chat JSON holds image keys, never image bytes', async () => {
  const attachment = await saveChatImages(prepared)
  useChat.setState({ conversations: [makeConversation([attachment])], activeId: 'c_1' })
  const json = localStorage.getItem(STORE_KEYS.chat)!
  expect(json).toContain('chat:a_1:preview')
  expect(json).toContain('chat:a_1:full')
  expect(json).not.toMatch(/image bytes|data:image|previewBlob|analysisBlob/)
})

it('deletes both blobs of every attachment when a conversation is removed', async () => {
  const a = await saveChatImages(prepared)
  const b = await saveChatImages({ ...prepared, id: 'a_2' })
  useChat.setState({ conversations: [makeConversation([a, b])], activeId: 'c_1' })
  useChat.getState().remove('c_1')
  await waitFor(() => expect(deleteFile).toHaveBeenCalledTimes(4))
  for (const key of ['chat:a_1:preview', 'chat:a_1:full', 'chat:a_2:preview', 'chat:a_2:full']) expect(deleteFile).toHaveBeenCalledWith(key)
  expect(useChat.getState().conversations).toEqual([])
})

it('collectOrphanChatImages keeps referenced keys and returns the rest', async () => {
  const attachment = await saveChatImages(prepared)
  const conversations = [makeConversation([attachment])]
  const keys = ['chat:a_1:preview', 'chat:a_1:full', 'chat:unused:preview', 'chat:unused:full']
  expect(collectOrphanChatImages(conversations, keys)).toEqual(keys.slice(2))
  vi.mocked(listKeys).mockResolvedValue(keys)
  await cleanupOrphanChatImages(conversations)
  expect(listKeys).toHaveBeenCalledWith('chat:')
  expect(deleteFile).toHaveBeenCalledTimes(2)
  expect(deleteFile).toHaveBeenCalledWith('chat:unused:full')
})

it('revokes the object URL on unmount', async () => {
  vi.mocked(getFile).mockResolvedValue(previewBlob)
  const { result, rerender, unmount } = renderHook(({ key }) => useChatImageUrl(key), { initialProps: { key: 'chat:a_1:preview' } })
  await waitFor(() => expect(result.current).toBe('blob:preview'))
  rerender({ key: 'chat:a_2:preview' })
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2))
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  let resolveBlob!: (blob: Blob) => void
  vi.mocked(getFile).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveBlob = resolve
    }),
  )
  const late = renderHook(() => useChatImageUrl('chat:late:preview'))
  late.unmount()
  await act(async () => resolveBlob(previewBlob))
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
})

it('legacy data-URL attachments render from src', () => {
  const src = 'data:image/png;base64,legacy'
  const { result } = renderHook(() => useChatImageUrl(undefined, src))
  expect(result.current).toBe(src)
  expect(getFile).not.toHaveBeenCalled()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
