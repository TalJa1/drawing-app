import type { User } from '@/types'
import { useSession } from '@/store/session'
import type { components } from './schema'
import { request } from './client'

export interface LoginRequest {
  email: string
  password: string
}
export interface RegisterRequest extends LoginRequest {
  displayName: string
}
export interface AuthResponse {
  user: User
  token: string
}

// The server's shapes come from its OpenAPI (src/api/schema.d.ts). Assigning them to the app's own
// types below makes `tsc` fail when the two drift apart.
type AuthOut = components['schemas']['AuthOut']
type UserOut = components['schemas']['UserOut']

/** POST /auth/login */
export async function login(req: LoginRequest): Promise<AuthResponse> {
  const res: AuthOut = await request<AuthOut>('POST', '/auth/login', { body: req })
  useSession.getState().setSession(res.user, res.token)
  return res
}

/** POST /auth/register */
export async function register(req: RegisterRequest): Promise<AuthResponse> {
  const res: AuthOut = await request<AuthOut>('POST', '/auth/register', { body: req })
  useSession.getState().setSession(res.user, res.token)
  return res
}

/** POST /auth/logout — the server has nothing to revoke (stateless token), so we sign out here whatever it says. */
export async function logout(): Promise<void> {
  try {
    await request<void>('POST', '/auth/logout')
  } catch {
    /* offline or expired: the local sign-out below is what matters */
  }
  useSession.getState().signOut()
}

/** PATCH /me. A guest has no profile on the server, so a guest's change stays on this device. */
export async function updateProfile(p: Partial<Pick<User, 'displayName' | 'bio' | 'avatarSeed'>>): Promise<User> {
  const { token } = useSession.getState()
  if (!token) {
    useSession.getState().updateProfile(p)
    return useSession.getState().user
  }
  const user: UserOut = await request<UserOut>('PATCH', '/me', { body: p })
  useSession.getState().setSession(user, token)
  return user
}
