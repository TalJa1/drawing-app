import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'

/**
 * Queries are tried once more after a failure that may pass by itself (no network, timeout, 5xx).
 * A 4xx is the server's answer to this exact request — asking again only gives it again, and
 * makes a 401/404/429 wait twice as long to show.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: shouldRetry, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})
