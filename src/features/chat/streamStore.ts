import { create } from 'zustand'
import type { ChatCard } from '@/types'

export type StreamPhase = 'preparing' | 'connecting' | 'thinking' | 'streaming'
export type ActiveStream = {
  requestId: string
  conversationId: string
  turnId: string
  messageId: string
  phase: StreamPhase
  content: string
  cards: ChatCard[]
}

export const useChatStream = create<{ active: ActiveStream | null }>(() => ({ active: null }))
