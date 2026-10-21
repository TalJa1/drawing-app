import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Artwork } from '@/types'
import { persistStorage, STORE_KEYS } from './storage'

/** Artwork metadata; the image blobs live in IndexedDB (see src/api/imageStore.ts). */
interface CollectionState {
  artworks: Artwork[]
  upsert: (a: Artwork) => void
  patch: (id: string, p: Partial<Artwork>) => void
  remove: (id: string) => void
  removeWhere: (pred: (a: Artwork) => boolean) => void
  clear: () => void
}

export const useCollection = create<CollectionState>()(
  persist(
    (set) => ({
      artworks: [],
      upsert: (a) =>
        set((s) => {
          const i = s.artworks.findIndex((x) => x.id === a.id)
          if (i === -1) return { artworks: [a, ...s.artworks] }
          const next = [...s.artworks]
          next[i] = a
          return { artworks: next }
        }),
      patch: (id, p) =>
        set((s) => ({ artworks: s.artworks.map((a) => (a.id === id ? { ...a, ...p } : a)) })),
      remove: (id) => set((s) => ({ artworks: s.artworks.filter((a) => a.id !== id) })),
      removeWhere: (pred) => set((s) => ({ artworks: s.artworks.filter((a) => !pred(a)) })),
      clear: () => set({ artworks: [] }),
    }),
    { name: STORE_KEYS.collection, storage: persistStorage, version: 1 },
  ),
)
