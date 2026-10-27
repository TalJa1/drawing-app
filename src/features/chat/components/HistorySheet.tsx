import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useReducedMotion } from '@/app/theme'
import { useScrollLock } from '@/lib/hooks'
import { chatVariants } from '../motion'

const FOCUSABLE = 'button:not([disabled]),a[href],input,textarea,[tabindex]:not([tabindex="-1"])'

export function HistorySheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const focus = setTimeout(() => (node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus(), 30)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focus)
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.08 : 0.25 }}
        >
          <div aria-hidden className="absolute inset-0 bg-[#0d0b09]/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t('chat.history')}
            tabIndex={-1}
            variants={chatVariants(reduced).sheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="paper absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col overflow-hidden border-r border-line p-4 shadow-lift outline-none"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">{t('chat.history')}</h2>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
