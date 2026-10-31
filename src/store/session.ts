import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { persistStorage, STORE_KEYS } from './storage'

/** Guest profile used until someone signs in. */
export const GUEST: User = {
  id: 'guest',
  email: '',
  displayName: 'Guest Artist',
  bio: '',
  avatarSeed: 'guest-artist',
  createdAt: new Date(0).toISOString(),
  isGuest: true,
}

interface SessionState {
  user: User
  token: string | null
  setSession: (user: User, token: string) => void
  updateProfile: (p: Partial<Pick<User, 'displayName' | 'bio' | 'avatarSeed'>>) => void
  signOut: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: GUEST,
      token: null,
      setSession: (user, token) => set({ user, token }),
      updateProfile: (p) => set((s) => ({ user: { ...s.user, ...p } })),
      // back to the plain guest: nothing of the account that left stays on screen
      signOut: () => set({ token: null, user: GUEST }),
    }),
    {
      name: STORE_KEYS.session,
      storage: persistStorage,
      // v2: sign-in is real. A v1 session came from the mock login; its token means nothing to the server.
      version: 2,
      migrate: () => ({ user: GUEST, token: null }),
    },
  ),
)
