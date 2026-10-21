import { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useSettings } from '@/store/settings'

const SHORTCUTS: [string, string][] = [
  ['B / P / M', 'studio.sc.brushes'],
  ['W / A / C', 'studio.sc.paints'],
  ['E', 'studio.sc.eraser'],
  ['G', 'studio.sc.bucket'],
  ['I · Alt+click', 'studio.sc.eyedropper'],
  ['L / R / O', 'studio.sc.shapes'],
  ['[  ]', 'studio.sc.size'],
  ['Ctrl/⌘ + Z', 'studio.sc.undo'],
  ['Shift + Ctrl/⌘ + Z · Ctrl + Y', 'studio.sc.redo'],
  ['Space + drag', 'studio.sc.pan'],
  ['Wheel · pinch', 'studio.sc.zoom'],
  ['0', 'studio.sc.fit'],
  ['H', 'studio.sc.lineart'],
  ['X', 'studio.sc.swap'],
  ['Shift (shapes)', 'studio.sc.constrain'],
  ['Ctrl/⌘ + S', 'studio.sc.save'],
  ['?', 'studio.sc.help'],
]

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('studio.shortcuts')} size="md">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {SHORTCUTS.map(([k, label]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-b border-line pb-2">
            <dt className="text-sm text-ink-soft">{t(label)}</dt>
            <dd>
              <kbd className="whitespace-nowrap rounded-md border border-line-strong bg-paper-2 px-2 py-0.5 font-mono text-xs">{k}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

const TOUR_STEPS = ['tools', 'options', 'colour', 'primary'] as const

/** Short, skippable first-visit tour that spotlights studio regions. */
export function OnboardingTour({ mode }: { mode: 'template' | 'free' }) {
  const { t } = useTranslation()
  const done = useSettings((s) => s.onboardingDone)
  const setDone = useSettings((s) => s.setOnboardingDone)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const key = TOUR_STEPS[step]

  useLayoutEffect(() => {
    if (done) return
    const find = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)).filter((el) => el.offsetParent !== null)
      setRect(els[0]?.getBoundingClientRect() ?? null)
    }
    const raf = requestAnimationFrame(find)
    window.addEventListener('resize', find)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', find)
    }
  }, [key, done])

  useEffect(() => {
    if (done) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDone(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, setDone])

  if (done) return null
  const last = step === TOUR_STEPS.length - 1
  const pad = 8
  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={t('studio.tour.label')}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx="18"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(13,11,9,0.62)" mask="url(#tour-mask)" />
        {rect && (
          <rect
            x={rect.left - pad}
            y={rect.top - pad}
            width={rect.width + pad * 2}
            height={rect.height + pad * 2}
            rx="18"
            fill="none"
            stroke="#F2A93B"
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
        )}
      </svg>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper absolute bottom-6 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-[26px] border border-line p-6 shadow-lift"
      >
        <p className="eyebrow">{t('studio.tour.step', { n: step + 1, total: TOUR_STEPS.length })}</p>
        <h2 className="mt-2 font-display text-2xl">{t(`studio.tour.${key}.title`)}</h2>
        <p className="mt-2 text-ink-soft">{t(`studio.tour.${key}.${key === 'primary' ? mode : 'body'}`)}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={() => setDone(true)} className="text-sm font-medium text-ink-faint hover:text-ink">
            {t('common.skip')}
          </button>
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden>
              {TOUR_STEPS.map((s, i) => (
                <span key={s} className={i === step ? 'h-1.5 w-5 rounded-full bg-vermilion' : 'h-1.5 w-1.5 rounded-full bg-ink/20'} />
              ))}
            </span>
            <Button size="sm" variant={last ? 'pigment' : 'ink'} onClick={() => (last ? setDone(true) : setStep(step + 1))} data-autofocus>
              {last ? t('studio.tour.start') : t('common.next')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function RestoreDraftModal({
  open,
  savedAt,
  onRestore,
  onFresh,
}: {
  open: boolean
  savedAt?: string
  onRestore: () => void
  onFresh: () => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <Modal open={open} onClose={onRestore} title={t('studio.restore.title')} size="sm" hideClose>
      <p className="text-ink-soft">
        {t('studio.restore.body', {
          when: savedAt
            ? new Date(savedAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
            : '',
        })}
      </p>
      <p className="hand mt-3 text-xl text-accent-ink">{t('studio.restore.note')}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onFresh}>
          {t('studio.restore.fresh')}
        </Button>
        <Button variant="pigment" className="flex-1" onClick={onRestore} data-autofocus>
          {t('studio.restore.continue')}
        </Button>
      </div>
    </Modal>
  )
}
