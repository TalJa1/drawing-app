import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatMode, Conversation } from '@/types'
import { uid } from '@/lib/random'
import { persistStorage, STORE_KEYS } from './storage'

interface ChatState {
  conversations: Conversation[]
  activeId: string | null
  /** A prompt handed over from another page (e.g. the result page) */
  draft: string | null
  create: (mode?: ChatMode, title?: string) => string
  setActive: (id: string | null) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  setMode: (id: string, mode: ChatMode) => void
  addMessage: (id: string, m: ChatMessage) => void
  updateMessage: (id: string, messageId: string, p: Partial<ChatMessage>) => void
  removeMessage: (id: string, messageId: string) => void
  setDraft: (d: string | null) => void
  reset: () => void
}

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      draft: null,
      create: (mode = 'ideas', title = '') => {
        const id = uid('c_')
        const now = new Date().toISOString()
        set((s) => ({
          conversations: [{ id, title, mode, messages: [], createdAt: now, updatedAt: now }, ...s.conversations],
          activeId: id,
        }))
        return id
      },
      setActive: (activeId) => set({ activeId }),
      rename: (id, title) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) })),
      remove: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id)
          return { conversations, activeId: s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId }
        }),
      setMode: (id, mode) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, mode } : c)) })),
      addMessage: (id, m) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, messages: [...c.messages, m], updatedAt: m.createdAt } : c)),
        })),
      updateMessage: (id, messageId, p) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...p } : m)) } : c,
          ),
        })),
      removeMessage: (id, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c)),
        })),
      setDraft: (draft) => set({ draft }),
      reset: () => set({ conversations: [], activeId: null, draft: null }),
    }),
    {
      name: STORE_KEYS.chat,
      storage: persistStorage,
      version: 1,
      // never persist half-streamed replies
      partialize: (s) => ({
        ...s,
        conversations: s.conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => (m.pending ? { ...m, pending: false } : m)),
        })),
      }),
    },
  ),
)
