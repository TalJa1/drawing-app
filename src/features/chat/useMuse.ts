import { getChatTransport } from '@/api/ai/transport'
import { recordActivity } from '@/api/progress'
import { presentReward } from '@/store/ui'
import { useProgress } from '@/store/progress'
import { useLearn } from '@/store/learn'
import { levelFromXp } from '@/features/gamification/rules'
import type { LearnerSnapshot } from './contract'
import { createChatController } from './controller'
import { buildTurnRequest } from './request'
import { useChatStream } from './streamStore'

export function learnerSnapshot(): LearnerSnapshot {
  return {
    level: levelFromXp(useProgress.getState().xp),
    completedLessons: Object.entries(useLearn.getState().lessons)
      .filter(([, progress]) => progress.completed)
      .map(([slug]) => slug),
  }
}

const controller = createChatController({
  transport: getChatTransport(),
  buildRequest: (conversation, turnId, action) => buildTurnRequest(conversation, turnId, action, learnerSnapshot()),
  recordTurnActivity: () => {
    void recordActivity({ type: 'chatMessage' }).then(presentReward)
  },
})

export function useMuse() {
  const phase = useChatStream((s) => s.active?.phase ?? null)
  const streamingConversationId = useChatStream((s) => s.active?.conversationId ?? null)
  return { ...controller, phase, streamingConversationId }
}
