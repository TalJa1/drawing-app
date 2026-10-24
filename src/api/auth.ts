import type { User } from '@/types'
import { uid } from '@/lib/random'
import { useSession } from '@/store/session'
import { ApiError, simulate } from './client'

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

/** POST /auth/login — any email/password "works" in the mock. */
export async function login(req: LoginRequest): Promise<AuthResponse> {
  await simulate({ latency: [500, 1100] })
  if (req.password.toLowerCase() === 'wrongpass') throw new ApiError('Invalid credentials', 401, 'invalid_credentials')
  const prev = useSession.getState().user
  const name = req.email.split('@')[0].replace(/[._-]+/g, ' ')
  const user: User = {
    id: uid('u_'),
    email: req.email,
    displayName: prev.isGuest && prev.displayName !== 'Guest Artist' ? prev.displayName : name.charAt(0).toUpperCase() + name.slice(1),
    bio: prev.bio,
    avatarSeed: prev.avatarSeed === 'guest-artist' ? req.email : prev.avatarSeed,
    createdAt: new Date().toISOString(),
    isGuest: false,
  }
  const token = `mock.${btoa(encodeURIComponent(req.email))}.${Date.now()}`
  useSession.getState().setSession(user, token)
  return { user, token }
}

/** POST /auth/register */
export async function register(req: RegisterRequest): Promise<AuthResponse> {
  await simulate({ latency: [700, 1300] })
  const prev = useSession.getState().user
  const user: User = {
    id: uid('u_'),
    email: req.email,
    displayName: req.displayName,
    bio: prev.bio,
    avatarSeed: prev.avatarSeed === 'guest-artist' ? req.displayName : prev.avatarSeed,
    createdAt: new Date().toISOString(),
    isGuest: false,
  }
  const token = `mock.${btoa(encodeURIComponent(req.email))}.${Date.now()}`
  useSession.getState().setSession(user, token)
  return { user, token }
}

/** POST /auth/logout */
export async function logout(): Promise<void> {
  await simulate({ latency: [150, 300], canFail: false })
  useSession.getState().signOut()
}

/** PATCH /me */
export async function updateProfile(p: Partial<Pick<User, 'displayName' | 'bio' | 'avatarSeed'>>): Promise<User> {
  await simulate({ latency: [250, 600] })
  useSession.getState().updateProfile(p)
  return useSession.getState().user
}
