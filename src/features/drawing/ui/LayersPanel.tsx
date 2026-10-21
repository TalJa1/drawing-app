import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/IconButton'
import type { DrawingEngine } from '../engine/Engine'
import type { BlendMode, Layer } from '../engine/types'
import { useEngineVersion } from '../useEngine'

const BLENDS: BlendMode[] = ['normal', 'multiply', 'overlay', 'screen']

function Thumb({ layer, version }: { layer: Layer; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(layer.canvas, 0, 0, c.width, c.height)
  }, [layer, version])
  return <canvas ref={ref} width={56} height={42} className="checker h-[42px] w-[56px] shrink-0 rounded-md border border-line" aria-hidden />
}

export function LayersPanel({ engine }: { engine: DrawingEngine }) {
  const { t } = useTranslation()
  const version = useEngineVersion(engine)
  const [renaming, setRenaming] = useState<string | null>(null)
  const ordered = [...engine.layers].reverse()
  const active = engine.activeLayer
  const la = engine.lineart

  return (
    <div className="flex flex-col gap-4" data-tour="layers">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">{t('studio.layers.count', { count: engine.layers.length, max: 6 })}</p>
        <div className="flex gap-1">
          <IconButton size="sm" label={t('studio.layers.add')} icon={<Plus size={16} />} onClick={() => engine.addLayer(t('studio.layers.defaultName', { n: engine.layers.length + 1 }))} disabled={!engine.canAddLayer()} />
          <IconButton size="sm" label={t('studio.layers.moveUp')} icon={<ArrowUp size={16} />} onClick={() => active && engine.moveLayer(active.id, 1)} />
          <IconButton size="sm" label={t('studio.layers.moveDown')} icon={<ArrowDown size={16} />} onClick={() => active && engine.moveLayer(active.id, -1)} />
          <IconButton size="sm" label={t('studio.layers.delete')} icon={<Trash2 size={16} />} onClick={() => active && engine.removeLayer(active.id)} disabled={engine.layers.length <= 1} />
        </div>
      </div>

      <ul className="flex flex-col gap-1.5" role="listbox" aria-label={t('studio.layers.title')}>
        {la && (
          <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper-2/60 p-2">
            <Thumb layer={la} version={version} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t('studio.layers.lineArt')}</p>
              <p className="text-[11px] text-ink-faint">{t('studio.layers.lineArtNote')}</p>
            </div>
            <IconButton
              size="sm"
              label={la.visible ? t('studio.layers.hide') : t('studio.layers.show')}
              icon={la.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              onClick={() => engine.setLayerProps(la.id, { visible: !la.visible })}
            />
          </li>
        )}
        {ordered.map((l) => {
          const isActive = l.id === engine.activeId
          return (
            <li key={l.id}>
              <div
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => engine.setActive(l.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && engine.setActive(l.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl border p-2 transition-colors',
                  isActive ? 'border-ink bg-card shadow-paper' : 'border-transparent hover:bg-ink/[0.04]',
                )}
              >
                <Thumb layer={l} version={version} />
                <div className="min-w-0 flex-1">
                  {renaming === l.id ? (
                    <input
                      autoFocus
                      defaultValue={l.name}
                      aria-label={t('studio.layers.rename')}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        engine.setLayerProps(l.id, { name: e.target.value.trim() || l.name })
                        setRenaming(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      className="h-7 w-full rounded-lg border border-line-strong bg-card px-2 text-sm"
                    />
                  ) : (
                    <button
                      type="button"
                      className="block max-w-full truncate text-left text-sm font-medium"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setRenaming(l.id)
                      }}
                      title={t('studio.layers.renameHint')}
                    >
                      {l.name}
                    </button>
                  )}
                  <p className="text-[11px] text-ink-faint">
                    {t(`studio.blend.${l.blend}`)} · {Math.round(l.opacity * 100)}%
                  </p>
                </div>
                <IconButton
                  size="sm"
                  label={l.locked ? t('studio.layers.unlock') : t('studio.layers.lock')}
                  icon={l.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    engine.setLayerProps(l.id, { locked: !l.locked })
                  }}
                />
                <IconButton
                  size="sm"
                  label={l.visible ? t('studio.layers.hide') : t('studio.layers.show')}
                  icon={l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    engine.setLayerProps(l.id, { visible: !l.visible })
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {active && (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <p className="eyebrow">{t('studio.layers.properties', { name: active.name })}</p>
          <label className="flex items-center gap-3 text-xs font-medium text-ink-soft">
            {t('studio.opacity')}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={active.opacity}
              onChange={(e) => engine.setLayerProps(active.id, { opacity: Number(e.target.value) })}
              className="art-range flex-1"
              style={{ '--pct': `${active.opacity * 100}%`, '--accent': 'var(--ink)' } as React.CSSProperties}
            />
            <span className="w-9 tabular-nums text-ink">{Math.round(active.opacity * 100)}%</span>
          </label>
          <label className="flex items-center gap-3 text-xs font-medium text-ink-soft">
            {t('studio.layers.blend')}
            <select
              value={active.blend}
              onChange={(e) => engine.setLayerProps(active.id, { blend: e.target.value as BlendMode })}
              className="h-8 flex-1 rounded-full border border-line-strong bg-card px-3 text-xs text-ink"
            >
              {BLENDS.map((b) => (
                <option key={b} value={b}>
                  {t(`studio.blend.${b}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setRenaming(active.id)} className="text-xs font-medium text-accent-ink underline underline-offset-2">
            {t('studio.layers.rename')}
          </button>
        </div>
      )}
      {la && (
        <label className="flex items-center gap-3 text-xs font-medium text-ink-soft">
          {t('studio.layers.lineArtOpacity')}
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={la.opacity}
            onChange={(e) => engine.setLayerProps(la.id, { opacity: Number(e.target.value) })}
            className="art-range flex-1"
            style={{ '--pct': `${((la.opacity - 0.1) / 0.9) * 100}%`, '--accent': 'var(--ink)' } as React.CSSProperties}
          />
        </label>
      )}
    </div>
  )
}
