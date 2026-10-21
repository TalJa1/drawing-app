import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ---------- Slider ---------- */

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  format,
  className,
  accent = 'var(--vermilion)',
  hideLabel,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  className?: string
  accent?: string
  hideLabel?: boolean
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-center justify-between text-xs font-medium text-ink-soft', hideLabel && 'sr-only')}>
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums text-ink">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="art-range"
        style={{ '--pct': `${pct}%`, '--accent': accent } as React.CSSProperties}
      />
    </div>
  )
}

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-ink-faint">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-viridian bg-viridian' : 'border-line-strong bg-paper-3',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </div>
  )
}

/* ---------- Select ---------- */

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hideLabel?: boolean }>(
  function Select({ label, hideLabel, className, children, id, ...rest }, ref) {
    const autoId = useId()
    const sid = id ?? autoId
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={sid} className={cn('text-xs font-medium text-ink-soft', hideLabel && 'sr-only')}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={sid}
            className="h-10 w-full appearance-none rounded-full border border-line-strong bg-card pl-4 pr-9 text-sm text-ink hover:border-ink/50"
            {...rest}
          >
            {children}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        </div>
      </div>
    )
  },
)

/* ---------- Text input ---------- */

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
>(function TextField({ label, error, hint, className, id, ...rest }, ref) {
  const autoId = useId()
  const fid = id ?? autoId
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={fid} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn(
          'h-12 rounded-2xl border bg-card px-4 text-ink placeholder:text-ink-faint/70 transition-colors',
          error ? 'border-vermilion' : 'border-line-strong hover:border-ink/40 focus:border-ink',
        )}
        {...rest}
      />
      {error ? (
        <p id={`${fid}-err`} className="text-sm text-accent-ink">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${fid}-hint`} className="text-sm text-ink-faint">
            {hint}
          </p>
        )
      )}
    </div>
  )
})

/* ---------- Search bar ---------- */

export function SearchBar({
  value,
  onChange,
  placeholder,
  label,
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label: string
  className?: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('relative', className)}>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-line-strong bg-card pl-11 pr-11 text-ink shadow-paper placeholder:text-ink-faint/80 hover:border-ink/40 focus:border-ink [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('common.clear')}
          className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:bg-ink/5 hover:text-ink"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
