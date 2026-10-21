import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { persistStorage, STORE_KEYS } from './storage'

/** Guest profile used until someone (fake-)signs in. */
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
      signOut: () =>
        set((s) => ({
          token: null,
          user: { ...GUEST, displayName: s.user.displayName, avatarSeed: s.user.avatarSeed },
        })),
    }),
    { name: STORE_KEYS.session, storage: persistStorage, version: 1 },
  ),
)
