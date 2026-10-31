import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useDailyTemplateId, useLessonLookup, useTemplateLookup, useTemplatePopularityQuery } from './queries'

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
