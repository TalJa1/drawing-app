import type { Conversation } from '@/types'
import { uid } from '@/lib/random'
import { useSettings } from '@/store/settings'
import { LIMITS, PROTOCOL_VERSION } from './contract'
import type { ChatTurnRequest, HistoryItem, LearnerSnapshot } from './contract'

export async function buildTurnRequest(
  conversation: Conversation,
  turnId: string,
  action: 'send' | 'regenerate',
  learner: LearnerSnapshot | null,
): Promise<ChatTurnRequest> {
  const index = conversation.messages.findIndex((m) => m.turnId === turnId && m.role === 'user')
  const question = conversation.messages[index]
  if (!question) throw new Error('Chat turn has no user message')
  const turns: { id: string; items: HistoryItem[] }[] = []
  for (const message of conversation.messages.slice(0, index)) {
    if (message.role === 'assistant' && (message.status === 'failed' || message.status === 'streaming')) continue
    const item: HistoryItem = { role: message.role, text: message.content }
    if (
      message.role === 'assistant' &&
      (message.status === 'completed' || message.status === 'stopped' || message.status === 'interrupted')
    ) {
      item.status = message.status
    }
    const last = turns.at(-1)
    if (last?.id === message.turnId) last.items.push(item)
    else turns.push({ id: message.turnId, items: [item] })
  }
  let history = turns.flatMap((turn) => turn.items)
  while (history.length > LIMITS.maxHistoryItems || history.reduce((count, item) => count + item.text.length, 0) > LIMITS.maxHistoryChars) {
    turns.shift()
    history = turns.flatMap((turn) => turn.items)
  }
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: uid('r_'),
    conversationId: conversation.id,
    turnId,
    action,
    mode: question.mode ?? conversation.mode,
    lang: useSettings.getState().language,
    message: { text: question.content, images: [] },
    history,
    learner,
  }
}
