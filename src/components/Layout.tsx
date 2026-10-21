import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/app/theme'
import { PaintSplatter } from './art/Splatter'

/** Editorial section heading: "01 — Practice" marker + serif title. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lede,
  align = 'left',
  className,
  note,
}: {
  index?: string
  eyebrow?: ReactNode
  title: ReactNode
  lede?: ReactNode
  align?: 'left' | 'center'
  className?: string
  /** handwritten aside */
  note?: ReactNode
}) {
  return (
    <header className={cn('relative', align === 'center' && 'mx-auto text-center', className)}>
      {(index || eyebrow) && (
        <p className={cn('eyebrow flex items-center gap-3', align === 'center' && 'justify-center')}>
          {index && <span className="font-display text-base italic tracking-normal text-accent-ink normal-case">{index}</span>}
          {index && <span aria-hidden className="h-px w-10 bg-ink/30" />}
          {eyebrow}
        </p>
      )}
      <h2 className="display-lg mt-4">{title}</h2>
      {lede && <p className={cn('mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft', align === 'center' && 'mx-auto')}>{lede}</p>}
      {note && <p className="hand mt-3 rotate-[-2deg] text-2xl text-accent-ink">{note}</p>}
    </header>
  )
}

/** Fade/slide in when scrolled into view (staggers via `delay`). */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'li' | 'section'
}) {
  const reduced = useReducedMotion()
  const M = as === 'li' ? motion.li : as === 'section' ? motion.section : motion.div
  if (reduced) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  )
}

/** Charming empty state with a splatter and handwritten note. */
export function EmptyState({
  title,
  body,
  action,
  note,
  className,
  art,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  note?: ReactNode
  className?: string
  art?: ReactNode
}) {
  return (
    <div className={cn('relative mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center', className)}>
      <div className="relative mb-6 h-36 w-36">
        <PaintSplatter seed="empty" color="var(--saffron)" className="absolute inset-0 opacity-50" />
        <div className="absolute inset-0 flex items-center justify-center">
          {art ?? (
            <svg viewBox="0 0 80 80" className="h-20 w-20" aria-hidden>
              <rect x="14" y="10" width="52" height="60" rx="3" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.5" />
              <path d="M24 52c8-10 14-16 22-14s10 8 14 4" fill="none" stroke="var(--vermilion)" strokeWidth="3" strokeLinecap="round" />
              <path d="M58 8l10 10-22 22-12 2 2-12z" fill="var(--ink)" />
            </svg>
          )}
        </div>
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      {body && <p className="mt-2 text-ink-soft">{body}</p>}
      {note && <p className="hand mt-3 rotate-[-2deg] text-xl text-accent-ink">{note}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Marquee({ children, duration = 40, className }: { children: ReactNode; duration?: number; className?: string }) {
  return (
    <div className={cn('marquee overflow-hidden', className)}>
      <div className="marquee-track" style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Page wrapper: consistent top padding below the floating nav. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative pb-28 pt-24 md:pb-20 md:pt-32', className)}>{children}</div>
}
