import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Navbar } from '@/components/nav/Navbar'
import { MobileTabBar } from '@/components/nav/MobileTabBar'
import { Footer } from '@/components/nav/Footer'
import { PaintWipe } from '@/components/PaintWipe'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useReducedMotion } from './theme'

/** Standard page layout: floating nav, animated page transitions, footer. */
export function MainLayout() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduced = useReducedMotion()
  const { t } = useTranslation()
  // Only animate between top-level sections, not query/hash changes.
  const key = location.pathname

  return (
    <div className="paper-bg relative min-h-dvh">
      <a
        href="#main"
        className="fixed left-4 top-3 z-[150] -translate-y-20 rounded-full bg-ink px-4 py-2 text-paper focus:translate-y-0"
      >
        {t('a11y.skipToContent')}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <ErrorBoundary key={key}>{outlet}</ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      {!reduced && <PaintWipe routeKey={key} />}
      <Footer />
      <MobileTabBar />
    </div>
  )
}
