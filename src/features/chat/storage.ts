import { z } from 'zod'
import type { ChatCard, ChatMessage, Conversation } from '@/types'
import { uid } from '@/lib/random'

export type PersistedChat = {
  conversations: Conversation[]
  activeId: string | null
  draft: string | null
  drafts: Record<string, string>
}

const mode = z.enum(['ideas', 'colour', 'composition', 'history'])
const status = z.enum(['streaming', 'completed', 'stopped', 'interrupted', 'failed'])
const attachment = z.object({
  kind: z.literal('image'),
  id: z.string().optional(),
  name: z.string(),
  src: z.string().optional(),
  previewKey: z.string().optional(),
  blobKey: z.string().optional(),
  hash: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  artworkId: z.string().optional(),
})
const message = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    cards: z.array(z.custom<ChatCard>()),
    attachments: z.array(attachment),
    createdAt: z.string(),
    rating: z.enum(['up', 'down']).optional(),
    turnId: z.string().optional(),
    mode: mode.optional(),
    status: status.optional(),
    pending: z.boolean().optional(),
    error: z.boolean().optional(),
  })
  .passthrough()
const persisted = z.object({
  conversations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      mode,
      messages: z.array(message),
      createdAt: z.string(),
      updatedAt: z.string(),
      imageContextTurnId: z.string().nullable().optional(),
    }),
  ),
  activeId: z.string().nullable(),
  draft: z.string().nullable(),
  drafts: z.record(z.string(), z.string()).optional(),
})

const emptyState = (): PersistedChat => ({ conversations: [], activeId: null, draft: null, drafts: {} })

export function migrateChatState(value: unknown, fromVersion: number): PersistedChat {
  try {
    const parsed = persisted.safeParse(value)
    if (!parsed.success) return emptyState()
    const state = parsed.data
    if (fromVersion >= 2) {
      if (state.conversations.some((c) => c.messages.some((m) => !m.turnId || m.attachments.some((a) => !a.id)))) return emptyState()
      return { ...state, drafts: state.drafts ?? {} } as PersistedChat
    }
    const conversations: Conversation[] = state.conversations.map((conversation) => {
      let turnId: string | undefined
      const messages = conversation.messages.map((message): ChatMessage => {
        const rest = { ...message }
        delete rest.pending
        delete rest.error
        if (message.role === 'user' || !turnId) turnId = uid('t_')
        return {
          ...rest,
          turnId,
          ...(message.role === 'user' ? { mode: conversation.mode } : { status: message.error ? 'failed' : 'completed' }),
          attachments: message.attachments.map((image) => ({ ...image, id: uid('a_') })),
        }
      })
      return { ...conversation, messages }
    })
    return { conversations, activeId: state.activeId, draft: state.draft, drafts: {} }
  } catch {
    return emptyState()
  }
}

export function reviveInterrupted(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m)),
  }))
}
