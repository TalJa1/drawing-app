import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

/** Bottom tab bar for phones. */
export function MobileTabBar() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.mobileTabs')}
      className="fixed inset-x-3 bottom-3 z-[80] rounded-[26px] border border-line bg-card/90 shadow-lift backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-16 items-stretch justify-around px-1">
        {NAV_ITEMS.filter((i) => i.mobile).map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium',
                  isActive ? 'text-ink' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-blob"
                      className="absolute top-1.5 h-9 w-12 rounded-full bg-saffron/35"
                      style={{ filter: 'url(#rough)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <it.icon size={21} className="relative" strokeWidth={isActive ? 2.3 : 1.8} />
                  <span className="relative">{t(`nav.short.${it.key}`)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
