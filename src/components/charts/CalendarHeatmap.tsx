import { useMemo, useState } from 'react'
import { addDays, dayKey, parseDayKey } from '@/lib/date'
import { cn } from '@/lib/utils'

const cell = 14
const gap = 3
const STEPS = ['var(--seq-0)', 'var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)']

/**
 * GitHub-style activity calendar (single teal ramp, near-zero recedes to the surface).
 * Cells have hover/focus tooltips; a legend shows the scale.
 */
export function CalendarHeatmap({
  activity,
  weeks = 20,
  title,
  locale,
  lessLabel,
  moreLabel,
  countLabel,
  frozen = [],
  className,
}: {
  activity: Record<string, number>
  weeks?: number
  title: string
  locale: string
  lessLabel: string
  moreLabel: string
  countLabel: (n: number) => string
  frozen?: string[]
  className?: string
}) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null)
  const { cols, monthLabels } = useMemo(() => {
    const today = dayKey()
    const dow = (parseDayKey(today).getDay() + 6) % 7 // Monday = 0
    const start = addDays(today, -(weeks * 7 - 1) - (6 - dow))
    const cols: string[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: string[] = []
      for (let d = 0; d < 7; d++) col.push(addDays(start, w * 7 + d))
      cols.push(col)
    }
    const raw = cols.map((col, i) => {
      const first = parseDayKey(col[0])
      const prev = i > 0 ? parseDayKey(cols[i - 1][0]) : null
      return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString(locale, { month: 'short' }) : ''
    })
    // A label is about 5.8 px per character at 10 px; two labels closer than that would print on top of each
    // other (the first column often starts a month that is only a few days long). Keep the later one then.
    const colsNeeded = (m: string) => Math.ceil((m.length * 5.8 + 6) / (cell + gap))
    const monthLabels = [...raw]
    let last = -1
    raw.forEach((m, i) => {
      if (!m) return
      if (last >= 0 && i - last < colsNeeded(raw[last])) {
        if (last === 0)
          monthLabels[last] = '' // the partial first month gives way
        else {
          monthLabels[i] = ''
          return
        }
      }
      last = i
    })
    return { cols, monthLabels }
  }, [weeks, locale])

  const today = dayKey()
  // Monday, Wednesday and Friday in the page's language ("T2", "T4", "T6" in Vietnamese; "M", "W", "F" in English).
  const weekdayLabels = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((i) =>
        i % 2 === 0 && i < 5 ? new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }) : '',
      ),
    [locale],
  )
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)
  const W = cols.length * (cell + gap) + 24
  const H = 7 * (cell + gap) + 18

  return (
    <figure className={cn('relative', className)}>
      <div className="no-scrollbar overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="block">
          {monthLabels.map((m, i) =>
            m ? (
              <text key={i} x={24 + i * (cell + gap)} y={10} className="fill-ink-faint text-[10px]">
                {m}
              </text>
            ) : null,
          )}
          {weekdayLabels.map((d, i) => (
            <text key={i} x={0} y={18 + i * (cell + gap) + cell - 3} className="fill-ink-faint text-[9px]">
              {d}
            </text>
          ))}
          {cols.map((col, ci) =>
            col.map((k, di) => {
              if (k > today) return null
              const n = activity[k] ?? 0
              const isFrozen = frozen.includes(k)
              const x = 24 + ci * (cell + gap)
              const y = 16 + di * (cell + gap)
              return (
                <rect
                  key={k}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={3.5}
                  fill={isFrozen ? 'var(--cerulean)' : STEPS[level(n)]}
                  fillOpacity={isFrozen ? 0.35 : 1}
                  stroke={k === today ? 'var(--ink)' : 'none'}
                  strokeWidth={k === today ? 1.5 : 0}
                  onPointerEnter={() => setHover({ key: k, x: x + cell / 2, y })}
                  onPointerLeave={() => setHover(null)}
                />
              )
            }),
          )}
        </svg>
      </div>
      {hover && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[115%] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lift"
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{countLabel(activity[hover.key] ?? 0)}</strong> ·{' '}
          {parseDayKey(hover.key).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {cols
            .flat()
            .filter((k) => k <= today && (activity[k] ?? 0) > 0)
            .map((k) => (
              <tr key={k}>
                <th scope="row">{parseDayKey(k).toLocaleDateString(locale)}</th>
                <td>{countLabel(activity[k])}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-faint" aria-hidden>
        {lessLabel}
        {STEPS.map((s) => (
          <span key={s} className="h-3 w-3 rounded-[3px]" style={{ background: s }} />
        ))}
        {moreLabel}
      </div>
    </figure>
  )
}
