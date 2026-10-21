import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type FrameTone = 'wood' | 'gold' | 'light'

/** Gallery frame with a mat and an optional museum wall label. */
export function Frame({
  children,
  tone = 'wood',
  frameWidth = 12,
  matWidth = 14,
  label,
  className,
  artClassName,
  style,
  tilt,
}: {
  children: ReactNode
  tone?: FrameTone
  frameWidth?: number
  matWidth?: number
  label?: ReactNode
  className?: string
  artClassName?: string
  style?: CSSProperties
  /** small rotation in degrees for a hung-by-hand feel */
  tilt?: number
}) {
  return (
    <figure className={cn('relative', className)} style={style}>
      <div
        className={cn('frame', tone === 'gold' && 'frame-gold', tone === 'light' && 'frame-light')}
        style={
          {
            '--frame-w': `${frameWidth}px`,
            transform: tilt ? `rotate(${tilt}deg)` : undefined,
          } as CSSProperties
        }
      >
        <div className="mat" style={{ '--mat-w': `${matWidth}px` } as CSSProperties}>
          <div className={cn('art overflow-hidden bg-white', artClassName)}>{children}</div>
        </div>
      </div>
      {label && <figcaption className="mt-4">{label}</figcaption>}
    </figure>
  )
}

/** Small-caps museum wall label. */
export function WallLabel({
  title,
  lines,
  className,
}: {
  title: ReactNode
  lines?: ReactNode[]
  className?: string
}) {
  return (
    <div className={cn('wall-label border-l-2 border-ink/20 pl-3', className)}>
      <strong className="block leading-tight">{title}</strong>
      {lines?.filter(Boolean).map((l, i) => (
        <span key={i} className="block leading-snug">
          {l}
        </span>
      ))}
    </div>
  )
}
