import { cn } from '@/lib/utils'

export interface WashSpec {
  color: string
  size: string
  top?: string
  left?: string
  right?: string
  bottom?: string
  delay?: number
}

const DEFAULT: WashSpec[] = [
  { color: 'var(--saffron)', size: '42vmax', top: '-12%', left: '-10%' },
  { color: 'var(--rose)', size: '30vmax', top: '30%', right: '-12%', delay: -8 },
  { color: 'var(--cerulean)', size: '34vmax', bottom: '-18%', left: '20%', delay: -15 },
]

/** Slowly drifting watercolour blobs for page backgrounds. */
export function Washes({ washes = DEFAULT, className }: { washes?: WashSpec[]; className?: string }) {
  return (
    // fixed (viewport-based) height so percentage positions don't move as the page grows (no layout shift)
    <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-[140vh] overflow-hidden', className)}>
      {washes.map((w, i) => (
        <span
          key={i}
          className="wash"
          style={{
            width: w.size,
            height: w.size,
            top: w.top,
            left: w.left,
            right: w.right,
            bottom: w.bottom,
            background: `radial-gradient(closest-side, ${w.color}, transparent)`,
            animationDelay: `${w.delay ?? 0}s`,
          }}
        />
      ))}
    </div>
  )
}
