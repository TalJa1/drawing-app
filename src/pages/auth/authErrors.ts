import { ApiError } from '@/api/client'

/** The server's error code → the i18n key of what the sign-in / sign-up forms tell the user (messages are translated here, not on the server). */
const KEYS: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalid',
  email_taken: 'auth.errors.emailTaken',
  rate_limited: 'auth.errors.rateLimited',
  network_error: 'auth.errors.offline',
  timeout: 'auth.errors.offline',
}

/** A gateway in front of the API that cannot reach it answers 502/503/504 (not our envelope): same as being offline. */
const GATEWAY_DOWN = new Set([502, 503, 504])

export function authErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) return 'common.errorGeneric'
  if (GATEWAY_DOWN.has(e.status)) return 'auth.errors.offline'
  return KEYS[e.code] ?? 'common.errorGeneric'
}
