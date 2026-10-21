import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

/** Accessible tab list (arrow keys, Home/End) with a sliding brush underline. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
}) {
  const group = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = {
      ArrowRight: (i + 1) % items.length,
      ArrowLeft: (i - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }
    const next = moves[e.key]
    if (next === undefined) return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('no-scrollbar relative flex gap-1 overflow-x-auto', className)}
    >
      {items.map((it, i) => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            id={`${group}-${it.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 rounded-full font-medium transition-colors',
              size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[0.95rem]',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${group}`}
                className="absolute inset-x-2 bottom-0.5 h-[5px] rounded-full bg-saffron"
                style={{ filter: 'url(#rough)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            {it.icon}
            <span className="relative">{it.label}</span>
            {it.count !== undefined && (
              <span className="relative rounded-full bg-ink/[0.07] px-1.5 text-xs tabular-nums text-ink-soft">
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
