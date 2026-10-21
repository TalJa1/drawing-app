import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpen, Brush, Clock, Send } from 'lucide-react'
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

export function ChatCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const setPalette = useStudio((s) => s.setPendingPalette)

  if (card.type === 'palette')
    return (
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-3 shadow-paper">
        <p className="mb-2 text-sm font-semibold">{card.name}</p>
        <div className="flex h-14 overflow-hidden rounded-xl ring-1 ring-line-strong">
          {card.colors.map((c) => (
            <button
              key={c}
              type="button"
              className="group flex flex-1 items-end justify-center pb-1 transition-[flex] hover:flex-[1.5]"
              style={{ background: c, color: readableOn(c) }}
              aria-label={t('learn.copyColour', { hex: c })}
              onClick={async () => toast({ title: (await copyText(c)) ? t('common.copied') : c, description: c.toUpperCase(), tone: 'success' })}
            >
              <span className="font-mono text-[9.5px] opacity-0 transition-opacity group-hover:opacity-90">{c.toUpperCase()}</span>
            </button>
          ))}
        </div>
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
    return (
      <Link to={`/practice/${tpl.id}`} className="group flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-2.5 shadow-paper hover:shadow-lift">
        <img src={svgToDataUrl(tpl.svg)} alt="" className="h-16 w-20 shrink-0 rounded-lg border border-line bg-white object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('chat.cards.template')}</p>
          <p className="truncate font-display text-lg leading-tight">{L(tpl.title)}</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <DifficultyDots level={DIFF_LEVEL[tpl.difficulty]} label={t(`difficulty.${tpl.difficulty}`)} /> {t('common.minutes', { count: tpl.minutes })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
          <Brush size={12} /> {t('chat.cards.drawThis')}
        </span>
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
        <Link to={`/free-draw?prompt=${encodeURIComponent(card.title)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
          {t('chat.cards.sketchIt')} <ArrowRight size={12} />
        </Link>
      </div>
    )

  const lesson = LESSON_MAP[card.slug]
  if (!lesson) return null
  return (
    <Link to={`/learn/lessons/${lesson.slug}`} className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-paper hover:shadow-lift">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cerulean/15 text-cerulean">
        <BookOpen size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('chat.cards.lesson', { count: lesson.minutes })}</p>
        <p className="truncate font-display text-lg leading-tight">{L(lesson.title)}</p>
      </div>
    </Link>
  )
}
