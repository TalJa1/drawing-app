import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { useL } from '@/i18n/useL'
import { cn, svgToDataUrl } from '@/lib/utils'
import type { Template } from '@/types'
import { GUIDE_STRENGTHS, type GuideStrength, type TraceGuideState } from './useTraceGuide'

/** Compact on/off button for the studio top bar (44 px target). */
export function TraceGuideToggle({ state }: { state: TraceGuideState }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-pressed={state.visible}
      aria-label={t('freeDraw.guide.toggle')}
      title={t('freeDraw.guide.toggle')}
      onClick={() => state.setVisible(!state.visible)}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink',
        state.visible && 'bg-ink/[0.06] text-ink',
      )}
    >
      {state.visible ? <Eye size={18} /> : <EyeOff size={18} />}
    </button>
  )
}

/** Guide section of the Free Draw info panel: preview, on/off and three strengths. */
export function TraceGuidePanel({ template, state }: { template: Template; state: TraceGuideState }) {
  const { t } = useTranslation()
  const L = useL()
  const titleId = useId()
  return (
    <section className="rounded-2xl border border-line bg-paper-2/50 p-4" aria-labelledby={titleId}>
      <div className="flex items-center gap-3">
        <img src={svgToDataUrl(template.svg)} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-line bg-white object-contain" />
        <p id={titleId} className="min-w-0 font-display text-lg leading-tight">
          {t('freeDraw.guide.title', { name: L(template.title) })}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={state.visible}
        onClick={() => state.setVisible(!state.visible)}
        className={cn(
          'mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
          state.visible ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink',
        )}
      >
        {state.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        {t('freeDraw.guide.toggle')}
      </button>
      <div role="group" aria-label={t('freeDraw.guide.strength')} className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(GUIDE_STRENGTHS) as GuideStrength[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={state.strength === key}
            disabled={!state.visible}
            onClick={() => state.setStrength(key)}
            className={cn(
              'min-h-11 rounded-xl border text-sm font-medium disabled:opacity-50',
              state.strength === key ? 'border-ink bg-card text-ink' : 'border-line text-ink-soft hover:border-ink/40',
            )}
          >
            {t(`freeDraw.guide.${key}`)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-faint">{t('freeDraw.guide.note')}</p>
    </section>
  )
}
