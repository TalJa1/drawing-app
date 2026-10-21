import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCelebrations } from '@/store/ui'
import { BADGE_MAP } from '@/mocks/badges'
import { useL } from '@/i18n/useL'
import { burst } from '@/lib/confetti'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { BadgeMedal } from './BadgeMedal'
import { rankForLevel } from './rules'
import { playChime } from '@/lib/sound'

/** Shows queued badge-unlock and level-up ceremonies one after another. */
export function CelebrationHost() {
  const { t } = useTranslation()
  const L = useL()
  const current = useCelebrations((s) => s.queue[0])
  const shift = useCelebrations((s) => s.shift)

  useEffect(() => {
    if (!current) return
    if (current.kind === 'badge' && !BADGE_MAP[current.badgeId]) {
      const skip = window.setTimeout(shift, 0)
      return () => window.clearTimeout(skip)
    }
    const id = window.setTimeout(() => {
      burst(0.5, 0.45, current.kind === 'level' || BADGE_MAP[current.kind === 'badge' ? current.badgeId : '']?.rarity === 'legendary')
      playChime(current.kind === 'level' ? 'level' : 'badge')
    }, 250)
    return () => window.clearTimeout(id)
  }, [current, shift])

  if (!current) return null

  if (current.kind === 'level') {
    const rank = rankForLevel(current.level)
    const prevRank = rankForLevel(current.level - 1)
    const rankUp = rank.id !== prevRank.id
    return (
      <Modal open onClose={shift} size="sm" hideClose>
        <div className="text-center">
          <p className="eyebrow">{t('celebrate.levelUp')}</p>
          <motion.div
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            className="relative mx-auto my-6 flex h-36 w-36 items-center justify-center rounded-full"
            style={{ background: 'conic-gradient(from 200deg, #F2A93B, #D4AF37, #E4572E, #F2A93B)' }}
          >
            <div className="paper flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">{t('gamification.levelShort')}</span>
              <span className="font-display text-6xl leading-none">{current.level}</span>
            </div>
          </motion.div>
          <h2 className="display-md">{rankUp ? t('celebrate.newRank', { rank: L(rank.name) }) : t('celebrate.reachedLevel', { level: current.level })}</h2>
          <p className="mt-3 text-ink-soft">{rankUp ? L(rank.perk) : t('celebrate.levelBody')}</p>
          <Button variant="gold" size="lg" className="mt-8 w-full" onClick={shift} data-autofocus>
            {t('celebrate.continue')}
          </Button>
        </div>
      </Modal>
    )
  }

  const badge = BADGE_MAP[current.badgeId]
  if (!badge) return null
  return (
    <Modal open onClose={shift} size="sm" hideClose>
      <div className="text-center">
        <p className="eyebrow">{badge.secret ? t('celebrate.secretUnlocked') : t('celebrate.badgeUnlocked')}</p>
        <motion.div
          initial={{ scale: 0.3, rotate: 30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.1 }}
          className="my-6 flex justify-center"
        >
          <BadgeMedal badge={badge} unlocked size={132} />
        </motion.div>
        <h2 className="display-md">{L(badge.name)}</h2>
        <p className="mt-2 text-ink-soft">{L(badge.description)}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-gold-deep dark:text-gold">
          {t(`rarity.${badge.rarity}`)} · +{badge.xp} XP
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/achievements"
            onClick={shift}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-line-strong font-medium"
          >
            {t('celebrate.seeAll')}
          </Link>
          <Button variant="gold" size="lg" className="flex-1" onClick={shift} data-autofocus>
            {t('celebrate.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
