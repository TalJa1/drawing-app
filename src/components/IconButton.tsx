import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: ReactNode
  active?: boolean
  shortcut?: string
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'plain' | 'paper' | 'ink'
  noTooltip?: boolean
}

const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    active,
    shortcut,
    tooltipSide = 'bottom',
    size = 'md',
    variant = 'plain',
    noTooltip,
    className,
    ...rest
  },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,box-shadow] duration-150 active:scale-95 disabled:opacity-40',
        sizes[size],
        variant === 'plain' && 'text-ink-soft hover:bg-ink/[0.06] hover:text-ink',
        variant === 'paper' && 'paper border border-line text-ink shadow-paper hover:shadow-lift',
        variant === 'ink' && 'bg-ink text-paper hover:opacity-90',
        active && 'bg-ink text-paper shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)] hover:bg-ink hover:text-paper',
        noTooltip && className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
  if (noTooltip) return btn
  return (
    // layout classes (visibility, positioning) belong on the outer wrapper
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide} className={className}>
      {btn}
    </Tooltip>
  )
})
