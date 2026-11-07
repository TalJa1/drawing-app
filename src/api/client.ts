/* ------------------------------------------------------------------
   The one place that talks to the back-end: `request()`.
   Every function in src/api/*.ts that talks to the server goes through it.
   ------------------------------------------------------------------ */
import { useSession } from '@/store/session'

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

/** Where the API lives. Same origin in dev (Vite proxies /api); set VITE_API_BASE when it is on another origin. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/+$/, '')

/** How long to wait for an answer before giving up [assumption: no measurement behind 15 s yet]. */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * How long an upload (a picture plus its thumbnail, up to a few MB) may take [assumption: not measured
 * on a real connection yet; 60 s lets 3.3 MB through at about 0.5 Mbit/s, the slowest we plan for].
 */
export const UPLOAD_TIMEOUT_MS = 60_000

export interface RequestOptions {
  /** sent as JSON */
  body?: unknown
  /** sent as multipart/form-data: the browser sets the Content-Type (with the boundary) itself */
  form?: FormData
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

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface Answer<T> {
  data: T
  headers: Headers
}

/**
 * The one way out to the network. `read` turns a successful answer into the value the caller wants;
 * everything else (headers, time limit, errors, a token that no longer works) is the same for all callers.
 */
async function send<T>(
  method: Method,
  path: string,
  opts: RequestOptions,
  accept: string,
  read: (res: Response) => Promise<T>,
): Promise<Answer<T>> {
  const token = useSession.getState().token
  const headers: Record<string, string> = { Accept: accept, 'X-Request-ID': newRequestId() }
  const tz = timeZone()
  if (tz) headers['X-Timezone'] = tz
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.form === undefined && opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(
    () => {
      timedOut = true
      controller.abort()
    },
    opts.form !== undefined ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  )

  try {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        signal: controller.signal,
      })
    } catch {
      throw timedOut
        ? new ApiError('The server took too long to answer.', 0, 'timeout')
        : new ApiError('Could not reach the server.', 0, 'network_error')
    }

    if (!res.ok) {
      const err = toApiError(res, await readJson(res))
      // only if the token that failed is still the current one (the user may have signed in again meanwhile)
      if (res.status === 401 && err.code === 'unauthorized' && token && useSession.getState().token === token) {
        useSession.getState().signOut()
      }
      throw err
    }
    return { data: await read(res), headers: res.headers }
  } finally {
    clearTimeout(timer)
  }
}

async function readOkJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const payload = await readJson(res)
  if (payload === undefined) throw new ApiError('The server sent something we could not read.', res.status, 'server_error')
  return payload as T
}

/**
 * Calls the API and returns the parsed JSON (undefined for 204).
 * Any failure is an ApiError: network_error / timeout (status 0), or the server's own code.
 * A 401 `unauthorized` for the token we sent means it is no longer good: the user is signed out.
 */
export async function request<T = unknown>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  return (await send<T>(method, path, opts, 'application/json', readOkJson<T>)).data
}

/** Like `request()`, for the few answers whose headers matter too (e.g. `X-Next-Cursor` of a list). */
export function requestWithHeaders<T = unknown>(method: Method, path: string, opts: RequestOptions = {}): Promise<Answer<T>> {
  return send<T>(method, path, opts, 'application/json', readOkJson<T>)
}

/**
 * GET a file (a picture) that is only given to its owner: a plain <img src> cannot send the token,
 * so the bytes are fetched here and shown from an object URL.
 */
export async function requestBlob(path: string): Promise<Blob> {
  return (await send<Blob>('GET', path, {}, 'image/*', (res) => res.blob())).data
}
