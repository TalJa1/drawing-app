import { NavLink } from 'react-router-dom'
import { Palette, Trophy, User as UserIcon, LogIn, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import { useLiveStreak } from '@/features/gamification/hooks'
import { Sheet } from '../Modal'
import { NAV_ITEMS } from './navItems'
import { LanguageSwitch, ThemeToggle } from './Toggles'
import { StreakFlame, XPBar } from '../Gamification'
import { Avatar } from '../Avatar'

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const streak = useLiveStreak()
  const extra = [
    { to: '/achievements', key: 'achievements', icon: Trophy },
    { to: '/learn/color-lab', key: 'colorLab', icon: Palette },
    { to: '/learn/flashcards', key: 'flashcards', icon: GraduationCap },
    { to: '/profile', key: 'profile', icon: UserIcon },
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition-colors',
      isActive ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
    )
  return (
    <Sheet open={open} onClose={onClose} side="right" title={t('nav.menu')}>
      <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
        <Avatar seed={user.avatarSeed} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg">{user.displayName}</p>
          <XPBar className="mt-1" />
        </div>
        <StreakFlame count={streak} />
      </div>
      <ul className="mt-4 flex flex-col gap-1">
        {[...NAV_ITEMS, ...extra].map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} end={it.to === '/'} className={link} onClick={onClose}>
              <it.icon size={19} />
              {t(`nav.${it.key}`)}
            </NavLink>
          </li>
        ))}
        {user.isGuest && (
          <li>
            <NavLink to="/login" className={link} onClick={onClose}>
              <LogIn size={19} /> {t('nav.signIn')}
            </NavLink>
          </li>
        )}
      </ul>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line p-3">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </Sheet>
  )
}
