import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface RadarAxis {
  label: string
  value: number
}

/**
 * Single-series radar (0–100). One hue, 2px outline, ≥8px markers with
 * hover tooltips; an sr-only table carries the same data.
 */
export function RadarChart({
  axes,
  size = 300,
  color = 'var(--viz-2)',
  className,
  title,
}: {
  axes: RadarAxis[]
  size?: number
  color?: string
  className?: string
  title: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const pad = 54
  const r = size / 2 - pad
  const cx = size / 2
  const cy = size / 2
  const n = axes.length
  const pt = (i: number, v: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return [cx + Math.cos(a) * r * (v / 100), cy + Math.sin(a) * r * (v / 100)] as const
  }
  const poly = axes.map((ax, i) => pt(i, ax.value).join(',')).join(' ')

  return (
    <figure className={cn('relative', className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible" role="img" aria-label={title}>
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => pt(i, ring).join(',')).join(' ')}
            fill="none"
            stroke="var(--viz-grid)"
            strokeWidth={ring === 100 ? 1.5 : 1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--viz-grid)" />
        })}
        <motion.polygon
          points={poly}
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, ax.value)
          const [lx, ly] = pt(i, 128)
          const anchor = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end'
          return (
            <g key={ax.label}>
              <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="fill-ink-soft text-[11px] font-medium">
                {ax.label}
              </text>
              {/* generous invisible hit target */}
              <circle
                cx={x}
                cy={y}
                r={14}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${ax.label}: ${ax.value}`}
              />
              <circle cx={x} cy={y} r={hover === i ? 6 : 4.5} fill={color} stroke="var(--card)" strokeWidth={2} pointerEvents="none" />
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lift"
          style={{ left: `${(pt(hover, axes[hover].value)[0] / size) * 100}%`, top: `${(pt(hover, axes[hover].value)[1] / size) * 100}%` }}
          role="status"
        >
          {axes[hover].label} <strong className="ml-1 tabular-nums">{axes[hover].value}</strong>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {axes.map((a) => (
            <tr key={a.label}>
              <th scope="row">{a.label}</th>
              <td>{a.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
