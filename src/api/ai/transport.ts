import type { ChatStreamEvent } from '@/types'
import type { ChatTurnRequest } from '@/features/chat/contract'
import { mockTransport } from './mockTransport'
import { serverTransport, checkServerHealth } from './serverTransport'

export interface ChatTransport {
  streamTurn(req: ChatTurnRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent>
}

export function getChatTransport(): ChatTransport {
  const mode = import.meta.env.VITE_CHAT_TRANSPORT
  return mode === 'server' || (mode !== 'mock' && import.meta.env.PROD) ? serverTransport : mockTransport
}

export async function checkAiHealth(): Promise<{ configured: boolean } | null> {
  return getChatTransport() === serverTransport ? checkServerHealth() : null
}
