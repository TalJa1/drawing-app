import { useMemo } from 'react'
import { seeded } from '@/lib/random'
import { cn } from '@/lib/utils'

/** Procedural paint splatter: a central blob with droplets and a few drips. */
export function PaintSplatter({
  seed = 'splat',
  color = 'var(--vermilion)',
  className,
  density = 1,
}: {
  seed?: string
  color?: string
  className?: string
  density?: number
}) {
  const shapes = useMemo(() => {
    const rng = seeded(seed)
    const blob: string[] = []
    const n = 14
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const r = 34 + rng() * 22 + (i % 3 === 0 ? 14 : 0)
      blob.push(`${100 + Math.cos(a) * r},${100 + Math.sin(a) * r}`)
    }
    const drops = Array.from({ length: Math.round(18 * density) }, () => {
      const a = rng() * Math.PI * 2
      const d = 55 + rng() * 40
      return { cx: 100 + Math.cos(a) * d, cy: 100 + Math.sin(a) * d, r: 1 + rng() * 5 }
    })
    const rays = Array.from({ length: 5 }, () => {
      const a = rng() * Math.PI * 2
      const len = 50 + rng() * 40
      return {
        x1: 100 + Math.cos(a) * 30,
        y1: 100 + Math.sin(a) * 30,
        x2: 100 + Math.cos(a) * len,
        y2: 100 + Math.sin(a) * len,
        w: 3 + rng() * 5,
      }
    })
    return { blob: `M${blob.join(' L')}Z`, drops, rays }
  }, [seed, density])

  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn('pointer-events-none', className)}>
      <g fill={color} stroke={color} filter="url(#splat)">
        <path d={shapes.blob} strokeWidth="0" />
        {shapes.rays.map((r, i) => (
          <line key={i} {...r} strokeWidth={r.w} strokeLinecap="round" />
        ))}
        {shapes.drops.map((d, i) => (
          <circle key={i} {...d} strokeWidth="0" />
        ))}
      </g>
    </svg>
  )
}
