import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, LogOut, Menu, Settings, Trophy, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { preloadRoute } from '@/app/routes'
import { useSession } from '@/store/session'
import { useLiveStreak } from '@/features/gamification/hooks'
import { toast } from '@/store/ui'
import { logout } from '@/api/auth'
import { NAV_ITEMS } from './navItems'
import { Logo } from './Logo'
import { LanguageSwitch, ThemeToggle } from './Toggles'
import { StreakFlame, XPRing } from '../Gamification'
import { MobileMenu } from './MobileMenu'

function UserMenu() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.accountMenu')}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full"
      >
        <XPRing size={42} />
      </button>
      {open && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="paper absolute right-0 top-[calc(100%+10px)] w-60 rounded-2xl border border-line p-2 shadow-lift"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate font-display text-lg leading-tight">{user.displayName}</p>
            <p className="truncate text-xs text-ink-faint">{user.isGuest ? t('nav.guestMode') : user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/profile" className={item} onClick={() => setOpen(false)}>
            <UserIcon size={16} /> {t('nav.profile')}
          </Link>
          <Link role="menuitem" to="/achievements" className={item} onClick={() => setOpen(false)}>
            <Trophy size={16} /> {t('nav.achievements')}
          </Link>
          <Link role="menuitem" to="/profile#settings" className={item} onClick={() => setOpen(false)}>
            <Settings size={16} /> {t('nav.settings')}
          </Link>
          <div className="my-1 h-px bg-line" />
          {user.isGuest ? (
            <Link role="menuitem" to="/login" className={item} onClick={() => setOpen(false)}>
              <LogIn size={16} /> {t('nav.signIn')}
            </Link>
          ) : (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={async () => {
                setOpen(false)
                await logout()
                toast({ title: t('auth.signedOut'), tone: 'info' })
                navigate('/')
              }}
            >
              <LogOut size={16} /> {t('nav.signOut')}
            </button>
          )}
        </motion.div>
      )}
    </div>
  )
}

export function Navbar() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24)
  const [menuOpen, setMenuOpen] = useState(false)
  const streak = useLiveStreak()
  const location = useLocation()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-3 md:px-6 md:pt-4">
        <nav
          aria-label={t('nav.primary')}
          className={cn(
            'pointer-events-auto flex h-14 w-full max-w-[1320px] items-center justify-between gap-3 rounded-full border px-3 pl-4 transition-[background-color,box-shadow,border-color] duration-300 md:h-16 md:pl-5',
            scrolled || location.pathname !== '/'
              ? 'border-line bg-card/80 shadow-paper backdrop-blur-xl backdrop-saturate-150'
              : 'border-transparent bg-transparent',
          )}
        >
          <Logo />
          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === '/'}
                  onMouseEnter={() => preloadRoute(it.to)}
                  onFocus={() => preloadRoute(it.to)}
                  className={({ isActive }) =>
                    cn(
                      'relative inline-flex h-10 items-center rounded-full px-3.5 text-[0.92rem] font-medium transition-colors',
                      isActive ? 'text-ink' : 'text-ink-faint hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-x-2 bottom-1.5 h-[5px] rounded-full bg-saffron"
                          style={{ filter: 'url(#rough)' }}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative">{t(`nav.${it.key}`)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link
              to="/achievements"
              className="hidden h-10 items-center rounded-full px-2.5 hover:bg-ink/5 sm:inline-flex"
              aria-label={t('gamification.streakDays', { count: streak })}
            >
              <StreakFlame count={streak} />
            </Link>
            <div className="hidden items-center gap-1.5 md:flex">
              <LanguageSwitch />
              <ThemeToggle />
            </div>
            <div className="hidden sm:block">
              <UserMenu />
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 lg:hidden"
              aria-label={t('nav.openMenu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>
        </nav>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
