import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { chatVariants } from '../motion'
import { ArrowDown } from 'lucide-react'

export function ScrollToLatest({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  return (
    <motion.button
      variants={chatVariants(reduced).scrollButton}
      initial="hidden"
      animate="visible"
      exit="exit"
      type="button"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm shadow-paper"
    >
      <ArrowDown size={16} />
      {t('chat.scrollToLatest')}
    </motion.button>
  )
}
