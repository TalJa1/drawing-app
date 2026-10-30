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
      className="mx-auto flex max-w-[720px] flex-col items-center text-left lg:pt-4 lg:text-center"
    >
      <div className="flex w-full items-start gap-3 lg:flex-col lg:items-center lg:gap-0">
        <Muse size={150} className="h-[68px] w-[68px] shrink-0 lg:h-[135px] lg:w-[150px]" />
        <div className="min-w-0">
          <h2 className="display-md max-lg:text-[26px] max-lg:leading-tight lg:mt-4">
            <span className="lg:hidden">{t('chat.welcomeTitle', { name })}</span>
            <span className="hidden lg:inline">{t('chat.emptyTitle', { name })}</span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft lg:mt-2 lg:text-base">{t(`chat.modes.${mode}.intro`)}</p>
        </div>
      </div>
      <p className="hand mt-2 hidden text-xl text-accent-ink lg:block">{t('chat.emptyNote')}</p>
      <div className="mt-3 grid w-full gap-2 lg:mt-6 lg:grid-cols-3 lg:gap-3" role="group" aria-label={t('chat.suggestions')}>
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
            className="group relative min-h-11 rounded-2xl border border-line-strong bg-card px-3 py-2 text-left text-sm text-ink-soft hover:border-ink lg:p-4"
          >
            <Compass size={16} className="mb-2 hidden text-accent-ink lg:block" />
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
