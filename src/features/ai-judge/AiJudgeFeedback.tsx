import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { motion } from 'framer-motion'
import { Check, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import type { AiErrorCode, Artwork, ScoreResult, Template } from '@/types'
import { useReducedMotion } from '@/app/theme'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Progress'
import { Muse } from '@/features/chat/Muse'
import { useSettings } from '@/store/settings'
import { useJudgeFeedback, type JudgeState } from './useJudgeFeedback'

const OWN_MESSAGE = new Set<AiErrorCode>([
  'rate_limited',
  'ai_busy',
  'ai_budget_exceeded',
  'unauthorized',
  'ai_not_configured',
  'network',
  'timeout',
  'upstream',
  'image_missing',
])
const SHOWS_WAIT = new Set<AiErrorCode>(['rate_limited', 'ai_busy', 'ai_budget_exceeded'])

function waitText(ms: number, t: TFunction): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  if (seconds < 90) return t('aiJudge.wait.seconds', { value: seconds })
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 90) return t('aiJudge.wait.minutes', { value: minutes })
  return t('aiJudge.wait.hours', { value: Math.ceil(minutes / 60) })
}

function StatusText({ state, t }: { state: JudgeState; t: TFunction }) {
  if (state.status === 'loading') return <p className="text-ink-soft">{t('aiJudge.loading')}</p>
  if (state.status === 'done') return <p className="sr-only">{t('aiJudge.ready')}</p>
  if (state.status !== 'error') return null
  const wait = SHOWS_WAIT.has(state.code) && state.retryAfterMs !== undefined ? waitText(state.retryAfterMs, t) : null
  return (
    <>
      <p className="text-ink">{t(`aiJudge.error.${OWN_MESSAGE.has(state.code) ? state.code : 'generic'}`)}</p>
      {wait && <p className="mt-1 text-sm text-ink-soft">{t('aiJudge.retryIn', { time: wait })}</p>}
    </>
  )
}

/** Muse's written feedback on a practice result. The formula score above it never changes. */
export function AiJudgeFeedback({ artwork, template, score }: { artwork: Artwork; template: Template; score: ScoreResult }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.language)
  const reduced = useReducedMotion()
  const { state, request } = useJudgeFeedback(artwork, template, score, lang)
  const id = useId()
  const section = useRef<HTMLElement>(null)
  const start = () => {
    // The pressed button disappears; keep keyboard focus inside the panel.
    section.current?.focus({ preventScroll: true })
    void request()
  }

  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="mt-10 rounded-[26px] border border-line bg-card p-6 shadow-paper focus:outline-none sm:p-8"
    >
      <div className="flex items-center gap-4">
        <Muse size={48} still className="shrink-0" />
        <h2 id={`${id}-title`} className="font-display text-2xl text-ink">
          {t('aiJudge.title')}
        </h2>
      </div>

      <div role="status" className="mt-4 empty:hidden">
        <StatusText state={state} t={t} />
      </div>

      {state.status === 'idle' && (
        <div className="mt-4 space-y-4">
          <p className="max-w-prose text-ink-soft">{t('aiJudge.intro')}</p>
          <Button variant="ink" icon={<Sparkles size={17} />} onClick={start}>
            {t('aiJudge.ask')}
          </Button>
          <p className="flex max-w-prose items-start gap-2 text-sm text-ink-soft">
            <ShieldCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
            {t('aiJudge.disclosure')}
          </p>
        </div>
      )}

      {state.status === 'loading' && (
        <div aria-hidden className="mt-5 space-y-3">
          <Skeleton className="h-5 w-11/12 rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
          <Skeleton className="mt-5 h-20 w-full rounded-2xl" />
        </div>
      )}

      {state.status === 'done' && (
        // A short rise only: text stays fully opaque, so contrast holds while it settles.
        <motion.div
          initial={reduced ? false : { y: 8 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 space-y-6"
        >
          <p className="max-w-prose text-lg leading-relaxed text-ink">{state.feedback.summary}</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 id={`${id}-strengths`} className="font-semibold text-ink">
                {t('aiJudge.strengths')}
              </h3>
              <ul aria-labelledby={`${id}-strengths`} className="mt-3 space-y-2 text-ink-soft">
                {state.feedback.strengths.map((strength, i) => (
                  <li key={i} className="flex gap-2">
                    <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-viridian" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 id={`${id}-tips`} className="font-semibold text-ink">
                {t('aiJudge.tips')}
              </h3>
              <ol
                aria-labelledby={`${id}-tips`}
                className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft marker:font-semibold marker:text-ink"
              >
                {state.feedback.tips.map((tip, i) => (
                  <li key={i} className="pl-1">
                    {tip}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-line-strong bg-paper-2/60 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{t('aiJudge.tryNow')}</h3>
            <p className="mt-2 text-ink">{state.feedback.exercise}</p>
          </div>
          <p className="text-xs text-ink-soft">{t('aiJudge.label')}</p>
        </motion.div>
      )}

      {state.status === 'error' && (
        <Button variant="outline" icon={<RotateCcw size={17} />} onClick={start} className="mt-4">
          {t('aiJudge.retry')}
        </Button>
      )}
    </section>
  )
}
