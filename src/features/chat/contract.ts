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
} as const
export const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const shortId = z.string().min(1).max(LIMITS.maxIdChars)
const reason = z.string().max(160).optional()
const point = z.string().min(1).max(240)

export const chatCardSchema: z.ZodType<ChatCard> = z.discriminatedUnion('type', [
  z
    .strictObject({
      type: z.literal('palette'),
      name: z.string().min(1).max(40),
      colors: z
        .array(z.string().regex(/^#[0-9a-f]{6}$/i))
        .min(3)
        .max(6),
      roles: z.array(z.enum(['dominant', 'support', 'accent'])).optional(),
      note: z.string().max(160).optional(),
    })
    .refine((c) => new Set(c.colors.map((hex) => hex.toLowerCase())).size === c.colors.length, 'Duplicate colours')
    .refine((c) => !c.roles || c.roles.length === c.colors.length, 'Roles must match colours'),
  z.strictObject({ type: z.literal('template'), templateId: shortId.refine((id) => Object.hasOwn(TEMPLATE_MAP, id)), reason }),
  z.strictObject({ type: z.literal('lesson'), slug: shortId.refine((id) => Object.hasOwn(LESSON_MAP, id)), reason }),
  z.strictObject({
    type: z.literal('idea'),
    title: z.string().min(1).max(60),
    description: z.string().min(1).max(220),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'master']),
    minutes: z.number().int().min(5).max(120),
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
    code: z.enum([
      'unauthorized',
      'ai_not_configured',
      'service_unavailable',
      'rate_limited',
      'ai_busy',
      'ai_budget_exceeded',
      'payload_too_large',
      'unsupported_media_type',
      'bad_request',
      'validation_error',
      'upstream',
      'timeout',
      'model_unavailable',
      'network',
      'protocol',
      'client',
    ]),
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

const imageSchema = z.strictObject({
  id: shortId,
  name: z.string().min(1).max(LIMITS.maxImageNameChars),
  mime: z.literal('image/jpeg'),
  dataUrl: z
    .string()
    .max(LIMITS.maxImageDataUrlChars)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .refine((url) => {
      const base64 = url.slice(url.indexOf(',') + 1)
      return (
        base64.length % 4 === 0 &&
        (base64.length / 4) * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0) <= LIMITS.maxAnalysisJpegBytes
      )
    }, 'JPEG exceeds byte limit'),
  width: z.number().int().min(1).max(LIMITS.maxImageEdge),
  height: z.number().int().min(1).max(LIMITS.maxImageEdge),
  hash: shortId,
})
const id = z.string().regex(ID_PATTERN)
export const chatTurnRequestSchema: z.ZodType<ChatTurnRequest> = z
  .strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    requestId: id,
    conversationId: id,
    turnId: id,
    action: z.enum(['send', 'regenerate']),
    mode: z.enum(['ideas', 'colour', 'composition', 'history']),
    lang: z.enum(['en', 'vi']),
    message: z.strictObject({ text: z.string().max(LIMITS.maxMessageChars), images: z.array(imageSchema).max(LIMITS.maxImagesPerRequest) }),
    history: z
      .array(
        z
          .strictObject({
            role: z.enum(['user', 'assistant']),
            text: z.string(),
            cards: z.unknown().transform(parseHistoryCards).optional(),
            images: z.array(imageSchema).max(LIMITS.maxImagesPerRequest).optional(),
            imageMissing: z.boolean().optional(),
            status: z.enum(['completed', 'stopped', 'interrupted']).optional(),
          })
          .refine((item) => item.role === 'user' || !item.images?.length, 'Only user turns carry images'),
      )
      .max(LIMITS.maxHistoryItems),
    learner: z.strictObject({ level: z.number().int().min(1), completedLessons: z.array(shortId) }).nullable(),
  })
  .refine((r) => r.history.reduce((n, item) => n + item.text.length, 0) <= LIMITS.maxHistoryChars, 'History exceeds text limit')
  .refine(
    (r) => [r.message, ...r.history].reduce((n, item) => n + (item.images?.length ?? 0), 0) <= LIMITS.maxImagesPerRequest,
    'Too many images',
  )
  .refine((r) => [r.message, ...r.history].filter((item) => item.images?.length).length <= 1, 'Images must come from one turn')
  .refine((r) => new TextEncoder().encode(JSON.stringify(r)).byteLength <= LIMITS.maxBodyBytes, 'Body exceeds byte limit')
