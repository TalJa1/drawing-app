import { useEffect, useId, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants } from './motion'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpen, Brush, Check, Clock, Copy, LockKeyhole, PenLine, Send } from 'lucide-react'
import type { ChatCard } from '@/types'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { LESSON_MAP } from '@/mocks/lessons'
import { useL } from '@/i18n/useL'
import { cn, copyText, svgToDataUrl } from '@/lib/utils'
import { contrastRatio, readableOn } from '@/lib/color'
import { recordActivity } from '@/api/progress'
import { presentReward, toast } from '@/store/ui'
import { useStudio } from '@/store/studio'
import { DifficultyDots } from '@/components/Chip'
import { DIFF_LEVEL } from '@/features/practice/constants'
import { useLevel } from '@/features/gamification/hooks'
import { CritiqueCard } from './cards/CritiqueCard'

/** Column spans on a 12-column grid: up to four swatches share one row, more split into balanced rows of three. */
function paletteSpans(count: number): number[] {
  const perRow = count <= 4 ? Math.max(count, 1) : 3
  return Array.from({ length: count }, (_, index) => 12 / Math.min(perRow, count - (index - (index % perRow))))
}

export function ChatCardView({ card, animate = false, conversationId }: { card: ChatCard; animate?: boolean; conversationId?: string }) {
  const { t } = useTranslation()
  if ((card.type === 'lesson' && !LESSON_MAP[card.slug]) || (card.type === 'template' && !TEMPLATE_MAP[card.templateId])) return null
  return (
    <div className="w-full min-w-0" data-card-type={card.type}>
      <p className="mb-2 text-[11px] font-semibold text-ink-faint">{t(`chat.cards.source.${card.type}`)}</p>
      <CardContent card={card} animate={animate} conversationId={conversationId} />
    </div>
  )
}

function CardContent({ card, animate, conversationId }: { card: ChatCard; animate: boolean; conversationId?: string }) {
  const { t } = useTranslation()
  const L = useL()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const setPalette = useStudio((s) => s.setPendingPalette)
  const { level } = useLevel()
  const titleId = useId()
  const [copied, setCopied] = useState<{ color: string } | null>(null)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), CHAT_MOTION.copyReset * 1000)
    return () => clearTimeout(timer)
  }, [copied])

  if (card.type === 'palette') {
    const swatchSpans = paletteSpans(card.colors.length)
    return (
      <div className="w-full rounded-2xl border border-line bg-card p-3 shadow-paper">
        <p className="mb-2 text-sm font-semibold">{card.name}</p>
        <div className="grid grid-cols-12 overflow-hidden rounded-xl ring-1 ring-line-strong">
          {card.colors.map((c, index) => {
            const role = card.roles?.[index]
            const labelStyle = { background: contrastRatio(c, readableOn(c)) < 4.5 ? readableOn(readableOn(c)) : undefined }
            return (
              <motion.button
                variants={chatVariants(reduced, index * 0.03).swatch}
                initial={animate ? 'hidden' : false}
                animate="visible"
                key={c}
                type="button"
                className={cn('relative flex flex-col items-center justify-end gap-0.5 pb-1.5', role ? 'min-h-16' : 'min-h-14')}
                style={{ gridColumn: `span ${swatchSpans[index]} / span ${swatchSpans[index]}`, background: c, color: readableOn(c) }}
                aria-label={
                  role ? `${t('learn.copyColour', { hex: c })}, ${t(`chat.cards.roles.${role}`)}` : t('learn.copyColour', { hex: c })
                }
                onClick={async () => {
                  const success = await copyText(c)
                  setCopied(success ? { color: c } : null)
                  toast({
                    title: success ? t('common.copied') : t('learn.lab.copyFailed'),
                    description: c.toUpperCase(),
                    tone: success ? 'success' : 'error',
                  })
                }}
              >
                {copied?.color === c && (
                  <motion.span
                    className="absolute top-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0.08 : CHAT_MOTION.copy }}
                  >
                    <Check size={14} />
                  </motion.span>
                )}
                <span className="rounded px-0.5 font-mono text-[11px]" style={labelStyle}>
                  {c.toUpperCase()}
                </span>
                {role && (
                  <span className="rounded px-0.5 text-[10px] font-semibold" style={labelStyle}>
                    {t(`chat.cards.roles.${role}`)}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
        {card.note && <p className="mt-2 text-xs text-ink-soft">{card.note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4">
          <button
            type="button"
            onClick={async () => {
              setPalette({ name: card.name, colors: card.colors })
              presentReward(await recordActivity({ type: 'paletteSent' }))
              navigate('/free-draw')
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline max-lg:min-h-11 max-lg:px-2"
          >
            <Send size={12} /> {t('learn.sendToStudio')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const hexes = card.colors.map((hex) => hex.toUpperCase()).join(' ')
              const success = await copyText(hexes)
              toast({
                title: success ? t('common.copied') : t('learn.lab.copyFailed'),
                description: hexes,
                tone: success ? 'success' : 'error',
              })
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline max-lg:min-h-11 max-lg:px-2"
          >
            <Copy size={12} /> {t('chat.cards.copyHex')}
          </button>
        </div>
      </div>
    )
  }

  if (card.type === 'template') {
    const tpl = TEMPLATE_MAP[card.templateId]
    if (!tpl) return null
    const locked = tpl.unlockLevel > level
    const action = 'inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold'
    return (
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-line bg-card p-3 shadow-paper">
        <img src={svgToDataUrl(tpl.svg)} alt="" className="h-16 w-20 shrink-0 rounded-lg border border-line bg-white object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('chat.cards.template')}</p>
          <p id={titleId} className="font-display text-lg leading-tight">
            {L(tpl.title)}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <DifficultyDots level={DIFF_LEVEL[tpl.difficulty]} label={t(`difficulty.${tpl.difficulty}`)} />{' '}
            {t('common.minutes', { count: tpl.minutes })}
          </p>
          {card.reason && <p className="mt-1 text-xs text-ink-soft">{card.reason}</p>}
        </div>
        {locked ? (
          <span className={`${action} col-span-2 justify-self-start bg-ink text-paper`}>
            <LockKeyhole size={12} /> {t('chat.cards.unlockLevel', { level: tpl.unlockLevel })}
          </span>
        ) : (
          <div className="col-span-2 flex flex-wrap gap-2">
            <Link to={`/practice/${tpl.id}`} aria-describedby={titleId} className={`${action} bg-ink text-paper hover:shadow-lift`}>
              <Brush size={12} /> {t('chat.cards.drawThis')}
            </Link>
            <Link
              to={`/free-draw?guide=${encodeURIComponent(tpl.id)}&prompt=${encodeURIComponent(L(tpl.title))}`}
              aria-describedby={titleId}
              className={`${action} border border-line-strong text-ink hover:bg-ink/5`}
            >
              <PenLine size={12} /> {t('chat.cards.traceIt')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  if (card.type === 'idea') {
    const guide = card.templateId ? TEMPLATE_MAP[card.templateId] : undefined
    const traceable = guide !== undefined && guide.unlockLevel <= level
    return (
      <div className="w-full rounded-2xl border border-line bg-card p-4 shadow-paper">
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
          to={`/free-draw?prompt=${encodeURIComponent(card.title)}${traceable ? `&guide=${encodeURIComponent(guide.id)}` : ''}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline max-lg:min-h-11 max-lg:px-2"
        >
          {t(traceable ? 'chat.cards.sketchWithGuide' : 'chat.cards.sketchIt')} <ArrowRight size={12} />
        </Link>
      </div>
    )
  }

  if (card.type === 'critique') return <CritiqueCard card={card} animate={animate} conversationId={conversationId} />

  const lesson = LESSON_MAP[card.slug]
  if (!lesson) return null
  return (
    <Link
      to={`/learn/lessons/${lesson.slug}`}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-paper hover:shadow-lift"
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
