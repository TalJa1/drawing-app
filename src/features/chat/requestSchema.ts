import { z } from 'zod'
import { boundedString, LIMITS, parseHistoryCards, PROTOCOL_VERSION, shortId, type ChatTurnRequest } from './contract'

const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const imageSchema = z.strictObject({
  id: shortId,
  name: boundedString(1, LIMITS.maxImageNameChars),
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
    message: z.strictObject({
      text: boundedString(0, LIMITS.maxMessageChars),
      images: z.array(imageSchema).max(LIMITS.maxImagesPerRequest),
    }),
    history: z
      .array(
        z
          .strictObject({
            role: z.enum(['user', 'assistant']),
            text: z.string(),
            cards: z.array(z.unknown()).max(LIMITS.maxCardsPerTurn).transform(parseHistoryCards).optional(),
            images: z.array(imageSchema).max(LIMITS.maxImagesPerRequest).optional(),
            imageMissing: z.boolean().optional(),
            status: z.enum(['completed', 'stopped', 'interrupted']).optional(),
          })
          .refine((item) => item.role === 'user' || !item.images?.length, 'Only user turns carry images'),
      )
      .max(LIMITS.maxHistoryItems),
    learner: z
      .strictObject({ level: z.number().int().min(1), completedLessons: z.array(shortId).max(LIMITS.maxCompletedLessons) })
      .nullable(),
  })
  .refine((r) => r.history.reduce((n, item) => n + Array.from(item.text).length, 0) <= LIMITS.maxHistoryChars, 'History exceeds text limit')
  .refine(
    (r) => [r.message, ...r.history].reduce((n, item) => n + (item.images?.length ?? 0), 0) <= LIMITS.maxImagesPerRequest,
    'Too many images',
  )
  .refine((r) => [r.message, ...r.history].filter((item) => item.images?.length).length <= 1, 'Images must come from one turn')
  .refine((r) => new TextEncoder().encode(JSON.stringify(r)).byteLength <= LIMITS.maxBodyBytes, 'Body exceeds byte limit')
