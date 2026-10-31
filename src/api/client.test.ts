import { useSession, GUEST } from '@/store/session'
import { ApiError, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, request, requestBlob, requestWithHeaders } from './client'

const fetchMock = vi.fn()

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: new Headers(init.headers) }
}

const signedIn = () => useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false, displayName: 'Lan' }, token: 'tok-123' })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession.setState({ user: GUEST, token: null })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('request: what is sent', () => {
  it('sends a JSON body to the versioned API and returns the parsed answer', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: 1 }))
    const out = await request<{ ok: number }>('POST', '/auth/login', { body: { email: 'a@b.co', password: 'x' } })
    expect(out).toEqual({ ok: 1 })
    const { url, init, headers } = lastCall()
    expect(url).toBe('/api/v1/auth/login')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.co', password: 'x' }))
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json')
  })

  it('sends no body and no content type on a GET', async () => {
    fetchMock.mockResolvedValue(json(200, []))
    await request('GET', '/templates')
    const { init, headers } = lastCall()
    expect(init.body).toBeUndefined()
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('adds the bearer token only when there is one', async () => {
    fetchMock.mockImplementation(async () => json(200, {}))
    await request('GET', '/me')
    expect(lastCall().headers.has('Authorization')).toBe(false)
    signedIn()
    await request('GET', '/me')
    expect(lastCall().headers.get('Authorization')).toBe('Bearer tok-123')
  })

  it("tells the server the browser's time zone", async () => {
    fetchMock.mockResolvedValue(json(200, {}))
    await request('GET', '/me')
    expect(lastCall().headers.get('X-Timezone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('gives every request its own id the server accepts', async () => {
    fetchMock.mockImplementation(async () => json(200, {}))
    await request('GET', '/a')
    const first = lastCall().headers.get('X-Request-ID')
    await request('GET', '/b')
    const second = lastCall().headers.get('X-Request-ID')
    expect(first).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
    expect(second).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
    expect(first).not.toBe(second)
  })

  it('still makes an id where crypto.randomUUID does not exist (plain http on a LAN address)', async () => {
    vi.stubGlobal('crypto', {})
    fetchMock.mockImplementation(async () => json(200, {}))
    await request('GET', '/a')
    await request('GET', '/b')
    const ids = fetchMock.mock.calls.map(([, init]) => new Headers((init as RequestInit).headers).get('X-Request-ID'))
    expect(ids[0]).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
    expect(ids[0]).not.toBe(ids[1])
  })
})

describe('request: what comes back', () => {
  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(request('DELETE', '/artworks/1')).resolves.toBeUndefined()
  })

  it('turns the error envelope into an ApiError', async () => {
    const details = [{ field: 'email', message: 'bad' }]
    fetchMock.mockResolvedValue(json(422, { error: { code: 'validation_error', message: 'Nope', traceId: 'abc123', details } }))
    const err = await request('POST', '/auth/register', { body: {} }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'validation_error', message: 'Nope', traceId: 'abc123', details })
  })

  it('reads Retry-After from a 429', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 'rate_limited', message: 'Slow down' } }, { 'Retry-After': '42' }))
    const err = await request('POST', '/auth/login').catch((e) => e)
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 42 })
  })

  it('ignores a Retry-After that is not a whole number of seconds', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': 'soon' }))
    const err = (await request('POST', '/auth/login').catch((e) => e)) as ApiError
    expect(err.retryAfter).toBeUndefined()
  })

  it('maps an answer that is not our envelope (a proxy error page) to server_error', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    const err = await request('GET', '/templates').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, code: 'server_error' })
  })

  it('maps a success answer that is not JSON to server_error', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 200 }))
    const err = await request('GET', '/templates').catch((e) => e)
    expect(err).toMatchObject({ status: 200, code: 'server_error' })
  })

  it('reports a dead network as network_error with status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await request('GET', '/templates').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 0, code: 'network_error' })
  })
})

describe('request: time limit', () => {
  it('gives up after the limit with a timeout error and aborts the fetch', async () => {
    vi.useFakeTimers()
    let seen: AbortSignal | undefined
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          seen = init.signal as AbortSignal
          seen.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const pending = request('GET', '/templates').catch((e) => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(seen?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const err = await pending
    expect(seen?.aborted).toBe(true)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 0, code: 'timeout' })
  })

  it('leaves no timer behind after an answer', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(json(200, {}))
    await request('GET', '/me')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no timer behind after a failure', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await request('GET', '/me').catch(() => {})
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('request: a token the server no longer accepts', () => {
  it('signs the user out on 401 unauthorized', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'Please sign in' } }))
    await expect(request('GET', '/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(useSession.getState().token).toBeNull()
    expect(useSession.getState().user.isGuest).toBe(true)
  })

  it('does NOT sign out on a wrong password (401 invalid_credentials)', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(401, { error: { code: 'invalid_credentials', message: 'Incorrect' } }))
    await expect(request('POST', '/auth/login', { body: {} })).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(useSession.getState().token).toBe('tok-123')
  })

  it('does not sign out on other failures', async () => {
    signedIn()
    for (const status of [403, 404, 429, 500, 503]) {
      fetchMock.mockResolvedValueOnce(json(status, { error: { code: 'x', message: 'y' } }))
      await request('GET', '/me').catch(() => {})
    }
    expect(useSession.getState().token).toBe('tok-123')
  })

  it('only a 401 means "your token is no good": the same code on a 403 changes nothing', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(403, { error: { code: 'unauthorized', message: 'x' } }))
    await request('GET', '/me').catch(() => {})
    expect(useSession.getState().token).toBe('tok-123')
  })

  it('has nothing to sign out when there was no token', async () => {
    fetchMock.mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'Please sign in' } }))
    await expect(request('GET', '/me')).rejects.toMatchObject({ code: 'unauthorized' })
    expect(useSession.getState().user).toEqual(GUEST)
  })

  it('keeps a session that was started while the failing request was in flight', async () => {
    // request sent with the old token, user signs in again, then the old 401 arrives
    signedIn()
    fetchMock.mockImplementation(async () => {
      useSession.setState({ token: 'tok-NEW' })
      return json(401, { error: { code: 'unauthorized', message: 'Please sign in' } })
    })
    await request('GET', '/me').catch(() => {})
    expect(useSession.getState().token).toBe('tok-NEW')
  })
})

describe('request: sending files (multipart)', () => {
  const form = () => {
    const f = new FormData()
    f.append('image', new Blob(['png'], { type: 'image/png' }), 'a.png')
    return f
  }

  it('sends the FormData as it is and leaves the Content-Type to the browser (it adds the boundary)', async () => {
    fetchMock.mockResolvedValue(json(201, { id: 'a1' }))
    const f = form()
    await request('POST', '/artworks', { form: f })
    const { init, headers } = lastCall()
    expect(init.body).toBe(f)
    expect(headers.has('Content-Type')).toBe(false)
    expect(headers.get('Accept')).toBe('application/json')
  })

  it('still carries the token and the request id', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(201, {}))
    await request('POST', '/artworks', { form: form() })
    const { headers } = lastCall()
    expect(headers.get('Authorization')).toBe('Bearer tok-123')
    expect(headers.get('X-Request-ID')).toBeTruthy()
  })

  it('allows an upload more time than an ordinary call, and no more than that', async () => {
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS)
    vi.useFakeTimers()
    let seen: AbortSignal | undefined
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          seen = init.signal as AbortSignal
          seen.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const pending = request('POST', '/artworks', { form: form() }).catch((e) => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    expect(seen?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS - REQUEST_TIMEOUT_MS - 1)
    expect(seen?.aborted).toBe(true)
    expect(await pending).toMatchObject({ status: 0, code: 'timeout' })
  })

  it('maps the upload limit (429 + Retry-After) like any other call', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 'rate_limited', message: 'Daily limit' } }, { 'Retry-After': '3600' }))
    await expect(request('POST', '/artworks', { form: form() })).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfter: 3600,
    })
  })
})

describe('requestWithHeaders: when the answer has a header that matters', () => {
  it('returns the parsed body and the response headers', async () => {
    fetchMock.mockResolvedValue(json(200, [{ id: 'a1' }], { 'X-Next-Cursor': 'cur-2' }))
    const out = await requestWithHeaders<{ id: string }[]>('GET', '/artworks?limit=500')
    expect(out.data).toEqual([{ id: 'a1' }])
    expect(out.headers.get('X-Next-Cursor')).toBe('cur-2')
    expect(lastCall().url).toBe('/api/v1/artworks?limit=500')
  })

  it('has no cursor header on the last page', async () => {
    fetchMock.mockResolvedValue(json(200, []))
    const out = await requestWithHeaders('GET', '/artworks')
    expect(out.headers.get('X-Next-Cursor')).toBeNull()
  })

  it('fails like request() does', async () => {
    fetchMock.mockResolvedValue(json(403, { error: { code: 'template_locked', message: 'Locked' } }))
    await expect(requestWithHeaders('GET', '/artworks')).rejects.toMatchObject({ status: 403, code: 'template_locked' })
  })
})

describe('requestBlob: pictures that need the token', () => {
  const png = () => new Response('PNGDATA', { status: 200, headers: { 'Content-Type': 'image/png' } })

  it('asks for an image with the bearer token and returns the bytes', async () => {
    signedIn()
    fetchMock.mockResolvedValue(png())
    const blob = await requestBlob('/artworks/a1/image')
    const { url, init, headers } = lastCall()
    expect(url).toBe('/api/v1/artworks/a1/image')
    expect(init.method).toBe('GET')
    expect(headers.get('Authorization')).toBe('Bearer tok-123')
    expect(headers.get('Accept')).toMatch(/^image\//)
    expect(await blob.text()).toBe('PNGDATA')
    expect(blob.type).toBe('image/png')
  })

  it('turns the error envelope into an ApiError (not a broken picture)', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(404, { error: { code: 'not_found', message: 'No such artwork' } }))
    await expect(requestBlob('/artworks/x/image')).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })

  it('signs the user out when the token is no longer good', async () => {
    signedIn()
    fetchMock.mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'Please sign in' } }))
    await requestBlob('/artworks/a1/image').catch(() => {})
    expect(useSession.getState().token).toBeNull()
  })

  it('reports a dead network as network_error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(requestBlob('/artworks/a1/image')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('uses the ordinary time limit and leaves no timer behind', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(png())
    await requestBlob('/artworks/a1/image')
    expect(vi.getTimerCount()).toBe(0)
  })
})
