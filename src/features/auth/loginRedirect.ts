/* Where a guest is sent to sign in, and where they go afterwards (used by RequireAuth and by the pages that need an account). */

/** What the sign-in page is told: where the person was going (an address inside the app). */
export interface LoginState {
  from?: string
}

export const loginState = (from: string): LoginState => ({ from })

/**
 * Where to go once signed in: the page remembered by `loginState`, or `fallback`. Only an address inside
 * the app is accepted (it starts with one "/", and is not the sign-in or sign-up page, which would loop).
 */
export function loginTarget(state: unknown, fallback: string): string {
  const from = (state as LoginState | null)?.from
  if (typeof from !== 'string' || !/^\/(?![/\\])/.test(from)) return fallback
  if (/^\/(login|register)(?![\w-])/.test(from)) return fallback
  return from
}
