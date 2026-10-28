import type { ChatAttachment, Conversation } from '@/types'
import { AiTransportError } from '@/api/ai/errors'
import { uid } from '@/lib/random'
import { useSettings } from '@/store/settings'
import { useChat } from '@/store/chat'
import { LIMITS, PROTOCOL_VERSION, parseHistoryCards } from './contract'
import type { ChatTurnRequest, HistoryItem, ImagePayload, LearnerSnapshot } from './contract'
import { loadChatImage } from './chatImages'

async function imagePayload(attachment: ChatAttachment): Promise<ImagePayload | undefined> {
  if (!attachment.blobKey || !attachment.width || !attachment.height || !attachment.hash) return
  const blob = await loadChatImage(attachment.blobKey)
  if (!blob) return
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data')))
    reader.onerror = () => reject(new Error('Image could not be read'))
    reader.readAsDataURL(blob)
  })
  return {
    id: attachment.id,
    name: attachment.name.slice(0, LIMITS.maxImageNameChars),
    mime: 'image/jpeg',
    dataUrl,
    width: attachment.width,
    height: attachment.height,
    hash: attachment.hash,
  }
}

export async function buildTurnRequest(
  conversation: Conversation,
  turnId: string,
  action: 'send' | 'regenerate',
  learner: LearnerSnapshot | null,
): Promise<ChatTurnRequest> {
  const index = conversation.messages.findIndex((m) => m.turnId === turnId && m.role === 'user')
  const question = conversation.messages[index]
  if (!question) throw new Error('Chat turn has no user message')
  const turns: { id: string; items: HistoryItem[] }[] = []
  const userItems = new Map<string, HistoryItem>()
  for (const message of conversation.messages.slice(0, index)) {
    const cards = parseHistoryCards(message.cards)
    if (
      message.role === 'assistant' &&
      (message.status === 'failed' || message.status === 'streaming' || (!message.content.trim() && !cards.length))
    )
      continue
    const item: HistoryItem = { role: message.role, text: message.content }
    if (message.role === 'assistant' && cards.length) item.cards = cards
    if (message.role === 'user') {
      userItems.set(message.turnId, item)
      if (message.attachments.some((a) => !a.blobKey)) item.imageMissing = true
    }
    if (
      message.role === 'assistant' &&
      (message.status === 'completed' || message.status === 'stopped' || message.status === 'interrupted')
    ) {
      item.status = message.status
    }
    const last = turns.at(-1)
    if (last?.id === message.turnId) last.items.push(item)
    else turns.push({ id: message.turnId, items: [item] })
  }
  let history = turns.flatMap((turn) => turn.items)
  while (history.length > LIMITS.maxHistoryItems || history.reduce((count, item) => count + item.text.length, 0) > LIMITS.maxHistoryChars) {
    turns.shift()
    history = turns.flatMap((turn) => turn.items)
  }
  const previous = conversation.messages.slice(0, index).filter((m) => m.role === 'user')
  const context = question.attachments.length
    ? question
    : conversation.imageContextTurnId === null
      ? undefined
      : conversation.imageContextTurnId !== undefined
        ? previous.find((m) => m.turnId === conversation.imageContextTurnId)
        : previous.findLast((m) => m.attachments.some((a) => a.blobKey))
  const images: ImagePayload[] = []
  if (context) {
    const source = userItems.get(context.turnId)
    for (const attachment of context.attachments.slice(0, LIMITS.maxImagesPerRequest)) {
      const image = await imagePayload(attachment).catch(() => undefined)
      if (image) images.push(image)
      else if (source && history.includes(source)) source.imageMissing = true
      else {
        if (context.turnId !== turnId) useChat.getState().setImageContext(conversation.id, null)
        throw new AiTransportError('image_missing')
      }
    }
    if (source && history.includes(source) && images.length) source.images = images.splice(0)
  }
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: uid('r_'),
    conversationId: conversation.id,
    turnId,
    action,
    mode: question.mode ?? conversation.mode,
    lang: useSettings.getState().language,
    message: { text: question.content, images },
    history,
    learner,
  }
}
