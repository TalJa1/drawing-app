import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Info, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useToasts, type Toast } from '@/store/ui'

const icons = { info: Info, success: CircleCheck, error: CircleAlert, gold: Sparkles }

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  const { t } = useTranslation()
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), toast.tone === 'gold' ? 6000 : 4200)
    return () => window.clearTimeout(id)
  }, [toast.id, toast.tone, dismiss])
  const Icon = icons[toast.tone]
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96, rotate: -1 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      className={cn(
        'pointer-events-auto relative flex w-[min(380px,calc(100vw-32px))] items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-lift',
        toast.tone === 'gold' ? 'border-gold/60 bg-[#1b1a17] text-[#f6f1e7]' : 'paper border-line text-ink',
      )}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{
          background:
            toast.tone === 'success'
              ? 'var(--viridian)'
              : toast.tone === 'error'
                ? 'var(--vermilion)'
                : toast.tone === 'gold'
                  ? 'var(--gold)'
                  : 'var(--cerulean)',
        }}
      />
      <Icon size={20} className={cn('mt-0.5 shrink-0', toast.tone === 'gold' ? 'text-gold' : 'text-ink-soft')} />
      <div className="min-w-0">
        <p className="font-medium leading-snug">{toast.title}</p>
        {toast.description && (
          <p className={cn('mt-0.5 text-sm', toast.tone === 'gold' ? 'text-[#f6f1e7]/75' : 'text-ink-soft')}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t('common.dismiss')}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full opacity-60 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </motion.li>
  )
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 right-4 z-[120] flex flex-col items-end gap-3 md:bottom-6 md:right-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </ol>
  )
}
