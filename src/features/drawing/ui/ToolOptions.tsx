import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useStudio } from '@/store/studio'
import type { Symmetry } from '../engine/types'
import { toolOptions } from '../tools'

function MiniSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="flex min-w-[150px] items-center gap-2 text-xs font-medium text-ink-soft">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="art-range w-24"
        style={{ '--pct': `${pct}%`, '--accent': 'var(--ink)' } as React.CSSProperties}
      />
      <span className="w-10 shrink-0 tabular-nums text-ink">{format ? format(value) : value}</span>
    </label>
  )
}

const SYMS: Symmetry[] = ['none', 'vertical', 'horizontal', 'quad', 'radial6', 'radial8']

/** Context bar with options for the active tool. */
export function ToolOptions({ className }: { className?: string }) {
  const { t } = useTranslation()
  const s = useStudio()
  const opts = toolOptions(s.tool)
  const ts = s.settings[s.tool]
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const any = Object.values(opts).some(Boolean)

  return (
    <div
      className={cn('no-scrollbar flex items-center gap-5 overflow-x-auto px-1 py-1', className)}
      role="group"
      aria-label={t('studio.toolOptions')}
      data-tour="options"
    >
      <span className="shrink-0 font-display text-sm italic text-ink">{t(`studio.tools.${s.tool}`)}</span>
      {!any && <span className="text-xs text-ink-faint">{t(`studio.toolHints.${s.tool}`, { defaultValue: '' })}</span>}
      {opts.size && (
        <MiniSlider label={t('studio.size')} value={ts.size} min={1} max={s.tool === 'airbrush' || s.tool === 'watercolour' ? 200 : 120} onChange={(v) => s.setToolSetting(s.tool, { size: v })} format={(v) => `${v}px`} />
      )}
      {opts.opacity && (
        <MiniSlider label={t('studio.opacity')} value={ts.opacity} min={0.05} max={1} step={0.01} onChange={(v) => s.setToolSetting(s.tool, { opacity: v })} format={pct} />
      )}
      {opts.hardness && (
        <MiniSlider label={t('studio.hardness')} value={ts.hardness} min={0.05} max={1} step={0.01} onChange={(v) => s.setToolSetting(s.tool, { hardness: v })} format={pct} />
      )}
      {opts.smoothing && (
        <MiniSlider label={t('studio.smoothing')} value={s.smoothing} min={0} max={1} step={0.01} onChange={(v) => s.set({ smoothing: v })} format={pct} />
      )}
      {opts.tolerance && (
        <MiniSlider label={t('studio.tolerance')} value={s.tolerance} min={0} max={80} onChange={(v) => s.set({ tolerance: v })} format={(v) => `${v}`} />
      )}
      {opts.symmetry && (
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
          {t('studio.symmetry')}
          <select
            value={s.symmetry}
            onChange={(e) => s.set({ symmetry: e.target.value as Symmetry })}
            className="h-8 rounded-full border border-line-strong bg-card px-3 text-xs text-ink"
          >
            {SYMS.map((m) => (
              <option key={m} value={m}>
                {t(`studio.symmetryModes.${m}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {opts.symmetry && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={s.pressure} onChange={(e) => s.set({ pressure: e.target.checked })} className="h-4 w-4 accent-[var(--vermilion)]" />
          {t('studio.pressure')}
        </label>
      )}
      {opts.shapeFill && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={s.shapeFill} onChange={(e) => s.set({ shapeFill: e.target.checked })} className="h-4 w-4 accent-[var(--vermilion)]" />
          {t('studio.shapeFill')}
        </label>
      )}
      {opts.sampleAll && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={s.sampleAllLayers} onChange={(e) => s.set({ sampleAllLayers: e.target.checked })} className="h-4 w-4 accent-[var(--vermilion)]" />
          {t('studio.sampleAll')}
        </label>
      )}
    </div>
  )
}
