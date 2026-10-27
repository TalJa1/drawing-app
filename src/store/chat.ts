import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatMode, Conversation } from '@/types'
import { uid } from '@/lib/random'
import { persistStorage, STORE_KEYS } from './storage'
import { migrateChatState, reviveInterrupted } from '@/features/chat/storage'

interface ChatState {
  conversations: Conversation[]
  activeId: string | null
  /** A prompt handed over from another page (e.g. the result page) */
  draft: string | null
  drafts: Record<string, string>
  create: (mode?: ChatMode, title?: string) => string
  setActive: (id: string | null) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  setMode: (id: string, mode: ChatMode) => void
  addMessage: (id: string, m: ChatMessage) => void
  updateMessage: (id: string, messageId: string, p: Partial<ChatMessage>) => void
  removeMessage: (id: string, messageId: string) => void
  setDraft: (d: string | null) => void
  setConversationDraft: (convId: string, text: string) => void
  commitReply: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void
  pushVariant: (convId: string, msgId: string) => void
  selectVariant: (convId: string, msgId: string, index: number) => void
  setImageContext: (convId: string, turnId: string | null) => void
  reset: () => void
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      draft: null,
      drafts: {},
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
          const drafts = { ...s.drafts }
          delete drafts[id]
          return { conversations, drafts, activeId: s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId }
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
      setConversationDraft: (convId, text) =>
        set((s) => {
          const drafts = { ...s.drafts }
          if (text) drafts[convId] = text
          else delete drafts[convId]
          return { drafts }
        }),
      commitReply: (convId, msgId, patch) => get().updateMessage(convId, msgId, patch),
      pushVariant: (convId, msgId) => {
        const message = get()
          .conversations.find((c) => c.id === convId)
          ?.messages.at(-1)
        if (!message || message.id !== msgId || message.role !== 'assistant' || message.status === 'streaming') return
        const { content, cards, createdAt } = message
        get().updateMessage(convId, msgId, {
          variants: [...(message.variants ?? []), { content, cards, createdAt, status: message.status ?? 'completed' }],
        })
      },
      selectVariant: (convId, msgId, index) => {
        const message = get()
          .conversations.find((c) => c.id === convId)
          ?.messages.at(-1)
        const selected = message?.variants?.[index]
        if (!message || message.id !== msgId || message.role !== 'assistant' || message.status === 'streaming' || !selected) return
        const variants = [...(message.variants ?? [])]
        variants[index] = {
          content: message.content,
          cards: message.cards,
          status: message.status ?? 'completed',
          createdAt: message.createdAt,
        }
        get().updateMessage(convId, msgId, { ...selected, variants, errorCode: undefined, incompleteReason: undefined, rating: undefined })
      },
      setImageContext: (convId, turnId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === convId ? { ...c, imageContextTurnId: turnId } : c)),
        })),
      reset: () => set({ conversations: [], activeId: null, draft: null, drafts: {} }),
    }),
    {
      name: STORE_KEYS.chat,
      storage: persistStorage,
      version: 2,
      migrate: migrateChatState,
      partialize: (s) => ({ conversations: s.conversations, activeId: s.activeId, draft: s.draft, drafts: s.drafts }),
      merge: (persisted, current) => {
        const state = migrateChatState(persisted, 2)
        return { ...current, ...state, conversations: reviveInterrupted(state.conversations) }
      },
    },
  ),
)
