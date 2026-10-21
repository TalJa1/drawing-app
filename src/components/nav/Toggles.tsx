import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { useResolvedTheme } from '@/app/theme'
import { IconButton } from '../IconButton'

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  const setTheme = useSettings((s) => s.setTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <IconButton
      className={className}
      label={next === 'dark' ? t('nav.themeDark') : t('nav.themeLight')}
      onClick={() => setTheme(next)}
      icon={
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex"
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </motion.span>
        </AnimatePresence>
      }
    />
  )
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.language)
  const setLanguage = useSettings((s) => s.setLanguage)
  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={cn('relative isolate inline-flex h-9 items-center rounded-full border border-line p-0.5 text-xs font-semibold', className)}
    >
      {(['en', 'vi'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          aria-label={l === 'en' ? 'English' : 'Tiếng Việt'}
          onClick={() => setLanguage(l)}
          className={cn(
            'relative z-10 h-full rounded-full px-2.5 uppercase transition-colors',
            lang === l ? 'text-paper' : 'text-ink-faint hover:text-ink',
          )}
        >
          {lang === l && (
            <motion.span layoutId="lang-pill" className="absolute inset-0 -z-10 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          {l}
        </button>
      ))}
    </div>
  )
}
