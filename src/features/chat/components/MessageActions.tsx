import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants } from '../motion'
import { Check, ChevronLeft, ChevronRight, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { copyText } from '@/lib/utils'
import { toast } from '@/store/ui'
import { useChat } from '@/store/chat'
import { useMuse } from '../useMuse'

export function MessageActions({ message, conversationId, last }: { message: ChatMessage; conversationId: string; last: boolean }) {
  const { t } = useTranslation()
  const { retry, regenerate, phase } = useMuse()
  const reduced = useReducedMotion()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), CHAT_MOTION.copyReset * 1000)
    return () => clearTimeout(timer)
  }, [copied])
  const [now, setNow] = useState(Date.now)
  const [version, setVersion] = useState(message.variants?.length ?? 0)
  const [slots, setSlots] = useState(() => (message.variants ?? []).map((_, index) => index))
  const deadline = message.retryAt ? Date.parse(message.retryAt) : 0
  const remaining = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0
  useEffect(() => {
    if (!deadline || deadline <= Date.now()) return
    const timer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= deadline) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [deadline])
  const canRetry = last && (message.status === 'failed' || message.status === 'stopped' || message.status === 'interrupted')
  const changeVersion = (next: number) => {
    const slot = slots.indexOf(next)
    if (slot < 0) return
    useChat.getState().selectVariant(conversationId, message.id, slot)
    setSlots((current) => current.map((value, index) => (index === slot ? version : value)))
    setVersion(next)
  }
  return (
    <div className="space-y-1">
      {canRetry && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={14} />}
            disabled={remaining > 0 || phase !== null}
            onClick={() => void retry(conversationId)}
          >
            {t('common.retry')}
          </Button>
          {remaining > 0 && <span>{t('chat.status.retryIn', { count: remaining })}</span>}
        </div>
      )}
      {!!(message.content || message.cards.length) && (
        <div className="flex flex-wrap gap-0.5">
          <IconButton
            size="sm"
            label={t('common.copy')}
            icon={
              <motion.span key={copied ? 'copied' : 'copy'} variants={chatVariants(reduced).threadSwap} initial="hidden" animate="visible">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </motion.span>
            }
            onClick={async () => {
              const success = await copyText(message.content)
              setCopied(success)
              toast({ title: success ? t('common.copied') : t('learn.lab.copyFailed'), tone: 'success' })
            }}
          />
          <IconButton
            size="sm"
            label={t('chat.helpful')}
            active={message.rating === 'up'}
            icon={<ThumbsUp size={14} />}
            onClick={() =>
              useChat.getState().updateMessage(conversationId, message.id, { rating: message.rating === 'up' ? undefined : 'up' })
            }
          />
          <IconButton
            size="sm"
            label={t('chat.notHelpful')}
            active={message.rating === 'down'}
            icon={<ThumbsDown size={14} />}
            onClick={() =>
              useChat.getState().updateMessage(conversationId, message.id, { rating: message.rating === 'down' ? undefined : 'down' })
            }
          />
          {copied && <span className="self-center text-xs text-ink-faint">{t('common.copied')}</span>}
          {last && (
            <IconButton
              size="sm"
              label={t('chat.regenerate')}
              icon={<RefreshCw size={14} />}
              disabled={phase !== null || remaining > 0}
              onClick={() => void regenerate(conversationId)}
            />
          )}
        </div>
      )}
      {last && !!message.variants?.length && (
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            label={t('chat.previousVersion')}
            icon={<ChevronLeft size={14} />}
            disabled={version === 0 || phase !== null}
            onClick={() => changeVersion(version - 1)}
          />
          <span className="text-xs tabular-nums">
            {version + 1}/{message.variants.length + 1}
          </span>
          <IconButton
            size="sm"
            label={t('chat.nextVersion')}
            icon={<ChevronRight size={14} />}
            disabled={version === message.variants.length || phase !== null}
            onClick={() => changeVersion(version + 1)}
          />
        </div>
      )}
    </div>
  )
}
