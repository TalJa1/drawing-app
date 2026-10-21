import { cn } from '@/lib/utils'
import { useSvgId } from '@/lib/hooks'

/* Hand-painted brush-stroke SVGs. Paths are drawn as filled ribbons with
   ragged ends so they read as real paint rather than vector lines. */

const STROKES = [
  'M4 22c40-9 92-15 150-14 58 1 112 7 160 4 30-2 54-7 80-6 6 0 7 7 1 8-28 5-55 9-84 11-50 3-104-4-158-4-52 0-98 6-146 12-6 1-8-9-3-11z',
  'M2 18c28-6 66-11 112-12 70-2 130 9 196 6 34-1 58-6 82-5 8 1 9 9 1 10-25 4-52 9-86 10-68 3-128-6-194-4-42 1-76 5-108 10-6 1-9-12-3-15z',
  'M6 24c36-14 84-18 138-17 62 0 104 10 168 8 30-1 50-5 76-6 7 0 9 8 2 10-30 6-54 8-80 9-62 2-110-7-168-6-48 0-90 5-132 12-7 1-10-7-4-10z',
]

export function BrushUnderline({
  color = 'var(--saffron)',
  variant = 0,
  className,
  animate = true,
}: {
  color?: string
  variant?: 0 | 1 | 2
  className?: string
  animate?: boolean
}) {
  const clip = useSvgId('bu')
  return (
    <svg
      viewBox="0 0 400 36"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('pointer-events-none absolute -bottom-1 left-[-4%] h-[0.42em] w-[108%] -z-10', className)}
    >
      <defs>
        <clipPath id={clip}>
          <rect
            x="0"
            y="0"
            height="36"
            width="400"
            style={animate ? { animation: 'bu-reveal 0.9s var(--ease-ink) 0.2s both' } : undefined}
          />
        </clipPath>
      </defs>
      <path d={STROKES[variant]} fill={color} opacity="0.85" clipPath={`url(#${clip})`} filter="url(#rough)" />
      <style>{`@keyframes bu-reveal{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
    </svg>
  )
}

/** Wrap a word in a heading to give it a painted underline. */
export function Highlight({ children, color, variant = 0 }: { children: React.ReactNode; color?: string; variant?: 0 | 1 | 2 }) {
  return (
    <span className="relative isolate inline-block whitespace-nowrap">
      {children}
      <BrushUnderline color={color} variant={variant} />
    </span>
  )
}

export function BrushDivider({ className, color = 'var(--ink)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden className={cn('h-6 w-full', className)}>
      <path
        d="M0 22c80-8 160-12 260-10 120 3 200 14 330 12 140-2 220-16 360-14 100 1 170 8 250 6v6c-80 4-150-1-250-2-140-1-220 13-360 15-130 2-210-9-330-12C160 14 80 20 0 30z"
        fill={color}
        opacity="0.14"
        filter="url(#rough)"
      />
      <circle cx="1130" cy="12" r="3" fill="var(--vermilion)" opacity="0.7" />
      <circle cx="1150" cy="20" r="1.6" fill="var(--vermilion)" opacity="0.6" />
      <circle cx="70" cy="8" r="2" fill="var(--cerulean)" opacity="0.5" />
    </svg>
  )
}

/** A chunky single brush stroke shape, e.g. as a background swash behind content. */
export function BrushSwash({ className, color = 'var(--saffron)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 600 200" aria-hidden className={cn('pointer-events-none', className)}>
      <path
        d="M22 120c40-58 120-88 230-92 120-4 230 20 310 60 18 9 16 30-6 30-90-6-170-38-300-34-96 3-160 30-220 64-20 11-28-12-14-28z"
        fill={color}
        filter="url(#rough)"
      />
    </svg>
  )
}

/** Animated self-drawing scribble used in the hero. */
export function DrawnStroke({ className, color = 'var(--vermilion)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 520 120" aria-hidden className={cn('draw-in pointer-events-none', className)}>
      <path
        d="M10 80c50-40 90-58 130-40s30 50 70 46 60-60 110-64 80 30 120 34 50-12 70-22"
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ ['--len' as string]: 760, ['--delay' as string]: '0.4s' }}
        filter="url(#rough)"
      />
    </svg>
  )
}
