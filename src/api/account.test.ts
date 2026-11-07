import { useSession, GUEST } from '@/store/session'
import { exportData } from './account'
import { ApiError } from './client'

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const FILE = {
  exportedAt: '2026-11-02T15:00:00Z',
  app: 'Art Spark',
  user: { id: 'u1', displayName: 'Lan' },
  progress: { xp: 120 },
  learning: { bookmarks: [] },
  artworks: [{ id: 'a1', title: 'Fox' }],
  xpLedger: [{ at: '2026-11-02T14:00:00Z', source: 'artworkSaved', ref: 'a1', xp: 25 }],
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession.setState({ user: { ...GUEST, isGuest: false, displayName: 'Lan' }, token: 'tok' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  useSession.setState({ user: GUEST, token: null })
})

describe('exportData', () => {
  it('asks the server once, with the token, and hands back exactly what it sent', async () => {
    fetchMock.mockResolvedValue(json(200, FILE))

    const blob = await exportData()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/me/export')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(blob.type).toBe('application/json')
    expect(JSON.parse(await blob.text())).toEqual(FILE)
  })

  it('lets the server error through (the hourly limit, for one) and makes no file', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 'rate_limited', message: 'x' } }))

    const e = await exportData().catch((x) => x)

    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 429, code: 'rate_limited' })
  })

  it.each([[null], ['text'], [7], [[]]])('refuses an answer that is not a file of data (%j)', async (body) => {
    fetchMock.mockResolvedValue(json(200, body))

    const e = await exportData().catch((x) => x)

    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('server_error')
  })

  it('reports that the network is down instead of exporting what is on this device', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))

    const e = await exportData().catch((x) => x)

    expect(e).toMatchObject({ status: 0, code: 'network_error' })
  })
})
