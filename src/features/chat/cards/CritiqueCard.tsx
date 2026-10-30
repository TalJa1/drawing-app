import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/app/theme'
import { useChat } from '@/store/chat'
import type { ChatCard } from '@/types'
import { CHAT_MOTION } from '../motion'
import { useChatImageUrl } from '../chatImages'

export function CritiqueCard({
  card,
  animate,
  conversationId,
}: {
  card: Extract<ChatCard, { type: 'critique' }>
  animate: boolean
  conversationId?: string
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const conversation = useChat((state) => state.conversations.find((item) => item.id === (conversationId ?? state.activeId)))
  const source = conversation?.messages.find(
    (message) => message.role === 'user' && message.attachments.some((image) => image.id === card.imageId),
  )
  const image = source?.attachments.find((attachment) => attachment.id === card.imageId)
  const src = useChatImageUrl(image?.previewKey, image?.src)
  const groups = [
    ['observations', card.observations],
    ['strengths', card.strengths],
    ['priorities', card.priorities],
    ['exercise', [card.exercise]],
  ] as const
  return (
    <div className="relative w-full space-y-3 overflow-hidden rounded-2xl border border-line bg-card p-4 pl-5 shadow-paper">
      <div className="flex items-start gap-3 border-b border-line pb-3">
        {src ? (
          <img src={src} alt={image?.name} className="h-16 w-[72px] shrink-0 rounded-lg border border-line object-contain" />
        ) : (
          <p className="flex min-h-16 w-[72px] shrink-0 items-center rounded-lg border border-line bg-paper-3 p-2 text-[11px] text-ink-soft">
            {t('chat.attach.errors.missing')}
          </p>
        )}
        <div className="min-w-0">
          {image && <p className="break-words text-xs font-semibold text-ink">{image.name}</p>}
          <p className="mt-1 text-xs text-ink-soft">{t('chat.cards.critique.imageCaution')}</p>
        </div>
      </div>
      <motion.span
        aria-hidden
        className="absolute inset-y-4 left-0 w-0.5 origin-top bg-cerulean"
        initial={animate ? (reduced ? { opacity: 0 } : { scaleY: 0 }) : false}
        animate={reduced ? { opacity: 1 } : { scaleY: 1 }}
        transition={{ duration: reduced ? 0.08 : CHAT_MOTION.critique }}
      />
      {groups.map(
        ([name, points], index) =>
          points.length > 0 && (
            <motion.section
              key={name}
              className="max-w-[80ch]"
              initial={animate ? (reduced ? { opacity: 0 } : { opacity: 0, y: 6 }) : false}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0.08 : CHAT_MOTION.critique, delay: reduced ? 0 : index * CHAT_MOTION.cardStagger }}
            >
              <h3 className="mb-1 text-xs font-semibold text-ink">{t(`chat.cards.critique.${name}`)}</h3>
              <ul className="space-y-1 text-sm text-ink-soft">
                {points.map((point, pointIndex) => (
                  <li key={pointIndex}>{point}</li>
                ))}
              </ul>
            </motion.section>
          ),
      )}
      <button
        type="button"
        className="min-h-11 text-xs font-semibold text-accent-ink hover:underline disabled:opacity-50"
        disabled={!source}
        onClick={() => {
          if (!source || !conversation) return
          useChat.getState().setImageContext(conversation.id, source.turnId)
          document.getElementById('chat-input')?.focus()
        }}
      >
        {t('chat.cards.critique.followUp')}
      </button>
    </div>
  )
}
