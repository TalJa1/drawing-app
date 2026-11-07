import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/hooks'
import { useSettings } from '@/store/settings'

/** Each entry has one chip per alternative way to do it; a long combination no longer has to fit in one chip.
 *  A row whose chips do not fit beside the label drops them under it (right-aligned) instead of running over it. */
const SHORTCUTS: [string[], string][] = [
  [['B / P / M'], 'studio.sc.brushes'],
  [['W / A / C'], 'studio.sc.paints'],
  [['E'], 'studio.sc.eraser'],
  [['G'], 'studio.sc.bucket'],
  [['I', 'Alt + click'], 'studio.sc.eyedropper'],
  [['L / R / O'], 'studio.sc.shapes'],
  [['[  ]'], 'studio.sc.size'],
  [['Ctrl/⌘ + Z'], 'studio.sc.undo'],
  [['Shift + Ctrl/⌘ + Z', 'Ctrl + Y'], 'studio.sc.redo'],
  [['Space + drag'], 'studio.sc.pan'],
  [['Wheel · pinch'], 'studio.sc.zoom'],
  [['0'], 'studio.sc.fit'],
  [['H'], 'studio.sc.lineart'],
  [['X'], 'studio.sc.swap'],
  [['Shift (shapes)'], 'studio.sc.constrain'],
  [['Ctrl/⌘ + S'], 'studio.sc.save'],
  [['?'], 'studio.sc.help'],
]

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('studio.shortcuts')} size="md">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line pb-2">
            <dt className="min-w-[4.5rem] flex-1 basis-0 text-sm text-ink-soft">{t(label)}</dt>
            <dd className="ml-auto flex max-w-full flex-wrap justify-end gap-1">
              {keys.map((k) => (
                <kbd key={k} className="whitespace-nowrap rounded-md border border-line-strong bg-paper-2 px-2 py-0.5 font-mono text-xs">
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

const TOUR_STEPS = ['tools', 'options', 'colour', 'primary'] as const

const TOUR_FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Short, skippable first-visit tour that spotlights studio regions.
 * `suspended` hides it while another dialog (shortcuts, confirm, a panel sheet) is open, so the two never
 * stack; the step is kept and the tour comes back on it. While visible it keeps Tab inside its card.
 */
export function OnboardingTour({ mode, suspended = false }: { mode: 'template' | 'free'; suspended?: boolean }) {
  const { t } = useTranslation()
  const done = useSettings((s) => s.onboardingDone)
  const setDone = useSettings((s) => s.setOnboardingDone)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const touch = useMediaQuery('(hover: none)') // no pointer to hover with: leave out "hover for shortcuts"
  const key = TOUR_STEPS[step]
  const active = !done && !suspended

  useLayoutEffect(() => {
    if (!active) return
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
  }, [key, active])

  // Escape skips the tour; Tab / Shift+Tab stay inside the card (aria-modal is a promise, this keeps it).
  useEffect(() => {
    if (!active) return
    const prev = document.activeElement as HTMLElement | null
    const focusTimer = window.setTimeout(() => {
      const card = cardRef.current
      ;(card?.querySelector<HTMLElement>('[data-autofocus]') ?? card)?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setDone(true)
        return
      }
      const card = cardRef.current
      if (e.key !== 'Tab' || !card) return
      const els = Array.from(card.querySelectorAll<HTMLElement>(TOUR_FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      const inside = card.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      if (document.body.contains(prev)) prev?.focus?.()
    }
  }, [active, setDone])

  if (!active) return null
  const last = step === TOUR_STEPS.length - 1
  const pad = 8
  // The card goes to the top when the spotlighted region is in the lower part of the screen (the mobile dock,
  // the tool-options bar), so the card never covers the thing it is describing.
  const atTop = !!rect && rect.top + rect.height / 2 > window.innerHeight * 0.45
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
        ref={cardRef}
        key={step}
        tabIndex={-1}
        initial={{ opacity: 0, y: atTop ? -16 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'paper absolute left-1/2 max-h-[calc(100dvh-32px)] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 overflow-y-auto rounded-[26px] border border-line p-5 shadow-lift outline-none sm:p-6',
          atTop ? 'top-4' : 'bottom-6',
        )}
      >
        <p className="eyebrow">{t('studio.tour.step', { n: step + 1, total: TOUR_STEPS.length })}</p>
        <h2 className="mt-2 font-display text-2xl">{t(`studio.tour.${key}.title`)}</h2>
        <p className="mt-2 text-ink-soft">
          {t(`studio.tour.${key}.${key === 'primary' ? mode : key === 'tools' && touch ? 'bodyTouch' : 'body'}`)}
        </p>
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
