import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { useSession } from '@/store/session'
import { levelProgress } from '@/features/gamification/rules'
import { Avatar } from './Avatar'

export function StreakFlame({
  count,
  size = 22,
  className,
  showCount = true,
}: {
  count: number
  size?: number
  className?: string
  showCount?: boolean
}) {
  const { t } = useTranslation()
  const lit = count > 0
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', className)}
      role="img"
      aria-label={t('gamification.streakDays', { count })}
    >
      <svg viewBox="0 0 24 30" width={size * 0.8} height={size} className={cn(lit && 'flame-flicker')} aria-hidden>
        <path
          d="M12 1c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 3-8 0 3 1 5 3 5-1-4 0-9 1-12z"
          fill={lit ? 'url(#flame-g)' : 'var(--paper-3)'}
          stroke={lit ? 'none' : 'var(--line-strong)'}
        />
        <path d="M12 14c1 3 4 4 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2-1-2 0-4 0-5z" fill={lit ? '#FFE7A3' : 'transparent'} />
        <defs>
          <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#C7431F" />
            <stop offset="0.6" stopColor="#E4572E" />
            <stop offset="1" stopColor="#F2A93B" />
          </linearGradient>
        </defs>
      </svg>
      {showCount && <span className={lit ? 'text-ink' : 'text-ink-faint'}>{count}</span>}
    </span>
  )
}

/** Avatar with an XP ring around it showing progress to the next level. */
export function XPRing({ size = 44, className }: { size?: number; className?: string }) {
  const { t } = useTranslation()
  const xp = useProgress((s) => s.xp)
  const user = useSession((s) => s.user)
  const { level, ratio } = levelProgress(xp)
  const stroke = Math.max(3, size / 14)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('gamification.levelProgress', { level, pct: Math.round(ratio * 100) })}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#xp-g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <defs>
          <linearGradient id="xp-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F2A93B" />
            <stop offset="1" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
      </svg>
      <Avatar seed={user.avatarSeed} size={size - stroke * 2 - 4} />
      <span className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 text-[10px] font-bold leading-4 text-paper ring-2 ring-paper">
        {level}
      </span>
    </span>
  )
}

export function XPBar({ className }: { className?: string }) {
  const { t } = useTranslation()
  const xp = useProgress((s) => s.xp)
  const { level, current, needed, ratio } = levelProgress(xp)
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{t('gamification.level', { level })}</span>
        <span className="tabular-nums text-ink-faint">
          {current} / {needed} XP
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-saffron to-gold"
          style={{ width: `${ratio * 100}%`, transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
    </div>
  )
}
