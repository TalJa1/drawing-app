import { useState, type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/store/session'
import { loginState } from './loginRedirect'

/** A page that belongs to an account: a guest is sent to sign in and brought back afterwards. */
export function RequireAuth({ children }: { children: ReactElement }) {
  const signedIn = useSession((s) => !!s.token)
  const { pathname, search } = useLocation()
  const [mountedAt] = useState(pathname) // where this page was put on screen
  if (signedIn) return children
  // The layout keeps the old page on screen while it animates out, so after the redirect this still renders,
  // now with the new location. It has done its job: redirecting again from there would overwrite the page
  // the guest was heading for with the sign-in page itself (and loop).
  if (pathname !== mountedAt) return null
  return <Navigate to="/login" replace state={loginState(pathname + search)} />
}
