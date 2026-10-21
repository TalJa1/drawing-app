import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ColourWheel } from '@/components/ColourWheel'
import { hexToRgb, normalizeHex, rgbToHex } from '@/lib/color'
import { cn } from '@/lib/utils'
import { useL } from '@/i18n/useL'
import { PALETTES } from '@/mocks/palettes'
import { useStudio } from '@/store/studio'

function Swatch({ hex, active, onPick, label }: { hex: string; active?: boolean; onPick: (h: string) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onPick(hex)}
      aria-label={label ?? hex}
      title={hex}
      className={cn(
        'h-7 w-7 shrink-0 rounded-full border border-black/10 transition-transform hover:scale-110',
        active && 'ring-2 ring-ink ring-offset-2 ring-offset-card',
      )}
      style={{ background: hex }}
    />
  )
}

export function ColourPanel({ suggested }: { suggested?: string[] }) {
  const { t } = useTranslation()
  const L = useL()
  const color = useStudio((s) => s.color)
  const recent = useStudio((s) => s.recent)
  const setColor = useStudio((s) => s.setColor)
  const commit = useStudio((s) => s.commitColor)
  const pending = useStudio((s) => s.pendingPalette)
  const setPending = useStudio((s) => s.setPendingPalette)
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const rgb = hexToRgb(color)

  const setChannel = (ch: 'r' | 'g' | 'b', v: number) => {
    const next = rgbToHex({ ...rgb, [ch]: Math.max(0, Math.min(255, v || 0)) })
    commit(next)
  }

  return (
    <div className="flex flex-col gap-5" data-tour="colour">
      <div className="flex items-center justify-center pt-1">
        <ColourWheel value={color} onChange={setColor} onCommit={commit} size={220} />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 shrink-0 rounded-2xl border border-black/10 shadow-inner" style={{ background: color }} aria-hidden />
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          {t('colour.hex')}
          <input
            value={hexDraft ?? color.toUpperCase()}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => {
              const n = hexDraft && normalizeHex(hexDraft)
              if (n) commit(n)
              setHexDraft(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-9 rounded-xl border border-line-strong bg-card px-3 font-mono text-sm normal-case tracking-normal text-ink"
            spellCheck={false}
          />
        </label>
        {(['r', 'g', 'b'] as const).map((ch) => (
          <label key={ch} className="flex w-14 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {ch}
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[ch]}
              onChange={(e) => setChannel(ch, Number(e.target.value))}
              className="h-9 rounded-xl border border-line-strong bg-card px-2 text-sm tabular-nums text-ink"
            />
          </label>
        ))}
      </div>

      {pending && (
        <section className="rounded-2xl border border-gold/50 bg-gold/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-deep dark:text-gold">{t('colour.fromElsewhere', { name: pending.name })}</h3>
            <button type="button" aria-label={t('common.dismiss')} onClick={() => setPending(null)} className="text-ink-faint hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.colors.map((c) => (
              <Swatch key={c} hex={c} active={c.toLowerCase() === color} onPick={commit} />
            ))}
          </div>
        </section>
      )}

      {suggested && suggested.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">{t('colour.suggested')}</h3>
          <div className="flex flex-wrap gap-2">
            {suggested.map((c) => (
              <Swatch key={c} hex={c.toLowerCase()} active={c.toLowerCase() === color} onPick={commit} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="eyebrow mb-2">{t('colour.recent')}</h3>
        <div className="flex flex-wrap gap-2">
          {recent.map((c) => (
            <Swatch key={c} hex={c} active={c === color} onPick={commit} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-2">{t('colour.palettes')}</h3>
        <ul className="flex flex-col gap-2.5">
          {PALETTES.map((p) => (
            <li key={p.id}>
              <p className="mb-1 text-xs font-medium text-ink-soft">{L(p.name)}</p>
              <div className="flex overflow-hidden rounded-xl border border-black/10">
                {p.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => commit(c.toLowerCase())}
                    aria-label={`${L(p.name)} ${c}`}
                    title={c}
                    className={cn('h-8 flex-1 transition-[flex] hover:flex-[1.6]', c.toLowerCase() === color && 'outline outline-2 -outline-offset-2 outline-white')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
