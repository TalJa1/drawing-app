import { useEffect, useState } from 'react'
import type { ChatAttachment, Conversation } from '@/types'
import type { PreparedImage } from './attachments'
import { deleteFile, getFile, listKeys, putFile } from '@/api/imageStore'

export async function saveChatImages(image: PreparedImage): Promise<ChatAttachment> {
  const previewKey = `chat:${image.id}:preview`
  const blobKey = `chat:${image.id}:full`
  await putFile(previewKey, image.previewBlob)
  await putFile(blobKey, image.analysisBlob)
  return { kind: 'image', id: image.id, name: image.name, previewKey, blobKey, hash: image.hash, width: image.width, height: image.height }
}

export async function loadChatImage(key: string): Promise<Blob | undefined> {
  const value = await getFile(key)
  return value instanceof Blob ? value : undefined
}

export async function deleteChatImages(attachments: ChatAttachment[]): Promise<void> {
  const keys = new Set(attachments.flatMap((a) => [a.previewKey, a.blobKey]).filter((key): key is string => !!key?.startsWith('chat:')))
  await Promise.all(Array.from(keys, (key) => deleteFile(key)))
}

export async function deleteConversationImages(conversation: Conversation): Promise<void> {
  await deleteChatImages(conversation.messages.flatMap((m) => m.attachments))
}

export function collectOrphanChatImages(conversations: Conversation[], keys: string[]): string[] {
  const used = new Set(conversations.flatMap((c) => c.messages.flatMap((m) => m.attachments.flatMap((a) => [a.previewKey, a.blobKey]))))
  return keys.filter((key) => key.startsWith('chat:') && !used.has(key))
}

export async function cleanupOrphanChatImages(conversations: Conversation[]): Promise<void> {
  await Promise.all(collectOrphanChatImages(conversations, await listKeys('chat:')).map((key) => deleteFile(key)))
}

export function useChatImageUrl(key?: string, legacySrc?: string): string | null {
  const [image, setImage] = useState<{ key: string; url: string } | null>(null)
  useEffect(() => {
    if (legacySrc || !key) return
    let cancelled = false
    let url: string | undefined
    void loadChatImage(key).then((blob) => {
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ key, url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [key, legacySrc])
  return legacySrc ?? (image && image.key === key ? image.url : null)
}
