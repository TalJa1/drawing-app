import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * localStorage that never throws: private windows, full quotas or blocked
 * site data fall back to an in-memory map so the app keeps working.
 */
const memory = new Map<string, string>()

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return memory.get(name) ?? null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      memory.set(name, value)
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      memory.delete(name)
    }
  },
}

export const persistStorage = createJSONStorage(() => safeLocalStorage)

export const STORE_KEYS = {
  settings: 'artspark:settings',
  session: 'artspark:session',
  collection: 'artspark:collection',
  progress: 'artspark:progress',
  learn: 'artspark:learn',
  chat: 'artspark:chat',
  studio: 'artspark:studio',
} as const
