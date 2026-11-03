import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, MUSE_PAINT, chatVariants, useChatVisibility } from '../motion'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatAttachment, ChatMessage } from '@/types'
import { Avatar } from '@/components/Avatar'
import { Markdown } from '@/components/Markdown'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import { Muse } from '../Muse'
import { ChatCardView } from '../ChatCards'
import { useChatImage } from '../chatImages'
import { useChatStream } from '../streamStore'
import { splitStable, closeDangling } from '../streamingMarkdown'
import { MessageActions } from './MessageActions'

const StableMarkdown = memo(Markdown)
// An ink caret after the last streamed paragraph; it disappears once the reply settles.
const CARET =
  "[&>p:last-child]:after:ml-0.5 [&>p:last-child]:after:inline-block [&>p:last-child]:after:h-[1.05em] [&>p:last-child]:after:w-[2px] [&>p:last-child]:after:translate-y-[0.2em] [&>p:last-child]:after:rounded-full [&>p:last-child]:after:bg-accent-ink [&>p:last-child]:after:content-['']"
const CARET_BLINK = '[&>p:last-child]:after:animate-pulse'

function MessageImage({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useTranslation()
  const { src, missing } = useChatImage(attachment.previewKey, attachment.src)
  if (src) return <img src={src} alt={attachment.name} className="max-h-48 rounded-2xl border border-line object-contain shadow-paper" />
  if (missing) return <p className="text-sm text-ink-faint">{t('chat.attach.errors.missing')}</p>
  return <div aria-hidden className="skeleton h-32 w-44 rounded-2xl" />
}

function ReplyBody({ content, streaming, hasCards }: { content: string; streaming: boolean; hasCards: boolean }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const visible = useChatVisibility()
  const live = !reduced && visible
  const parts = streaming ? splitStable(content) : { stable: content, tail: '' }
  return (
    <div className="text-[0.97rem] leading-relaxed text-ink-soft">
      {streaming && !content ? (
        <p className="flex items-center gap-2">
          {t(hasCards ? 'chat.status.preparingText' : 'chat.status.thinking')}
          <span aria-hidden className="inline-flex items-end gap-1">
            {MUSE_PAINT.slice(0, 3).map((color, index) => (
              <motion.span
                key={color}
                className="block h-2 w-2 rounded-full"
                style={{ background: color }}
                animate={live ? { y: [0, -4, 0], opacity: [0.5, 1, 0.5] } : { opacity: 0.85 }}
                transition={
                  live
                    ? { duration: CHAT_MOTION.thinking, repeat: Infinity, ease: 'easeInOut', delay: index * CHAT_MOTION.thinkingStagger }
                    : { duration: 0 }
                }
              />
            ))}
          </span>
        </p>
      ) : (
        <>
          {parts.stable && <StableMarkdown text={parts.stable} />}
          {parts.tail && (
            <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : CHAT_MOTION.tokenFlush }}>
              <Markdown text={closeDangling(parts.tail)} className={cn('mt-2.5', CARET, live && CARET_BLINK)} />
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

function Content({ message, conversationId, last }: { message: ChatMessage; conversationId: string; last: boolean }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const variants = chatVariants(reduced)
  const avatarSeed = useSession((s) => s.user.avatarSeed)
  const incomplete =
    message.incompleteReason &&
    ['max_output_tokens', 'content_filter', 'max_messages', 'steered', 'budget'].includes(message.incompleteReason)
      ? message.incompleteReason
      : 'other'
  const notice =
    message.status === 'failed'
      ? t(`chat.errors.${message.errorCode ?? 'client'}`)
      : message.status === 'interrupted'
        ? t(message.incompleteReason ? `chat.incomplete.${incomplete}` : 'chat.status.interrupted')
        : message.status === 'stopped'
          ? t('chat.status.stopped')
          : null
  return (
    <div className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}>
      {message.role === 'user' ? (
        <Avatar seed={avatarSeed} size={34} className="mt-1" />
      ) : (
        <span className="mt-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3">
          <Muse size={34} still />
        </span>
      )}
      <div className={cn('flex min-w-0 flex-col gap-2', message.role === 'user' ? 'max-w-[85%] items-end' : 'flex-1')}>
        {message.attachments.map((attachment) => (
          <MessageImage key={attachment.id} attachment={attachment} />
        ))}
        {(message.content || message.status === 'streaming') && (
          <div
            className={cn(
              'rounded-[20px] px-4 py-3',
              message.role === 'user' ? 'rounded-tr-md bg-ink text-paper' : 'rounded-tl-md border border-line bg-card',
            )}
          >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReplyBody content={message.content} streaming={message.status === 'streaming'} hasCards={message.cards.length > 0} />
            )}
          </div>
        )}
        {notice && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0.08 : message.status === 'stopped' ? CHAT_MOTION.stop : CHAT_MOTION.error }}
            className="rounded-2xl border border-line bg-paper-3 px-3 py-2 text-sm"
          >
            {notice}
          </motion.p>
        )}
        {!!message.cards.length && (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            {message.cards.map((card, index) => (
              <motion.div
                key={index}
                className={cn('min-w-0', card.type === 'critique' && 'lg:col-span-2')}
                variants={chatVariants(reduced, index * CHAT_MOTION.cardStagger).card}
                initial={message.status === 'streaming' ? 'hidden' : false}
                animate="visible"
              >
                <ChatCardView card={card} animate={message.status === 'streaming'} conversationId={conversationId} />
              </motion.div>
            ))}
          </div>
        )}
        {message.role === 'assistant' && message.status !== 'streaming' && (
          <motion.div variants={variants.threadSwap} initial="hidden" animate="visible">
            <MessageActions message={message} conversationId={conversationId} last={last} />
          </motion.div>
        )}
      </div>
    </div>
  )
}

export const MessageItem = memo(function MessageItem(props: {
  message: ChatMessage
  conversationId: string
  last: boolean
  animateNew?: boolean
}) {
  const reduced = useReducedMotion()
  // One render path for streaming and settled replies, so cards and images are not remounted when the stream ends.
  const live = useChatStream((s) =>
    props.message.status === 'streaming' && s.active?.conversationId === props.conversationId && s.active.messageId === props.message.id
      ? s.active
      : null,
  )
  const message = live ? { ...props.message, content: live.content, cards: live.cards } : props.message
  return (
    <motion.li variants={chatVariants(reduced).bubble} initial={props.animateNew ? 'hidden' : false} animate="visible">
      <Content message={message} conversationId={props.conversationId} last={props.last} />
    </motion.li>
  )
})
