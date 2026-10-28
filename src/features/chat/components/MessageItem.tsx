import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants, useChatVisibility } from '../motion'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatAttachment, ChatMessage } from '@/types'
import { Avatar } from '@/components/Avatar'
import { Markdown } from '@/components/Markdown'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import { Muse } from '../Muse'
import { ChatCardView } from '../ChatCards'
import { useChatImageUrl } from '../chatImages'
import { useChatStream } from '../streamStore'
import { splitStable, closeDangling } from '../streamingMarkdown'
import { MessageActions } from './MessageActions'

const StableMarkdown = memo(Markdown)
function MessageImage({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useTranslation()
  const src = useChatImageUrl(attachment.previewKey, attachment.src)
  return src ? (
    <img src={src} alt={attachment.name} className="max-h-48 rounded-2xl border border-line object-contain shadow-paper" />
  ) : (
    <p className="text-sm text-ink-faint">{t('chat.attach.errors.missing')}</p>
  )
}

function ReplyBody({ content, streaming }: { content: string; streaming: boolean }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const visible = useChatVisibility()
  const parts = streaming ? splitStable(content) : { stable: content, tail: '' }
  return (
    <div className="text-[0.97rem] leading-relaxed text-ink-soft">
      {streaming && !content ? (
        <p className="flex items-center gap-2">
          {t('chat.status.thinking')}
          <motion.span
            aria-hidden
            className="inline-block h-1 w-10 rounded-full bg-saffron"
            animate={!reduced && visible ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
            transition={!reduced && visible ? { duration: CHAT_MOTION.connecting, repeat: Infinity } : { duration: 0 }}
          />
        </p>
      ) : (
        <>
          {parts.stable && <StableMarkdown text={parts.stable} />}
          {parts.tail && (
            <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : CHAT_MOTION.tokenFlush }}>
              <Markdown text={closeDangling(parts.tail)} className="mt-2.5" />
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
      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-2', message.role === 'user' && 'items-end')}>
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
              <ReplyBody content={message.content} streaming={message.status === 'streaming'} />
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
          <div className="flex flex-wrap gap-3">
            {message.cards.map((card, index) => (
              <motion.div
                key={index}
                variants={variants.card}
                initial={message.status === 'streaming' ? 'hidden' : false}
                animate="visible"
                transition={{ delay: reduced ? 0 : index * CHAT_MOTION.cardStagger }}
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

function StreamingMessage({ message, conversationId, last }: { message: ChatMessage; conversationId: string; last: boolean }) {
  const active = useChatStream((s) => (s.active?.conversationId === conversationId && s.active.messageId === message.id ? s.active : null))
  return (
    <Content
      message={active ? { ...message, content: active.content, cards: active.cards } : message}
      conversationId={conversationId}
      last={last}
    />
  )
}

export const MessageItem = memo(function MessageItem(props: {
  message: ChatMessage
  conversationId: string
  last: boolean
  animateNew?: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <motion.li variants={chatVariants(reduced).bubble} initial={props.animateNew ? 'hidden' : false} animate="visible">
      {props.message.status === 'streaming' ? <StreamingMessage {...props} /> : <Content {...props} />}
    </motion.li>
  )
})
