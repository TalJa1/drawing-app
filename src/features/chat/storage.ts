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
const storedCard: z.ZodType<ChatCard> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('palette'),
    name: z.string(),
    colors: z.array(z.string()),
    roles: z.array(z.enum(['dominant', 'support', 'accent'])).optional(),
    note: z.string().optional(),
  }),
  z.object({ type: z.literal('template'), templateId: z.string(), reason: z.string().optional() }),
  z.object({ type: z.literal('lesson'), slug: z.string(), reason: z.string().optional() }),
  z.object({
    type: z.literal('idea'),
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'master']),
    minutes: z.number(),
  }),
  z.object({
    type: z.literal('critique'),
    imageId: z.string(),
    observations: z.array(z.string()),
    strengths: z.array(z.string()),
    priorities: z.array(z.string()),
    exercise: z.string(),
  }),
])
const variant = z.object({ content: z.string(), cards: z.unknown(), status, createdAt: z.string() })
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
    cards: z.unknown(),
    attachments: z.unknown(),
    createdAt: z.string(),
    rating: z.enum(['up', 'down']).optional(),
    turnId: z.string().optional(),
    mode: mode.optional(),
    status: status.optional(),
    pending: z.boolean().optional(),
    error: z.boolean().optional(),
    variants: z.unknown().optional(),
  })
  .passthrough()
const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  mode,
  messages: z.array(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  imageContextTurnId: z.string().nullable().optional(),
})
const persisted = z.object({
  conversations: z.array(z.unknown()),
  activeId: z.unknown().optional(),
  draft: z.unknown().optional(),
  drafts: z.unknown().optional(),
})

const emptyState = (): PersistedChat => ({ conversations: [], activeId: null, draft: null, drafts: {} })
const repairedStates = new WeakSet<object>()

export function wasChatStateRepaired(value: unknown): boolean {
  return typeof value === 'object' && value !== null && repairedStates.has(value)
}

export function migrateChatState(value: unknown, fromVersion: number): PersistedChat {
  let repaired = wasChatStateRepaired(value)
  const finish = (state: PersistedChat) => {
    if (repaired) repairedStates.add(state)
    return state
  }
  try {
    const parsed = persisted.safeParse(value)
    if (!parsed.success) {
      repaired = value != null
      return finish(emptyState())
    }
    const state = parsed.data
    const read = <T>(schema: z.ZodType<T>, input: unknown, fallback: T): T => {
      const result = schema.safeParse(input)
      if (result.success) return result.data
      repaired = true
      return fallback
    }
    const readItems = <T>(schema: z.ZodType<T>, input: unknown): T[] =>
      read(z.array(z.unknown()), input, []).flatMap((item) => {
        const result = schema.safeParse(item)
        if (result.success) return [result.data]
        repaired = true
        return []
      })
    const conversations: Conversation[] = readItems(conversationSchema, state.conversations).map((conversation) => {
      let turnId: string | undefined
      const messages = readItems(message, conversation.messages).map((message): ChatMessage => {
        const rest = { ...message }
        delete rest.pending
        delete rest.error
        if (fromVersion < 2 || !message.turnId) repaired = true
        if (message.role === 'user' || !turnId) turnId = message.turnId || uid('t_')
        const messageTurnId = message.turnId || turnId
        return {
          ...rest,
          turnId: messageTurnId,
          ...(fromVersion < 2
            ? message.role === 'user'
              ? { mode: conversation.mode }
              : { status: message.error ? 'failed' : 'completed' }
            : {}),
          cards: readItems(storedCard, message.cards),
          attachments: readItems(attachment, message.attachments).map((image) => {
            if (!image.id) repaired = true
            return { ...image, id: image.id || uid('a_') }
          }),
          variants:
            message.variants === undefined
              ? undefined
              : readItems(variant, message.variants).map((v) => ({ ...v, cards: readItems(storedCard, v.cards) })),
        }
      })
      return { ...conversation, messages }
    })
    const activeId = read(z.string().nullable(), state.activeId, null)
    return finish({
      conversations,
      activeId: conversations.some((c) => c.id === activeId) ? activeId : null,
      draft: read(z.string().nullable(), state.draft, null),
      drafts: fromVersion < 2 || state.drafts === undefined ? {} : read(z.record(z.string(), z.string()), state.drafts, {}),
    })
  } catch {
    repaired = true
    return finish(emptyState())
  }
}

export function reviveInterrupted(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m)),
  }))
}
