import { useMemo } from 'react'
import { seeded, pick } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useSvgId } from '@/lib/hooks'

const PIGMENTS = ['#E4572E', '#F2A93B', '#2E8B6F', '#2F80C4', '#3A3FA8', '#C93C6B', '#C98B2B', '#4A3426']
const GROUNDS = ['#F6F1E7', '#EFE2C8', '#E9D8D0', '#D9E4DE', '#DCE2EE', '#1B1A17']

/** Generated abstract-portrait avatar (deterministic per seed). */
export function Avatar({
  seed,
  size = 40,
  className,
  ring,
  label,
}: {
  seed: string
  size?: number
  className?: string
  ring?: boolean
  label?: string
}) {
  const clip = useSvgId('av')
  const art = useMemo(() => {
    const rng = seeded(seed)
    const ground = pick(rng, GROUNDS)
    const dark = ground === '#1B1A17'
    const face = pick(rng, PIGMENTS)
    const accent = pick(rng, PIGMENTS.filter((p) => p !== face))
    const accent2 = pick(rng, PIGMENTS.filter((p) => p !== face && p !== accent))
    return {
      ground,
      face,
      accent,
      accent2,
      ink: dark ? '#F6F1E7' : '#1B1A17',
      hat: rng() > 0.55,
      eyeShift: rng() * 6 - 3,
      mouth: Math.floor(rng() * 3),
      rot: rng() * 30 - 15,
      cheek: rng() > 0.5,
    }
  }, [seed])

  return (
    <span
      className={cn('inline-block shrink-0 overflow-hidden rounded-full', ring && 'ring-2 ring-paper', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <clipPath id={clip}>
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="100" height="100" fill={art.ground} />
          <circle cx="78" cy="22" r="20" fill={art.accent2} opacity="0.55" />
          <g transform={`rotate(${art.rot} 50 55)`}>
            <path d="M18 104c2-22 14-34 32-34s30 12 32 34z" fill={art.accent} />
            <ellipse cx="50" cy="48" rx="22" ry="25" fill={art.face} />
            <path d="M50 23a22 25 0 0 1 0 50z" fill="#000" opacity="0.12" />
            {art.hat && <path d="M26 34c4-14 44-18 50-2-6-2-44-6-50 2z" fill={art.ink} />}
            {art.hat && <circle cx="66" cy="22" r="3" fill={art.ink} />}
            <circle cx={41 + art.eyeShift} cy="46" r="3" fill={art.ink} />
            <circle cx={58 + art.eyeShift} cy="46" r="3" fill={art.ink} />
            {art.cheek && <circle cx="38" cy="56" r="4" fill="#fff" opacity="0.28" />}
            {art.mouth === 0 && <path d="M43 59q7 6 14 0" fill="none" stroke={art.ink} strokeWidth="2.5" strokeLinecap="round" />}
            {art.mouth === 1 && <circle cx="50" cy="60" r="3" fill={art.ink} />}
            {art.mouth === 2 && <path d="M44 60h12" stroke={art.ink} strokeWidth="2.5" strokeLinecap="round" />}
          </g>
        </g>
      </svg>
    </span>
  )
}
