import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { useScrollLock } from '@/lib/hooks'

const LINES = ['linework', 'proportions', 'harmony', 'masters', 'notes'] as const

/**
 * The "AI judge" loading ceremony: the artwork on an easel while a scanning
 * light and magnifying glass sweep across it, with rotating status lines.
 */
export function ScoringCeremony({
  image,
  error,
  onRetry,
  onCancel,
}: {
  image: string
  error?: string | null
  onRetry: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [line, setLine] = useState(0)
  useScrollLock(true)
  useEffect(() => {
    const id = window.setInterval(() => setLine((l) => (l + 1) % LINES.length), 1100)
    return () => window.clearInterval(id)
  }, [])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[140] flex flex-col items-center justify-center overflow-hidden bg-[#110f0c] px-6 text-[#f6f1e7]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-modal="true"
      aria-label={t('ceremony.label')}
      aria-busy={!error}
    >
      {/* gallery spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40% 50% at 50% 38%, rgba(242,169,59,0.22), transparent 70%)' }} />
      <div className="relative aspect-[400/520] w-[min(340px,62vw,42dvh)]">
        {/* easel legs */}
        <svg viewBox="0 0 400 520" className="absolute left-0 top-0 h-auto w-full" aria-hidden>
          <path d="M120 300 L60 520 M280 300 L340 520 M200 300 L200 520" stroke="#6b4f36" strokeWidth="14" strokeLinecap="round" />
          <rect x="40" y="318" width="320" height="16" rx="6" fill="#7a5a3c" />
        </svg>
        <motion.div
          className="frame relative mx-auto mt-0 w-[86%]"
          style={{ '--frame-w': '10px' } as React.CSSProperties}
          initial={{ y: 30, rotate: -2, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
          <div className="mat" style={{ '--mat-w': '10px' } as React.CSSProperties}>
            <div className="art relative aspect-[4/3] overflow-hidden bg-white">
              <img src={image} alt="" className="h-full w-full object-contain" />
              {!error && (
                <div className="scan-beam pointer-events-none absolute inset-x-0 top-0 h-1/3" aria-hidden>
                  <div className="h-full w-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(242,169,59,0.45) 85%, rgba(255,241,184,0.9))' }} />
                </div>
              )}
            </div>
          </div>
        </motion.div>
        {!error && (
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-[18%] text-[#f6f1e7]"
            animate={{ x: [-90, 70, -40, 90, -90], y: [0, 50, 110, 30, 0], rotate: [-10, 8, -4, 10, -10] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative h-16 w-16 rounded-full border-4 border-[#D4AF37] bg-white/10 backdrop-blur-[1px]">
              <span className="absolute left-2.5 top-2 h-3 w-5 rotate-[-30deg] rounded-full bg-white/50" />
            </div>
            <div className="ml-12 -mt-1 h-10 w-3 rotate-[-40deg] rounded-full bg-[#6b4f36]" />
          </motion.div>
        )}
      </div>
      <div className="relative mt-6 min-h-20 text-center">
        {error ? (
          <div>
            <p className="font-display text-2xl">{t('ceremony.errorTitle')}</p>
            <p className="mt-1 text-[#f6f1e7]/70">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Button variant="outline" className="!border-white/30 !text-[#f6f1e7]" onClick={onCancel}>
                {t('ceremony.keepDrawing')}
              </Button>
              <Button variant="gold" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="font-display text-2xl italic sm:text-3xl"
              aria-live="polite"
            >
              {t(`ceremony.lines.${LINES[line]}`)}
            </motion.p>
            <p className="hand mt-2 text-xl text-[#F2A93B]">{t('ceremony.note')}</p>
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  )
}
