import { useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'

const pos: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Lightweight tooltip. Shows on hover and keyboard focus, hides on Escape.
 * The trigger is wrapped, and the bubble is linked with aria-describedby.
 */
export function Tooltip({
  label,
  shortcut,
  side = 'top',
  children,
  className,
}: {
  label: ReactNode
  shortcut?: string
  side?: Side
  children: ReactElement
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // The bubble is mounted while it is open and for the length of its fade-out, then removed (see below).
  const [mounted, setMounted] = useState(false)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), 170)
    return () => window.clearTimeout(timer)
  }, [open, mounted])
  const id = useId()
  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {/* Fades in and out like before, but is taken out of the page once the fade-out is done: a bubble kept in the
          DOM with opacity-0 still counts towards the page's scrollable width (on /learn at 375px it made the page 34px
          wider than the screen). */}
      {mounted && (
        <span
          role="tooltip"
          id={id}
          aria-hidden={open ? undefined : true}
          className={cn(
            open ? 'tooltip-in' : 'tooltip-out',
            'pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-lift',
            pos[side],
          )}
        >
          {label}
          {shortcut && <kbd className="rounded border border-paper/30 px-1 font-mono text-[10px] text-paper/80">{shortcut}</kbd>}
        </span>
      )}
    </span>
  )
}
