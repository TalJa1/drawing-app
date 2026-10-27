import { z } from 'zod'
import { API_BASE } from '@/api/client'
import { useSession } from '@/store/session'
import { chatStreamEventSchema, PROTOCOL_VERSION } from '@/features/chat/contract'
import type { ChatTransport } from './transport'
import { AiTransportError } from './errors'
import { parseSSE } from './sse'

const envelopeSchema = z.object({ error: z.object({ code: z.string() }) })
const healthSchema = z.object({ configured: z.boolean(), protocolVersion: z.literal(PROTOCOL_VERSION) })

function authHeaders(): Record<string, string> {
  const token = useSession.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function httpError(response: Response): Promise<AiTransportError> {
  const value: unknown = await response.json().catch(() => null)
  const envelope = envelopeSchema.safeParse(value)
  const event = chatStreamEventSchema.safeParse({ type: 'error', code: envelope.success ? envelope.data.error.code : 'upstream' })
  const header = response.headers.get('Retry-After')
  const seconds = header === null || !header.trim() ? NaN : Number(header)
  const retryAfterMs = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined
  return new AiTransportError(event.success && event.data.type === 'error' ? event.data.code : 'upstream', retryAfterMs)
}

export const serverTransport: ChatTransport = {
  async *streamTurn(req, signal) {
    const response = await fetch(`${API_BASE}/v1/ai/chat/stream`, {
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
    const response = await fetch(`${API_BASE}/v1/ai/health`, { method: 'GET', headers: authHeaders() })
    if (!response.ok) return null
    const health = healthSchema.safeParse(await response.json())
    return health.success ? { configured: health.data.configured } : null
  } catch {
    return null
  }
}
