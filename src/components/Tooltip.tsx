import { useId, useState, type ReactElement, type ReactNode } from 'react'
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
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-lift transition-[opacity,transform] duration-150',
          pos[side],
          open ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        {label}
        {shortcut && <kbd className="rounded border border-paper/30 px-1 font-mono text-[10px] text-paper/80">{shortcut}</kbd>}
      </span>
    </span>
  )
}
