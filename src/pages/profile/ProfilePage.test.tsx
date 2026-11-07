import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import en from '@/i18n/en.json'
import { GUEST, useSession } from '@/store/session'
import { useToasts } from '@/store/ui'
import ProfilePage from './ProfilePage'

/* The page runs on the real API layer; only the network (fetch) and the browser's "save as" are faked. */

const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock('@/lib/utils', async (orig) => ({ ...(await orig<typeof import('@/lib/utils')>()), downloadBlob }))

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function serve(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '')}`
    return routes[key]?.() ?? json(500, { error: { code: `unexpected_call:${key}`, message: 'x' } })
  })
}
const calls = () =>
  fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${(c[0] as string).replace('/api/v1', '')}`)

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const lastToast = () => useToasts.getState().toasts.at(-1)

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
})
beforeEach(() => {
  fetchMock.mockReset()
  downloadBlob.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useToasts.setState({ toasts: [] })
  serve({ 'GET /lessons': () => json(200, []) })
})
afterEach(() => useSession.setState({ user: GUEST, token: null }))

const signIn = () => useSession.setState({ user: { ...GUEST, isGuest: false, displayName: 'Lan' }, token: 'tok' })

describe('ProfilePage — the data card', () => {
  it('has no demo data, no "simulate server hiccups" and no "delete all local data"', () => {
    signIn()
    mount()

    expect(screen.queryByText(/demo data/i)).toBeNull()
    expect(screen.queryByText(/server hiccups/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /delete all local data/i })).toBeNull()
  })

  it('offers the export to somebody signed in, and saves what the server sends', async () => {
    signIn()
    serve({ 'GET /lessons': () => json(200, []), 'GET /me/export': () => json(200, { app: 'Art Spark', artworks: [] }) })
    mount()

    fireEvent.click(screen.getByRole('button', { name: en.profile.export }))

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string]
    expect(JSON.parse(await blob.text())).toEqual({ app: 'Art Spark', artworks: [] })
    expect(name).toMatch(/^art-spark-data-\d{4}-\d{2}-\d{2}\.json$/)
    expect(calls().filter((c) => c === 'GET /me/export')).toHaveLength(1)
    expect(lastToast()?.title).toBe(en.profile.exported)
  })

  it('names the file with the UTC date, the same day the server puts in its own file name', async () => {
    // 23:30 on 3 November in New York is already 4 November in UTC
    vi.stubEnv('TZ', 'America/New_York')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T23:30:00-05:00'))
    try {
      signIn()
      serve({ 'GET /lessons': () => json(200, []), 'GET /me/export': () => json(200, { app: 'Art Spark' }) })
      mount()
      fireEvent.click(screen.getByRole('button', { name: en.profile.export }))
      await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
      expect(downloadBlob.mock.calls[0][1]).toBe('art-spark-data-2026-11-04.json')
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })

  it('says so, and saves nothing, when the server refuses (too many exports)', async () => {
    signIn()
    serve({
      'GET /lessons': () => json(200, []),
      'GET /me/export': () => json(429, { error: { code: 'rate_limited', message: 'English text from the server' } }),
    })
    mount()

    fireEvent.click(screen.getByRole('button', { name: en.profile.export }))

    await waitFor(() => expect(lastToast()?.title).toBe(en.errors.api.rate_limited))
    expect(lastToast()?.tone).toBe('error')
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('keeps the button off while the file is on its way, so a double click asks once', async () => {
    signIn()
    let answer!: () => void
    const held = new Promise<void>((res) => (answer = res))
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '')}`
      if (key === 'GET /me/export') {
        await held
        return json(200, { app: 'Art Spark' })
      }
      return json(200, [])
    })
    mount()
    const button = screen.getByRole('button', { name: en.profile.export })

    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    fireEvent.click(button)
    answer()

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    expect(calls().filter((c) => c === 'GET /me/export')).toHaveLength(1)
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('says the server cannot be reached, and saves nothing, when the network is down', async () => {
    signIn()
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/export')) throw new TypeError('offline')
      return json(200, [])
    })
    mount()

    fireEvent.click(screen.getByRole('button', { name: en.profile.export }))

    await waitFor(() => expect(lastToast()?.title).toBe(en.errors.api.network_error))
    expect(lastToast()?.tone).toBe('error')
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('does not hand the file of an account over once somebody else (or nobody) is signed in', async () => {
    signIn()
    let answer!: () => void
    const held = new Promise<void>((res) => (answer = res))
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/export')) {
        await held
        return json(200, { app: 'Art Spark', user: { displayName: 'Lan' } })
      }
      return json(200, [])
    })
    mount()

    fireEvent.click(screen.getByRole('button', { name: en.profile.export }))
    await waitFor(() => expect(calls()).toContain('GET /me/export'))
    useSession.setState({ user: GUEST, token: null }) // signed out while the file was on its way
    answer()
    await new Promise((r) => setTimeout(r, 50))

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(lastToast()).toBeUndefined()
  })

  it('does not tell somebody else about a refusal meant for the account that signed out', async () => {
    signIn()
    let answer!: () => void
    const held = new Promise<void>((res) => (answer = res))
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/export')) {
        await held
        return json(429, { error: { code: 'rate_limited', message: 'x' } })
      }
      return json(200, [])
    })
    mount()

    fireEvent.click(screen.getByRole('button', { name: en.profile.export }))
    await waitFor(() => expect(calls()).toContain('GET /me/export'))
    useSession.setState({ user: GUEST, token: null })
    answer()
    await new Promise((r) => setTimeout(r, 50))

    expect(lastToast()).toBeUndefined()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('does not offer the export to a guest: there is nothing of theirs on the server', () => {
    useSession.setState({ user: GUEST, token: null })
    mount()

    expect(screen.queryByRole('button', { name: en.profile.export })).toBeNull()
    expect(calls()).not.toContain('GET /me/export')
  })
})
