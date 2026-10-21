import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { preloadRoute } from '@/app/routes'

export type ButtonVariant = 'ink' | 'pigment' | 'ghost' | 'gold' | 'outline' | 'paper'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full font-medium transition-[transform,box-shadow,background-color,color] duration-200 ease-[var(--ease-ink)] active:translate-y-px active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'

const variants: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-paper shadow-[0_2px_0_rgb(0_0_0/0.25),0_10px_24px_-12px_rgb(0_0_0/0.5)] hover:shadow-[0_3px_0_rgb(0_0_0/0.25),0_16px_30px_-12px_rgb(0_0_0/0.55)]',
  pigment:
    'bg-vermilion-deep text-ivory shadow-[0_2px_0_#8a2a10,0_12px_26px_-12px_rgb(188_62_27/0.7)] hover:bg-vermilion dark:text-inkwell dark:bg-vermilion',
  gold: 'bg-gold text-inkwell shadow-[0_2px_0_#9c7c17,0_12px_26px_-12px_rgb(212_175_55/0.8)] hover:brightness-105',
  ghost: 'text-ink hover:bg-ink/5 dark:hover:bg-ink/10',
  outline: 'border border-line-strong text-ink hover:border-ink hover:bg-ink/[0.03]',
  paper: 'paper border border-line text-ink shadow-paper hover:shadow-lift',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-base',
}

const bleedColour: Record<ButtonVariant, string> = {
  ink: 'var(--saffron)',
  pigment: 'var(--saffron)',
  gold: '#fff4c4',
  ghost: 'var(--saffron)',
  outline: 'var(--saffron)',
  paper: 'var(--rose)',
}

interface Bleed {
  id: number
  x: number
  y: number
  size: number
}

function useInkBleed() {
  const [bleeds, setBleeds] = useState<Bleed[]>([])
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2.2
    const id = e.timeStamp
    setBleeds((b) => [...b.slice(-2), { id, x: e.clientX - rect.left, y: e.clientY - rect.top, size }])
    window.setTimeout(() => setBleeds((b) => b.filter((x) => x.id !== id)), 700)
  }
  return { bleeds, onPointerDown }
}

function Bleeds({ bleeds, color }: { bleeds: Bleed[]; color: string }) {
  return (
    <>
      {bleeds.map((b) => (
        <span
          key={b.id}
          aria-hidden
          className="ink-bleed"
          style={{ left: b.x, top: b.y, width: b.size, height: b.size, background: color, opacity: 0.35 }}
        />
      ))}
    </>
  )
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  className?: string
  children?: ReactNode
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ink', size = 'md', icon, iconRight, className, children, onPointerDown, ...rest },
  ref,
) {
  const { bleeds, onPointerDown: bleed } = useInkBleed()
  return (
    <button
      ref={ref}
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      onPointerDown={(e) => {
        bleed(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      <Bleeds bleeds={bleeds} color={bleedColour[variant]} />
      {icon}
      {children && <span className="relative">{children}</span>}
      {iconRight}
    </button>
  )
})

export type ButtonLinkProps = CommonProps & LinkProps

export function ButtonLink({
  variant = 'ink',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  to,
  onMouseEnter,
  onPointerDown,
  ...rest
}: ButtonLinkProps) {
  const { bleeds, onPointerDown: bleed } = useInkBleed()
  return (
    <Link
      to={to}
      className={cn(base, variants[variant], sizes[size], className)}
      onMouseEnter={(e) => {
        if (typeof to === 'string') preloadRoute(to)
        onMouseEnter?.(e)
      }}
      onPointerDown={(e) => {
        bleed(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      <Bleeds bleeds={bleeds} color={bleedColour[variant]} />
      {icon}
      {children && <span className="relative">{children}</span>}
      {iconRight}
    </Link>
  )
}
