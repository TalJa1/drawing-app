import { getChatTransport } from '@/api/ai/transport'
import { recordActivity } from '@/api/progress'
import { presentReward } from '@/store/ui'
import { createChatController } from './controller'
import { buildTurnRequest } from './request'
import { useChatStream } from './streamStore'

const controller = createChatController({
  transport: getChatTransport(),
  buildRequest: (conversation, turnId, action) => buildTurnRequest(conversation, turnId, action, null),
  recordTurnActivity: () => {
    void recordActivity({ type: 'chatMessage' }).then(presentReward)
  },
})

export function useMuse() {
  const phase = useChatStream((s) => s.active?.phase ?? null)
  const streamingConversationId = useChatStream((s) => s.active?.conversationId ?? null)
  return { ...controller, phase, streamingConversationId }
}
