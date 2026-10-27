import type { ChatStreamEvent } from '@/types'
import type { ChatTurnRequest } from '@/features/chat/contract'
import { mockTransport } from './mockTransport'

export interface ChatTransport {
  streamTurn(req: ChatTurnRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent>
}

export function getChatTransport(): ChatTransport {
  return mockTransport
}
