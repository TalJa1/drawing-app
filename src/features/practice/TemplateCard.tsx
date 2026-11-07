import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Lock, Star } from 'lucide-react'
import type { Template } from '@/types'
import { API_BASE } from '@/api/client'
import { cn, svgToDataUrl } from '@/lib/utils'
import { useL } from '@/i18n/useL'
import { preloadRoute } from '@/app/routes'
import { TiltCard } from '@/components/Card'
import { DifficultyDots } from '@/components/Chip'
import { DIFF_LEVEL } from './constants'

/** `imageUrl` is a path on the API host ("/api/v1/…"); the page itself may be on another host. */
function apiUrl(path: string): string {
  try {
    return new URL(path, new URL(API_BASE, window.location.href)).href
  } catch {
    return path
  }
}

/** The widths the API makes for `?w=` (back-end: services/image_cache.py THUMB_WIDTHS). */
const THUMB_WIDTHS = [320, 480, 640, 960] as const

function thumbUrl(path: string, w: number): string {
  const u = new URL(apiUrl(path), window.location.href)
  u.searchParams.set('w', String(w))
  return u.href
}

/**
 * The template picture. A card shows it at 230-420 px but the stored PNG is 1200 px, so a caller that
 * knows how wide it draws it passes `sizes` and the browser picks a small WebP from the API (`?w=`).
 * Without `sizes` it gets the full PNG, as before. `priority` is for the one above the fold.
 * The frame shows a quiet placeholder until the file arrives (a slow first request used to leave a
 * blank white box), and a picture that fails to load is shown as the browser draws it, never hidden.
 */
export function TemplateImage({
  template,
  className,
  alt = '',
  sizes,
  priority = false,
}: {
  template: Template
  className?: string
  alt?: string
  sizes?: string
  priority?: boolean
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const path = template.imageUrl
  useEffect(() => {
    if (ref.current?.complete) setReady(true) // it was already in the cache before React attached onLoad
  }, [])
  let srcSet: string | undefined
  let src: string
  try {
    src = path ? apiUrl(path) : svgToDataUrl(template.svg)
    if (path && sizes) srcSet = THUMB_WIDTHS.map((w) => `${thumbUrl(path, w)} ${w}w`).join(', ')
  } catch {
    src = svgToDataUrl(template.svg)
  }
  return (
    <div className="relative h-full w-full">
      {!ready && (
        <div aria-hidden className="absolute inset-0">
          <div className="skeleton h-full w-full" />
        </div>
      )}
      <img
        ref={ref}
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={1200}
        height={900}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        className={cn(
          'relative h-full w-full object-contain transition-opacity duration-300 reduced:transition-none',
          ready ? 'opacity-100' : 'opacity-0',
          className,
        )}
      />
    </div>
  )
}

/** How wide the card picture is drawn at each viewport (grid: 1 / 2 / 3 / 4 columns at 0 / 640 / 1024 / 1280). */
const CARD_SIZES = '(min-width:1280px) 280px, (min-width:1024px) 30vw, (min-width:640px) 44vw, 88vw'

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
            <TemplateImage template={template} sizes={CARD_SIZES} />
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
              <DifficultyDots level={DIFF_LEVEL[template.difficulty]} />
              {t(`difficulty.${template.difficulty}`)}
            </span>
            {best === undefined && !locked && (
              <span className="rounded-full bg-accent-ink/10 px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                {t('practice.card.new')}
              </span>
            )}
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
      // No aria-label: the link is named by what it shows (category, time, title, level), so the name always
      // contains the visible text (WCAG 2.5.3). A custom label that left some of it out failed that.
    >
      {body}
    </Link>
  )
}
