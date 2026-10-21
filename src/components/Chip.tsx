import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Toggleable filter chip with a painted "selected" blob. */
export function Chip({
  selected,
  children,
  icon,
  className,
  layoutGroup,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean
  icon?: ReactNode
  layoutGroup?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        selected
          ? 'border-transparent text-paper'
          : 'border-line-strong text-ink-soft hover:border-ink/50 hover:text-ink',
        className,
      )}
      {...rest}
    >
      {selected && (
        <motion.span
          layoutId={layoutGroup ? `chip-${layoutGroup}` : undefined}
          className="absolute inset-0 -z-0 rounded-full bg-ink"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">
        {icon}
        {children}
      </span>
    </button>
  )
}

const pillTones = {
  neutral: 'bg-ink/[0.06] text-ink-soft',
  vermilion: 'bg-vermilion/15 text-accent-ink',
  viridian: 'bg-viridian/15 text-viridian dark:text-[#5fc7a6]',
  cerulean: 'bg-cerulean/15 text-cerulean dark:text-[#7cb6e6]',
  saffron: 'bg-saffron/20 text-[#8a5a10] dark:text-saffron',
  rose: 'bg-rose/15 text-rose dark:text-[#ef89ab]',
  gold: 'bg-gold/20 text-gold-deep dark:text-gold',
  ultramarine: 'bg-ultramarine/12 text-ultramarine dark:text-[#9ea2f0]',
} as const

export type PillTone = keyof typeof pillTones

/** Static label / badge. */
export function Pill({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode
  tone?: PillTone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        pillTones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Difficulty shown as paint dots ●●○○ */
export function DifficultyDots({ level, label }: { level: 1 | 2 | 3 | 4; label: string }) {
  const colours = ['var(--viridian)', 'var(--saffron)', 'var(--vermilion)', 'var(--ultramarine)']
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={label}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full border"
          style={{
            background: i < level ? colours[level - 1] : 'transparent',
            borderColor: i < level ? colours[level - 1] : 'var(--line-strong)',
          }}
        />
      ))}
    </span>
  )
}
