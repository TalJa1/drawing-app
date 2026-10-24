import { useTranslation } from 'react-i18next'

/** Suspense fallback: three pigment drops filling in turn. */
export function PageLoader({ full = true }: { full?: boolean }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      aria-live="polite"
      className={full ? 'flex min-h-dvh items-center justify-center' : 'flex items-center justify-center py-16'}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2.5" aria-hidden>
          {['var(--vermilion)', 'var(--saffron)', 'var(--cerulean)'].map((c, i) => (
            <span
              key={c}
              className="h-3.5 w-3.5 rounded-full"
              style={{ background: c, animation: `float-y 1.1s ${i * 0.15}s ease-in-out infinite` }}
            />
          ))}
        </div>
        <span className="hand text-xl text-ink-faint">{t('common.loading')}</span>
      </div>
    </div>
  )
}
