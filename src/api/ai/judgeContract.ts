import { z } from 'zod'
import type { AiErrorCode, Lang, RankLabel, SubScores } from '@/types'
import { boundedString, type ImagePayload } from '@/features/chat/contract'

/** POST /v1/ai/judge/feedback — Muse writes feedback; the formula score never changes. */
export interface JudgeRequest {
  protocolVersion: 1
  requestId: string
  lang: Lang
  templateId: string
  image: ImagePayload
  score: { overall: number; similarity: number; colour: number; rank: RankLabel; sub: SubScores }
}

export const judgeFeedbackSchema = z
  .object({
    summary: boundedString(1, 240),
    strengths: z.array(boundedString(1, 160)).min(1).max(2),
    tips: z.array(boundedString(1, 180)).min(1).max(3),
    exercise: boundedString(1, 200),
  })
  .strict()
export type JudgeFeedback = z.infer<typeof judgeFeedbackSchema>

export const judgeResponseSchema = z.object({ protocolVersion: z.literal(1), feedback: judgeFeedbackSchema }).strict()

/** Error codes the endpoint can send in the backend envelope; anything else maps to upstream. */
export const JUDGE_ERROR_CODES = [
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
] as const satisfies readonly AiErrorCode[]

export interface JudgeTransport {
  requestFeedback(req: JudgeRequest, signal: AbortSignal): Promise<JudgeFeedback>
}
