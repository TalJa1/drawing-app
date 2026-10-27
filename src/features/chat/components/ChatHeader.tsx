import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { History, LayoutGrid, Lightbulb, Palette, PanelLeft } from 'lucide-react'
import type { ChatMode } from '@/types'
import { IconButton } from '@/components/IconButton'
import { useReducedMotion } from '@/app/theme'
import { Muse } from '../Muse'
import { CHAT_MOTION } from '../motion'
import type { ReplyStatus } from '@/types'
import type { StreamPhase } from '../streamStore'
import { cn } from '@/lib/utils'

const MODES = [
  { id: 'ideas', icon: Lightbulb },
  { id: 'colour', icon: Palette },
  { id: 'composition', icon: LayoutGrid },
  { id: 'history', icon: History },
] as const

export function ChatHeader({
  title,
  mode,
  onModeChange,
  desktop,
  onHistory,
  phase = null,
  replyStatus,
  hasMessages = false,
}: {
  title?: string
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  desktop: boolean
  onHistory: () => void
  phase?: StreamPhase | null
  replyStatus?: ReplyStatus
  hasMessages?: boolean
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const state =
    phase === 'connecting' || phase === 'thinking'
      ? 'thinking'
      : phase === 'streaming'
        ? 'speaking'
        : replyStatus === 'failed'
          ? 'error'
          : 'idle'
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <header className="min-w-0 border-b border-line px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {!desktop && <IconButton label={t('chat.history')} icon={<PanelLeft size={18} />} onClick={onHistory} className="!h-11 !w-11" />}
        {hasMessages && <Muse size={42} state={state} />}
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-xl leading-tight">{title || t('chat.title')}</h1>
          <p className="mt-1 text-xs text-ink-faint">{t('chat.subtitle')}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label={t('chat.modeLabel')} className="no-scrollbar mt-3 flex gap-1 overflow-x-auto">
        {MODES.map(({ id, icon: Icon }, index) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            tabIndex={mode === id ? 0 : -1}
            ref={(node) => {
              refs.current[index] = node
            }}
            onClick={() => onModeChange(id)}
            onKeyDown={(event) => {
              const moves: Record<string, number> = {
                ArrowRight: (index + 1) % MODES.length,
                ArrowLeft: (index + MODES.length - 1) % MODES.length,
                Home: 0,
                End: MODES.length - 1,
              }
              const next = moves[event.key]
              if (next === undefined) return
              event.preventDefault()
              onModeChange(MODES[next].id)
              refs.current[next]?.focus()
            }}
            className={cn(
              'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold',
              mode === id ? 'text-paper' : 'text-ink-soft',
            )}
          >
            {mode === id && (
              <motion.span
                layoutId="chat-mode-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ duration: reduced ? 0 : CHAT_MOTION.mode }}
              />
            )}
            <Icon size={14} className="relative" />
            <span className="relative">{t(`chat.modes.${id}.name`)}</span>
          </button>
        ))}
      </div>
    </header>
  )
}
