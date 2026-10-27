import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants } from '../motion'
import { Compass } from 'lucide-react'
import type { ChatMode } from '@/types'
import { Muse } from '../Muse'

export function WelcomeState({ mode, name, onPrompt }: { mode: ChatMode; name: string; onPrompt: (text: string) => void }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const variants = chatVariants(reduced)
  const prompts = t(`chat.modes.${mode}.prompts`, { returnObjects: true }) as string[]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.08 : CHAT_MOTION.welcome }}
      className="mx-auto flex max-w-[720px] flex-col items-center pt-4 text-center"
    >
      <Muse size={150} />
      <h2 className="display-md mt-4">{t('chat.emptyTitle', { name })}</h2>
      <p className="mt-2 text-ink-soft">{t(`chat.modes.${mode}.intro`)}</p>
      <p className="hand mt-2 text-xl text-accent-ink">{t('chat.emptyNote')}</p>
      <div className="mt-6 grid w-full gap-3 sm:grid-cols-3" role="group" aria-label={t('chat.suggestions')}>
        {prompts.map((prompt, index) => (
          <motion.button
            variants={variants.prompt}
            initial="hidden"
            animate="visible"
            whileHover={reduced ? undefined : { y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.99 }}
            transition={{ duration: reduced ? 0.08 : CHAT_MOTION.prompt, delay: reduced ? 0 : index * CHAT_MOTION.welcomeStagger }}
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="group relative min-h-11 rounded-2xl border border-line-strong bg-card p-4 text-left text-sm text-ink-soft hover:border-ink"
          >
            <Compass size={16} className="mb-2 text-accent-ink" />
            {prompt}
            <span
              aria-hidden
              className="absolute inset-x-4 bottom-2 h-0.5 rounded-full bg-saffron opacity-0 transition-opacity group-hover:opacity-100"
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
