import { z } from 'zod'
import type { ChatCard, ChatMode, ChatStreamEvent, Lang } from '@/types'
import { LESSON_MAP } from '@/mocks/lessons'
import { TEMPLATE_MAP } from '@/mocks/templates'

export const PROTOCOL_VERSION = 1
export const LIMITS = {
  maxMessageChars: 4000,
  maxHistoryItems: 24,
  maxHistoryChars: 60_000,
  maxImagesPerRequest: 3,
  maxAnalysisJpegBytes: 1_100_000,
  maxImageDataUrlChars: 1_500_000,
  maxImageEdge: 1600,
  maxImageNameChars: 120,
  maxIdChars: 80,
  maxBodyBytes: 6_000_000,
  maxCardsPerTurn: 6,
  maxCompletedLessons: 200,
} as const
export const boundedString = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = Array.from(value).length
    return length >= min && length <= max
  }, `Expected ${min}–${max} Unicode characters`)
export const shortId = boundedString(1, LIMITS.maxIdChars)
const reason = boundedString(0, 160)
  .nullish()
  .transform((value) => value ?? undefined)
const point = boundedString(1, 240)

export const chatCardSchema: z.ZodType<ChatCard> = z.discriminatedUnion('type', [
  z
    .strictObject({
      type: z.literal('palette'),
      name: boundedString(1, 40),
      colors: z
        .array(z.string().regex(/^#[0-9a-f]{6}$/i))
        .min(3)
        .max(6),
      roles: z
        .array(z.enum(['dominant', 'support', 'accent']))
        .nullish()
        .transform((value) => value ?? undefined),
      note: reason,
    })
    .refine((c) => new Set(c.colors.map((hex) => hex.toLowerCase())).size === c.colors.length, 'Duplicate colours')
    .refine((c) => !c.roles || c.roles.length === c.colors.length, 'Roles must match colours'),
  z.strictObject({ type: z.literal('template'), templateId: shortId.refine((id) => Object.hasOwn(TEMPLATE_MAP, id)), reason }),
  z.strictObject({ type: z.literal('lesson'), slug: shortId.refine((id) => Object.hasOwn(LESSON_MAP, id)), reason }),
  z.strictObject({
    type: z.literal('idea'),
    title: boundedString(1, 60),
    description: boundedString(1, 220),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'master']),
    minutes: z.number().int().min(5).max(120),
    // An unknown guide drops only the guide, never the idea itself.
    templateId: shortId
      .refine((id) => Object.hasOwn(TEMPLATE_MAP, id))
      .optional()
      .catch(undefined),
  }),
  z.strictObject({
    type: z.literal('critique'),
    imageId: shortId,
    observations: z.array(point).min(1).max(3),
    strengths: z.array(point).max(2),
    priorities: z.array(point).max(2),
    exercise: point,
  }),
])

export function parseHistoryCards(cards: unknown): ChatCard[] {
  if (!Array.isArray(cards)) return []
  return cards.flatMap((card) => {
    const result = chatCardSchema.safeParse(card)
    return result.success ? [result.data] : []
  })
}

export const chatStreamEventSchema: z.ZodType<ChatStreamEvent> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('status'), phase: z.literal('thinking') }),
  z.strictObject({ type: z.literal('token'), text: z.string() }),
  z.strictObject({ type: z.literal('card'), card: chatCardSchema }),
  z.strictObject({ type: z.literal('done'), finish: z.enum(['completed', 'incomplete']), reason: z.string().optional() }),
  z.strictObject({
    type: z.literal('error'),
    code: z.enum(['upstream', 'timeout', 'model_unavailable', 'rate_limited', 'ai_not_configured']),
    retryAfterMs: z.number().nonnegative().optional(),
  }),
])

export type ImagePayload = { id: string; name: string; mime: 'image/jpeg'; dataUrl: string; width: number; height: number; hash: string }
export type HistoryItem = {
  role: 'user' | 'assistant'
  text: string
  cards?: ChatCard[]
  images?: ImagePayload[]
  imageMissing?: boolean
  status?: 'completed' | 'stopped' | 'interrupted'
}
export type LearnerSnapshot = { level: number; completedLessons: string[] }
export type ChatTurnRequest = {
  protocolVersion: 1
  requestId: string
  conversationId: string
  turnId: string
  action: 'send' | 'regenerate'
  mode: ChatMode
  lang: Lang
  message: { text: string; images: ImagePayload[] }
  history: HistoryItem[]
  learner: LearnerSnapshot | null
}
