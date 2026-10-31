import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useDailyTemplateId, useLessonLookup, useTemplateLookup } from './queries'

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
