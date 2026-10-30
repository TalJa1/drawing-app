import { useTranslation } from 'react-i18next'
import type { Conversation } from '@/types'
import { useChatStream } from '../streamStore'

export function ChatStatus({ conversation }: { conversation: Conversation | null }) {
  const { t } = useTranslation()
  const phase = useChatStream((s) => (s.active?.conversationId === conversation?.id ? (s.active?.phase ?? null) : null))
  const preparingText = useChatStream((s) => s.active?.conversationId === conversation?.id && !!s.active?.cards.length && !s.active.content)
  const last = conversation?.messages.at(-1)
  const status = phase ?? (last?.role === 'assistant' ? last.status : undefined)
  return (
    <p role="status" aria-atomic="true" className="sr-only">
      {preparingText ? t('chat.status.preparingText') : status ? t(`chat.status.${status}`) : ''}
    </p>
  )
}
