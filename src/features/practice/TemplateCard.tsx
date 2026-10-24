import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Lock, Star } from 'lucide-react'
import type { Template } from '@/types'
import { cn, svgToDataUrl } from '@/lib/utils'
import { useL } from '@/i18n/useL'
import { preloadRoute } from '@/app/routes'
import { TiltCard } from '@/components/Card'
import { DifficultyDots } from '@/components/Chip'
import { DIFF_LEVEL } from './constants'

export function TemplateImage({ template, className, alt = '' }: { template: Template; className?: string; alt?: string }) {
  return (
    <img
      src={template.imageUrl ?? svgToDataUrl(template.svg)}
      alt={alt}
      width={1200}
      height={900}
      loading="lazy"
      decoding="async"
      className={cn('h-full w-full object-contain', className)}
    />
  )
}

export function TemplateCard({
  template,
  best,
  locked,
  isDaily,
}: {
  template: Template
  best?: number
  locked: boolean
  isDaily?: boolean
}) {
  const { t } = useTranslation()
  const L = useL()
  const title = L(template.title)
  const body = (
    <TiltCard className="h-full rounded-[22px]">
      <article
        className={cn(
          'paper relative flex h-full flex-col overflow-hidden rounded-[22px] border border-line shadow-paper transition-shadow duration-300 group-hover:shadow-lift',
        )}
      >
        <div className="relative m-3 mb-0 overflow-hidden rounded-[14px] border-[7px] border-[var(--mat)] bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06),0_1px_0_rgb(0_0_0/0.05)]">
          <div
            className={cn(
              'aspect-[4/3] p-2 transition-transform duration-500 group-hover:scale-[1.035]',
              locked && 'opacity-40 blur-[1.5px]',
            )}
          >
            <TemplateImage template={template} />
          </div>
          {isDaily && (
            <span className="absolute left-2 top-2 rounded-full bg-saffron px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-inkwell shadow">
              {t('practice.daily.badge')}
            </span>
          )}
          {best !== undefined && !locked && (
            <span
              className={cn(
                'absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums shadow',
                best >= 85 ? 'bg-gold text-inkwell' : 'bg-ink text-paper',
              )}
              title={t('practice.card.best')}
            >
              <Star size={11} className={best >= 85 ? 'fill-inkwell' : ''} /> {best}
            </span>
          )}
          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper shadow-lift">
                <Lock size={20} />
              </span>
              <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-ink shadow">
                {t('practice.card.reachLevel', { level: template.unlockLevel })}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3">
          <div className="wall-label flex items-center justify-between gap-2">
            <span>{t(`practice.categories.${template.category}`)}</span>
            <span className="inline-flex items-center gap-1 normal-case tracking-normal">
              <Clock size={12} /> {t('common.minutes', { count: template.minutes })}
            </span>
          </div>
          <h3 className="font-display text-xl leading-tight">{title}</h3>
          <div className="mt-auto flex items-center justify-between pt-1 text-xs text-ink-faint">
            <span className="inline-flex items-center gap-2">
              <DifficultyDots level={DIFF_LEVEL[template.difficulty]} label={t(`difficulty.${template.difficulty}`)} />
              {t(`difficulty.${template.difficulty}`)}
            </span>
            {best === undefined && !locked && <span className="hand text-base text-accent-ink">{t('practice.card.new')}</span>}
          </div>
        </div>
      </article>
    </TiltCard>
  )
  if (locked)
    return (
      <div
        className="group h-full cursor-not-allowed"
        aria-label={`${title} — ${t('practice.card.reachLevel', { level: template.unlockLevel })}`}
        role="group"
      >
        {body}
      </div>
    )
  return (
    <Link
      to={`/practice/${template.id}`}
      className="group block h-full rounded-[22px]"
      onMouseEnter={() => preloadRoute(`/practice/${template.id}`)}
      aria-label={`${title}, ${t(`difficulty.${template.difficulty}`)}`}
    >
      {body}
    </Link>
  )
}
