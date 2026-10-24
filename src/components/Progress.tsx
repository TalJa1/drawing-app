import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/app/theme'

/** Animated number count-up when scrolled into view. */
export function CountUp({
  to,
  duration = 1.4,
  decimals = 0,
  className,
  suffix = '',
  start = true,
}: {
  to: number
  duration?: number
  decimals?: number
  className?: string
  suffix?: string
  start?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView || !start) return
    if (reduced) {
      const id = requestAnimationFrame(() => setVal(to))
      return () => cancelAnimationFrame(id)
    }
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setVal })
    return () => c.stop()
  }, [inView, to, duration, reduced, start])
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {val.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/** Circular progress (brush-textured stroke). */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--vermilion)',
  track = 'var(--paper-3)',
  children,
  className,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
  className?: string
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/** Horizontal meter with a painted fill. */
export function Meter({
  value,
  max = 100,
  label,
  color = 'var(--viridian)',
  showValue = true,
  className,
  height = 10,
}: {
  value: number
  max?: number
  label?: ReactNode
  color?: string
  showValue?: boolean
  className?: string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('w-full', className)} ref={ref}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-soft">{label}</span>
          {showValue && <span className="font-medium tabular-nums text-ink">{Math.round(value)}</span>}
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-full bg-paper-3"
        style={{ height }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: inView ? `${pct}%` : '0%',
            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, white), ${color})`,
            transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}
