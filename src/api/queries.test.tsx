import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { GUEST, useSession } from '@/store/session'
import {
  qk,
  useAchievements,
  useArtwork,
  useArtworks,
  useChallenges,
  useClaimChallenge,
  useDailyTemplateId,
  useLeaderboard,
  useLessonLookup,
  useTemplateLookup,
  useTemplatePopularityQuery,
  watchAccountChange,
} from './queries'

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const urls = () => fetchMock.mock.calls.map((c) => c[0] as string)

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useTemplateLookup', () => {
  it('finds nothing until the list has arrived, then finds a template by id', async () => {
    fetchMock.mockImplementation(async () => json(200, [{ id: 'fox', title: { en: 'Fox', vi: 'Cáo' } }, { id: 'cat' }]))
    const { result } = renderHook(() => useTemplateLookup(), { wrapper: wrapper() })
    expect(result.current('fox')).toBeUndefined()
    await waitFor(() => expect(result.current('fox')?.id).toBe('fox'))
    expect(result.current('cat')?.id).toBe('cat')
    expect(urls()).toEqual(['/api/v1/templates'])
  })

  it('returns undefined for an unknown id or no id, never throws', async () => {
    fetchMock.mockImplementation(async () => json(200, [{ id: 'fox' }]))
    const { result } = renderHook(() => useTemplateLookup(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current('fox')).toBeDefined())
    expect(result.current('nope')).toBeUndefined()
    expect(result.current(undefined)).toBeUndefined()
    expect(result.current('')).toBeUndefined()
  })

  it('still answers (with nothing) when the server fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useTemplateLookup(), { wrapper: wrapper() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current('fox')).toBeUndefined()
  })
})

describe('useLessonLookup', () => {
  it('finds a lesson by slug once the list has arrived', async () => {
    fetchMock.mockImplementation(async () => json(200, [{ slug: 'rule-of-thirds' }, { slug: 'proportion' }]))
    const { result } = renderHook(() => useLessonLookup(), { wrapper: wrapper() })
    expect(result.current('proportion')).toBeUndefined()
    await waitFor(() => expect(result.current('proportion')?.slug).toBe('proportion'))
    expect(result.current('nope')).toBeUndefined()
    expect(urls()).toEqual(['/api/v1/lessons'])
  })
})

describe('useDailyTemplateId', () => {
  it('is the id the server names, and nothing before it answers', async () => {
    fetchMock.mockImplementation(async () => json(200, { templateId: 'vase' }))
    const { result } = renderHook(() => useDailyTemplateId(), { wrapper: wrapper() })
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe('vase'))
    expect(urls()).toEqual(['/api/v1/challenges/daily-template'])
  })

  it('does not guess a template when the server fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useDailyTemplateId(), { wrapper: wrapper() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current).toBeUndefined()
  })

  it('asks again on a new local day even within the freshness window (23:58 → 00:03)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 30, 23, 58))
    fetchMock.mockImplementation(async () => json(200, { templateId: fetchMock.mock.calls.length === 1 ? 'vase' : 'fox' }))
    const w = wrapper()
    const first = renderHook(() => useDailyTemplateId(), { wrapper: w })
    await waitFor(() => expect(first.result.current).toBe('vase'))
    first.unmount()
    vi.setSystemTime(new Date(2026, 9, 31, 0, 3))
    const second = renderHook(() => useDailyTemplateId(), { wrapper: w })
    await waitFor(() => expect(second.result.current).toBe('fox'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useTemplatePopularityQuery', () => {
  const body = { windowDays: 30, asOf: '2026-10-31T03:00:00Z', counts: { fox: 3, cat: 0 } }

  it('is the counts the server sends, and nothing before it answers', async () => {
    fetchMock.mockImplementation(async () => json(200, body))
    const { result } = renderHook(() => useTemplatePopularityQuery(), { wrapper: wrapper() })
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.data?.counts).toEqual({ fox: 3, cat: 0 }))
    expect(urls()).toEqual(['/api/v1/template-popularity'])
  })

  it('does not ask again within a minute, and asks again after it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 31, 10, 0, 0))
    fetchMock.mockImplementation(async () => json(200, body))
    const w = wrapper()
    const first = renderHook(() => useTemplatePopularityQuery(), { wrapper: w })
    await waitFor(() => expect(first.result.current.data).toBeDefined())
    first.unmount()

    vi.setSystemTime(new Date(2026, 9, 31, 10, 0, 59))
    const soon = renderHook(() => useTemplatePopularityQuery(), { wrapper: w })
    await waitFor(() => expect(soon.result.current.data).toBeDefined())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    soon.unmount()

    vi.setSystemTime(new Date(2026, 9, 31, 10, 1, 1))
    const later = renderHook(() => useTemplatePopularityQuery(), { wrapper: w })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    later.unmount()
  })

  it('does not ask again when the window regains focus, even when the numbers are old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 31, 10, 0, 0))
    fetchMock.mockImplementation(async () => json(200, body))
    const { result } = renderHook(() => useTemplatePopularityQuery(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    vi.setSystemTime(new Date(2026, 9, 31, 10, 30, 0)) // stale by now
    window.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('has no data when the server fails, and does not throw', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useTemplatePopularityQuery(), { wrapper: wrapper() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current.data).toBeUndefined()
  })
})

describe('watchAccountChange: nothing of one person is left for the next', () => {
  const signedIn = (id: string) => useSession.setState({ user: { ...GUEST, id, isGuest: false }, token: `tok-${id}` })
  let stop = () => {}
  afterEach(() => {
    stop()
    useSession.setState({ user: GUEST, token: null })
  })

  function seeded() {
    const client = new QueryClient()
    client.setQueryData(qk.artworks, [{ id: 'a1' }])
    client.setQueryData(qk.artwork('a1'), { id: 'a1' })
    client.setQueryData(qk.templates, [{ id: 'fox' }])
    client.setQueryData(qk.challenges, [{ periodKey: '2026-11-02' }])
    client.setQueryData(qk.achievements, { badges: [] })
    client.setQueryData(qk.leaderboard('weekly'), [{ id: '1' }])
    client.setQueryData(qk.leaderboard('all'), [{ id: '1' }])
    stop = watchAccountChange(client)
    return client
  }

  it('forgets the artworks when someone signs out', () => {
    signedIn('u1')
    const client = seeded()
    useSession.setState({ user: GUEST, token: null })
    expect(client.getQueryData(qk.artworks)).toBeUndefined()
    expect(client.getQueryData(qk.artwork('a1'))).toBeUndefined()
  })

  it("forgets the challenges, badges and rankings too: they are this account's", () => {
    signedIn('u1')
    const client = seeded()
    useSession.setState({ user: GUEST, token: null })
    expect(client.getQueryData(qk.challenges)).toBeUndefined()
    expect(client.getQueryData(qk.achievements)).toBeUndefined()
    expect(client.getQueryData(qk.leaderboard('weekly'))).toBeUndefined()
    expect(client.getQueryData(qk.leaderboard('all'))).toBeUndefined()
  })

  it('forgets them when another person signs in on top', () => {
    signedIn('u1')
    const client = seeded()
    signedIn('u2')
    expect(client.getQueryData(qk.artworks)).toBeUndefined()
  })

  it('keeps what is the same for everyone (the templates)', () => {
    signedIn('u1')
    const client = seeded()
    useSession.setState({ user: GUEST, token: null })
    expect(client.getQueryData(qk.templates)).toEqual([{ id: 'fox' }])
  })

  it('does nothing while the token stays the same (a profile edit, say)', () => {
    signedIn('u1')
    const client = seeded()
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false, displayName: 'New name' } })
    expect(client.getQueryData(qk.artworks)).toEqual([{ id: 'a1' }])
  })

  it('stops watching when told to', () => {
    signedIn('u1')
    const client = seeded()
    stop()
    useSession.setState({ user: GUEST, token: null })
    expect(client.getQueryData(qk.artworks)).toEqual([{ id: 'a1' }])
  })
})

describe('useArtworks / useArtwork: only for someone with an account', () => {
  afterEach(() => useSession.setState({ user: GUEST, token: null }))

  it('does not ask the server for a guest (it would only answer 401)', async () => {
    useSession.setState({ user: GUEST, token: null })
    const { result } = renderHook(() => ({ list: useArtworks(), one: useArtwork('a1') }), { wrapper: wrapper() })
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.list.data).toBeUndefined()
    expect(result.current.list.isLoading).toBe(false)
  })

  it('asks for the list of a signed-in user', async () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    fetchMock.mockClear() // signing in made the app fetch the account's learning: not what this test counts
    fetchMock.mockImplementation(async () => json(200, [{ id: 'a1' }]))
    const { result } = renderHook(() => useArtworks(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a1' }]))
    expect(urls()).toEqual(['/api/v1/artworks?limit=500'])
  })

  it('asks for one artwork of a signed-in user', async () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    fetchMock.mockClear() // signing in made the app fetch the account's learning: not what this test counts
    fetchMock.mockImplementation(async () => json(200, { id: 'a1' }))
    const { result } = renderHook(() => useArtwork('a1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a1' }))
    expect(urls()).toEqual(['/api/v1/artworks/a1'])
  })
})

describe('useChallenges / useAchievements / useLeaderboard: only for someone with an account', () => {
  afterEach(() => useSession.setState({ user: GUEST, token: null }))

  it('do not ask the server for a guest (it would only answer 401)', async () => {
    useSession.setState({ user: GUEST, token: null })
    const { result } = renderHook(() => ({ c: useChallenges(), a: useAchievements(), l: useLeaderboard('weekly') }), { wrapper: wrapper() })
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchMock).not.toHaveBeenCalled()
    expect([result.current.c.isLoading, result.current.a.isLoading, result.current.l.isLoading]).toEqual([false, false, false])
  })

  it('ask for the challenges, the badges and the chosen ranking of a signed-in user', async () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    fetchMock.mockClear() // signing in made the app fetch the account's learning: not what this test counts
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/challenges')) return json(200, [])
      if (url.endsWith('/achievements')) return json(200, { badges: [] })
      return json(200, [])
    })
    const { result } = renderHook(() => ({ c: useChallenges(), a: useAchievements(), l: useLeaderboard('all') }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.c.isSuccess && result.current.a.isSuccess && result.current.l.isSuccess).toBe(true))
    expect(urls().sort()).toEqual(['/api/v1/achievements', '/api/v1/challenges', '/api/v1/leaderboard?scope=all'])
  })
})

describe('useClaimChallenge', () => {
  afterEach(() => useSession.setState({ user: GUEST, token: null }))

  it('refreshes the challenges, the badges and both rankings once the reward is paid', async () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/claim')
        ? json(200, {
            xpGained: 40,
            xpBefore: 0,
            xpAfter: 40,
            levelBefore: 1,
            levelAfter: 1,
            newBadges: [],
            streak: 0,
            streakExtended: false,
            completedChallenges: [],
          })
        : json(500, { error: { code: 'internal_error', message: 'x' } }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useClaimChallenge(), { wrapper: w })
    await act(async () => {
      await result.current.mutateAsync({ id: 'd-free', periodKey: '2026-11-02' })
    })
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    expect(keys).toEqual(
      expect.arrayContaining([JSON.stringify(qk.challenges), JSON.stringify(qk.achievements), JSON.stringify(['leaderboard'])]),
    )
  })

  it('looks at the challenges again when the claim is refused, and at nothing else (no reward was paid)', async () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    fetchMock.mockImplementation(async () => json(409, { error: { code: 'already_claimed', message: 'x' } }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useClaimChallenge(), { wrapper: w })
    await act(async () => {
      await result.current.mutateAsync({ id: 'd-free', periodKey: '2026-11-02' }).catch(() => {})
    })
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    expect(keys).toEqual([JSON.stringify(qk.challenges)])
  })
})
