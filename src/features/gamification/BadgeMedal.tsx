import { Lock } from 'lucide-react'
import type { Badge } from '@/types'
import { cn } from '@/lib/utils'
import { BadgeIcon } from '@/components/BadgeIcon'

/** A foil medal; rarity decides the metal, legendary gets a holographic sheen. */
export function BadgeMedal({
  badge,
  unlocked,
  size = 88,
  className,
}: {
  badge: Badge
  unlocked: boolean
  size?: number
  className?: string
}) {
  const hidden = badge.secret && !unlocked
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        unlocked ? `foil-${badge.rarity}` : 'bg-paper-3',
        unlocked && badge.rarity === 'legendary' && 'holo',
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow: unlocked
          ? '0 10px 24px -10px rgb(0 0 0 / 0.5), inset 0 2px 0 rgb(255 255 255 / 0.5), inset 0 -3px 0 rgb(0 0 0 / 0.18)'
          : 'inset 0 2px 6px rgb(0 0 0 / 0.12)',
      }}
      aria-hidden
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full',
          unlocked ? 'bg-[#1b1a17]/85 text-[#f6f1e7]' : 'border-2 border-dashed border-line-strong text-ink-faint',
        )}
        style={{ width: size * 0.68, height: size * 0.68 }}
      >
        {hidden ? (
          <span className="font-display text-xl" style={{ fontSize: size * 0.24 }}>
            ???
          </span>
        ) : unlocked ? (
          <BadgeIcon name={badge.icon} size={size * 0.32} />
        ) : (
          <span className="relative">
            <BadgeIcon name={badge.icon} size={size * 0.3} className="opacity-50" />
            <Lock size={size * 0.14} className="absolute -bottom-1 -right-2" />
          </span>
        )}
      </span>
    </span>
  )
}
