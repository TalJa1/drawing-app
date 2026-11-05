import { z } from 'zod'
import { API_BASE } from '@/api/client'
import { AiTransportError } from './errors'
import { JUDGE_ERROR_CODES, judgeResponseSchema, type JudgeTransport } from './judgeContract'
import { authHeaders } from './serverTransport'

const envelopeSchema = z.object({ error: z.object({ code: z.enum(JUDGE_ERROR_CODES) }) })

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  const seconds = header === null || !header.trim() ? NaN : Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined
}

export const serverJudgeTransport: JudgeTransport = {
  async requestFeedback(req, signal) {
    let response: Response
    try {
      response = await fetch(`${API_BASE}/v1/ai/judge/feedback`, {
        method: 'POST',
        signal,
        headers: { ...authHeaders(), 'Content-Type': 'application/json', 'X-Request-ID': req.requestId },
        body: JSON.stringify(req),
      })
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
      throw new AiTransportError('network')
    }
    const value: unknown = await response.json().catch(() => undefined)
    signal.throwIfAborted()
    if (!response.ok) {
      const envelope = envelopeSchema.safeParse(value)
      throw new AiTransportError(envelope.success ? envelope.data.error.code : 'upstream', retryAfterMs(response))
    }
    const parsed = judgeResponseSchema.safeParse(value)
    if (!parsed.success) throw new AiTransportError('protocol')
    return parsed.data.feedback
  },
}
