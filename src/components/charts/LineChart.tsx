import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface LineSeries {
  id: string
  label: string
  color: string
  /** dash pattern = secondary encoding so identity is never colour-alone */
  dash?: string
  values: number[]
}

/**
 * Multi-series line chart on one 0–100 axis. Thin 2px lines, recessive grid,
 * legend + direct end labels, crosshair tooltip on hover/focus, table fallback.
 */
export function LineChart({
  series,
  labels,
  height = 260,
  className,
  title,
  showTable = false,
}: {
  series: LineSeries[]
  /** x-axis labels (dates) */
  labels: string[]
  height?: number
  className?: string
  title: string
  showTable?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const m = { t: 16, r: 92, b: 30, l: 34 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const n = labels.length
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => m.t + ih - (v / 100) * ih

  const paths = series.map((s) => {
    if (!s.values.length) return ''
    let d = `M${x(0)},${y(s.values[0])}`
    for (let i = 1; i < s.values.length; i++) {
      // gentle monotone-ish smoothing
      const x0 = x(i - 1)
      const x1 = x(i)
      const cx = (x0 + x1) / 2
      d += ` C${cx},${y(s.values[i - 1])} ${cx},${y(s.values[i])} ${x1},${y(s.values[i])}`
    }
    return d
  })

  // direct end labels, nudged apart so they never collide
  const ends = series
    .map((s) => ({ s, yy: y(s.values[s.values.length - 1] ?? 0) }))
    .sort((a, b) => a.yy - b.yy)
  for (let i = 1; i < ends.length; i++)
    if (ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14

  const onMove = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((clientX - r.left) / r.width) * W
    const i = Math.round(((px - m.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const tickEvery = Math.max(1, Math.ceil(n / 6))

  return (
    <figure className={cn('relative', className)}>
      <div
        className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-soft"
        aria-hidden
      >
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2">
            <svg width="22" height="8">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke={s.color}
                strokeWidth="2.5"
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y overflow-visible"
        role="img"
        aria-label={title}
        tabIndex={0}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1))
          if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1))
        }}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" />
            <text
              x={m.l - 8}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-faint text-[10px] tabular-nums"
            >
              {v}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % tickEvery === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[10px]"
            >
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => (
          <motion.path
            key={s.id}
            d={paths[si]}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: si * 0.15 }}
          />
        ))}
        {ends.map(({ s, yy }) => (
          <text
            key={s.id}
            x={m.l + iw + 10}
            y={yy}
            dominantBaseline="middle"
            className="fill-ink-soft text-[11px] font-medium"
          >
            {s.label}{' '}
            <tspan className="fill-ink font-semibold tabular-nums">
              {s.values[s.values.length - 1]}
            </tspan>
          </text>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={m.t}
              y2={m.t + ih}
              stroke="var(--ink-faint)"
              strokeDasharray="3 3"
            />
            {series.map((s) => (
              <circle
                key={s.id}
                cx={x(hover)}
                cy={y(s.values[hover])}
                r={5}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-8 z-10 min-w-[150px] rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-lift"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${x(hover) > W * 0.6 ? '-110%' : '12px'})`,
          }}
        >
          <p className="mb-1 font-semibold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.id} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums">{s.values[hover]}</span>
            </p>
          ))}
        </div>
      )}
      <table className={showTable ? 'mt-4 w-full text-left text-sm' : 'sr-only'}>
        <caption className={showTable ? 'sr-only' : undefined}>{title}</caption>
        <thead>
          <tr className="border-b border-line text-ink-faint">
            <th scope="col" className="py-1.5 font-medium" />
            {series.map((s) => (
              <th key={s.id} scope="col" className="py-1.5 font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={i} className="border-b border-line/60">
              <th scope="row" className="py-1.5 font-normal text-ink-soft">
                {l}
              </th>
              {series.map((s) => (
                <td key={s.id} className="py-1.5 tabular-nums">
                  {s.values[i]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
