import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--ink)" />
      <path d="M14 44c6-14 14-26 30-30-2 9-9 21-22 28" fill="none" stroke="#F2A93B" strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="44" r="7" fill="#E4572E" />
      <circle cx="20" cy="20" r="3.5" fill="#2F80C4" />
    </svg>
  )
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2.5', className)} aria-label={t('nav.homeAria')}>
      <span className="transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
        <LogoMark />
      </span>
      {!compact && (
        <span className="font-display text-[1.35rem] leading-none tracking-tight">
          Art <em className="font-light italic text-accent-ink">Spark</em>
        </span>
      )}
    </Link>
  )
}
