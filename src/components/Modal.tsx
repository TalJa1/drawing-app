import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useScrollLock } from '@/lib/hooks'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const node = ref.current
    const t = window.setTimeout(() => {
      const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? node)?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key !== 'Tab' || !node) return
      const els = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [open])
  return ref
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = 'md',
  hideClose,
  bare,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  hideClose?: boolean
  /** no paper card around content (for custom ceremonies) */
  bare?: boolean
}) {
  const { t } = useTranslation()
  const ref = useFocusTrap(open, onClose)
  useScrollLock(open)
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#0d0b09]/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'relative max-h-[92dvh] w-full overflow-y-auto outline-none scrollbar-thin',
              widths[size],
              !bare && 'paper rounded-t-[28px] border border-line p-6 shadow-lift sm:rounded-[28px] sm:p-8',
              className,
            )}
          >
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <X size={18} />
              </button>
            )}
            {title && <h2 className="display-md pr-10">{title}</h2>}
            {description && <p className="mt-2 text-ink-soft">{description}</p>}
            {children && <div className={cn(title || description ? 'mt-6' : '')}>{children}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Slide-in sheet (bottom on mobile, side on desktop if `side` set). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = 'bottom',
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children?: ReactNode
  side?: 'bottom' | 'right' | 'left'
  className?: string
}) {
  const { t } = useTranslation()
  const ref = useFocusTrap(open, onClose)
  useScrollLock(open)
  const from = side === 'bottom' ? { y: '100%' } : side === 'right' ? { x: '100%' } : { x: '-100%' }
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0d0b09]/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            initial={from}
            animate={{ x: 0, y: 0 }}
            exit={from}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className={cn(
              'paper absolute flex flex-col overflow-hidden border-line shadow-lift outline-none',
              side === 'bottom' && 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px] border-t',
              side === 'right' && 'inset-y-0 right-0 w-[min(420px,92vw)] border-l',
              side === 'left' && 'inset-y-0 left-0 w-[min(360px,88vw)] border-r',
              className,
            )}
          >
            <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4">
              {side === 'bottom' && (
                <span aria-hidden className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink/15" />
              )}
              <h2 className="font-display text-xl">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 scrollbar-thin">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
