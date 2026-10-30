/* ------------------------------------------------------------------
   The one place that talks to the back-end: `request()`.
   Every function in src/api/*.ts that has been connected to the real
   API goes through it. `simulate()` below still fakes latency for the
   endpoints that have not been connected yet (and for the chat, which
   has no server); it goes away when the last mock does.
   ------------------------------------------------------------------ */
import { sleep } from '@/lib/utils'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'

export class ApiError extends Error {
  status: number
  code: string
  /** the server's id for this request, for support and logs */
  traceId?: string
  /** field-level problems of a 422 */
  details?: unknown
  /** seconds to wait before trying again (429) */
  retryAfter?: number
  constructor(message: string, status = 500, code = 'server_error') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface SimulateOptions {
  /** [min, max] latency in ms (default 300–1500, as a real network would vary) */
  latency?: [number, number]
  /** set false for endpoints that should never randomly fail (e.g. local saves) */
  canFail?: boolean
}

/** Latency + configurable random failure. */
export async function simulate({ latency = [300, 1500], canFail = true }: SimulateOptions = {}) {
  const [min, max] = latency
  await sleep(min + Math.random() * (max - min))
  if (canFail && useSettings.getState().simulateErrors && Math.random() < 0.2) {
    throw new ApiError('The studio lights flickered. Please try again.', 503, 'simulated_failure')
  }
}

/** Where the API lives. Same origin in dev (Vite proxies /api); set VITE_API_BASE when it is on another origin. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/+$/, '')

/** How long to wait for an answer before giving up [assumption: no measurement behind 15 s yet]. */
export const REQUEST_TIMEOUT_MS = 15_000

export interface RequestOptions {
  /** sent as JSON */
  body?: unknown
}

/** crypto.randomUUID only exists in secure contexts (https, localhost); the id is for tracing, not security. */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

interface Envelope {
  error?: { code?: unknown; message?: unknown; traceId?: unknown; details?: unknown }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

function toApiError(res: Response, payload: unknown): ApiError {
  const e = (payload as Envelope | undefined)?.error
  const err = new ApiError(
    typeof e?.message === 'string' ? e.message : res.statusText || 'The request failed.',
    res.status,
    typeof e?.code === 'string' ? e.code : 'server_error',
  )
  if (typeof e?.traceId === 'string') err.traceId = e.traceId
  if (e?.details !== undefined) err.details = e.details
  const retry = res.headers.get('Retry-After')
  if (retry && /^\d+$/.test(retry)) err.retryAfter = Number(retry)
  return err
}

/**
 * Calls the API and returns the parsed JSON (undefined for 204).
 * Any failure is an ApiError: network_error / timeout (status 0), or the server's own code.
 * A 401 `unauthorized` for the token we sent means it is no longer good: the user is signed out.
 */
export async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = useSession.getState().token
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-ID': newRequestId() }
  const tz = timeZone()
  if (tz) headers['X-Timezone'] = tz
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })
    } catch {
      throw timedOut
        ? new ApiError('The server took too long to answer.', 0, 'timeout')
        : new ApiError('Could not reach the server.', 0, 'network_error')
    }

    if (res.status === 204) return undefined as T
    const payload = await readJson(res)
    if (!res.ok) {
      const err = toApiError(res, payload)
      // only if the token that failed is still the current one (the user may have signed in again meanwhile)
      if (res.status === 401 && err.code === 'unauthorized' && token && useSession.getState().token === token) {
        useSession.getState().signOut()
      }
      throw err
    }
    if (payload === undefined) throw new ApiError('The server sent something we could not read.', res.status, 'server_error')
    return payload as T
  } finally {
    clearTimeout(timer)
  }
}
