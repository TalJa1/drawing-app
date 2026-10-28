import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants } from './motion'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpen, Brush, Check, Clock, LockKeyhole, Send } from 'lucide-react'
import type { ChatCard } from '@/types'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { LESSON_MAP } from '@/mocks/lessons'
import { useL } from '@/i18n/useL'
import { copyText, svgToDataUrl } from '@/lib/utils'
import { readableOn } from '@/lib/color'
import { recordActivity } from '@/api/progress'
import { presentReward, toast } from '@/store/ui'
import { useStudio } from '@/store/studio'
import { DifficultyDots } from '@/components/Chip'
import { DIFF_LEVEL } from '@/features/practice/constants'
import { useLevel } from '@/features/gamification/hooks'
import { CritiqueCard } from './cards/CritiqueCard'

export function ChatCardView({ card, animate = false, conversationId }: { card: ChatCard; animate?: boolean; conversationId?: string }) {
  const { t } = useTranslation()
  const L = useL()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const setPalette = useStudio((s) => s.setPendingPalette)
  const { level } = useLevel()
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), CHAT_MOTION.copyReset * 1000)
    return () => clearTimeout(timer)
  }, [copied])

  if (card.type === 'palette')
    return (
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-3 shadow-paper">
        <p className="mb-2 text-sm font-semibold">{card.name}</p>
        <div className="flex h-14 overflow-hidden rounded-xl ring-1 ring-line-strong">
          {card.colors.map((c, index) => (
            <motion.button
              variants={chatVariants(reduced).swatch}
              initial={animate ? 'hidden' : false}
              animate="visible"
              transition={{ duration: CHAT_MOTION.swatch, delay: reduced ? 0 : index * 0.03 }}
              key={c}
              type="button"
              className="group flex flex-1 items-end justify-center pb-1 transition-[flex] hover:flex-[1.5]"
              style={{ background: c, color: readableOn(c) }}
              aria-label={t('learn.copyColour', { hex: c })}
              onClick={async () => {
                const success = await copyText(c)
                setCopied(success ? c : null)
                toast({
                  title: success ? t('common.copied') : t('learn.lab.copyFailed'),
                  description: c.toUpperCase(),
                  tone: success ? 'success' : 'error',
                })
              }}
            >
              {copied === c && <Check size={14} className="self-center" />}
              <span className="font-mono text-[9.5px] opacity-0 transition-opacity group-hover:opacity-90">{c.toUpperCase()}</span>
            </motion.button>
          ))}
        </div>
        {card.roles && (
          <div className="mt-1 flex text-center text-[10px] text-ink-soft">
            {card.roles.map((role, index) => (
              <span key={index} className="flex-1">
                {t(`chat.cards.roles.${role}`)}
              </span>
            ))}
          </div>
        )}
        {card.note && <p className="mt-2 text-xs text-ink-soft">{card.note}</p>}
        <button
          type="button"
          onClick={async () => {
            setPalette({ name: card.name, colors: card.colors })
            presentReward(await recordActivity({ type: 'paletteSent' }))
            navigate('/free-draw')
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline"
        >
          <Send size={12} /> {t('learn.sendToStudio')}
        </button>
      </div>
    )

  if (card.type === 'template') {
    const tpl = TEMPLATE_MAP[card.templateId]
    if (!tpl) return null
    const locked = tpl.unlockLevel > level
    const className = 'group flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-2.5 shadow-paper'
    const contents = (
      <>
        <img src={svgToDataUrl(tpl.svg)} alt="" className="h-16 w-20 shrink-0 rounded-lg border border-line bg-white object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('chat.cards.template')}</p>
          <p className="truncate font-display text-lg leading-tight">{L(tpl.title)}</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <DifficultyDots level={DIFF_LEVEL[tpl.difficulty]} label={t(`difficulty.${tpl.difficulty}`)} />{' '}
            {t('common.minutes', { count: tpl.minutes })}
          </p>
          {card.reason && <p className="mt-1 text-xs text-ink-soft">{card.reason}</p>}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
          {locked ? <LockKeyhole size={12} /> : <Brush size={12} />}
          {locked ? t('chat.cards.unlockLevel', { level: tpl.unlockLevel }) : t('chat.cards.drawThis')}
        </span>
      </>
    )
    return locked ? (
      <div className={className}>{contents}</div>
    ) : (
      <Link to={`/practice/${tpl.id}`} className={`${className} hover:shadow-lift`}>
        {contents}
      </Link>
    )
  }

  if (card.type === 'idea')
    return (
      <div className="w-full max-w-[17rem] rounded-2xl border border-line bg-card p-4 shadow-paper">
        <p className="font-display text-lg leading-tight">{card.title}</p>
        <p className="mt-1 text-sm text-ink-soft">{card.description}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <DifficultyDots level={DIFF_LEVEL[card.difficulty]} label={t(`difficulty.${card.difficulty}`)} />
            {t(`difficulty.${card.difficulty}`)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {t('common.minutes', { count: card.minutes })}
          </span>
        </div>
        <Link
          to={`/free-draw?prompt=${encodeURIComponent(card.title)}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
        >
          {t('chat.cards.sketchIt')} <ArrowRight size={12} />
        </Link>
      </div>
    )

  if (card.type === 'critique') return <CritiqueCard card={card} animate={animate} conversationId={conversationId} />

  const lesson = LESSON_MAP[card.slug]
  if (!lesson) return null
  return (
    <Link
      to={`/learn/lessons/${lesson.slug}`}
      className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-paper hover:shadow-lift"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cerulean/15 text-cerulean">
        <BookOpen size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          {t('chat.cards.lesson', { count: lesson.minutes })}
        </p>
        <p className="truncate font-display text-lg leading-tight">{L(lesson.title)}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <DifficultyDots level={DIFF_LEVEL[lesson.difficulty]} label={t(`difficulty.${lesson.difficulty}`)} />
          {t(`difficulty.${lesson.difficulty}`)}
        </p>
        {card.reason && <p className="mt-1 text-xs text-ink-soft">{card.reason}</p>}
      </div>
    </Link>
  )
}
