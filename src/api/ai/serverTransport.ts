import { z } from 'zod'
import { API_BASE } from '@/api/client'
import { useSession } from '@/store/session'
import { PROTOCOL_VERSION } from '@/features/chat/contract'
import type { ChatTransport } from './transport'
import { AiTransportError } from './errors'
import { parseSSE } from './sse'

const envelopeSchema = z.object({
  error: z.object({
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
    ]),
  }),
})
const healthSchema = z.object({ configured: z.boolean(), protocolVersion: z.literal(PROTOCOL_VERSION) })

export function authHeaders(): Record<string, string> {
  const token = useSession.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function httpError(response: Response): Promise<AiTransportError> {
  const value: unknown = await response.json().catch(() => null)
  const envelope = envelopeSchema.safeParse(value)
  const header = response.headers.get('Retry-After')
  const seconds = header === null || !header.trim() ? NaN : Number(header)
  const retryAfterMs = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined
  return new AiTransportError(envelope.success ? envelope.data.error.code : 'upstream', retryAfterMs)
}

export const serverTransport: ChatTransport = {
  async *streamTurn(req, signal) {
    const response = await fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      signal,
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'X-Request-ID': req.requestId },
      body: JSON.stringify(req),
    })
    if (!response.ok) throw await httpError(response)
    if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
      await response.body?.cancel().catch(() => undefined)
      throw new AiTransportError('protocol')
    }
    yield* parseSSE(response.body)
  },
}

export async function checkServerHealth(): Promise<{ configured: boolean } | null> {
  try {
    const response = await fetch(`${API_BASE}/ai/health`, { method: 'GET', headers: authHeaders() })
    if (!response.ok) return null
    const health = healthSchema.safeParse(await response.json())
    return health.success ? { configured: health.data.configured } : null
  } catch {
    return null
  }
}
