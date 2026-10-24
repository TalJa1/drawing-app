import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check, Gift, Snowflake, Users } from 'lucide-react'
import type { Badge, BadgeCategory } from '@/types'
import { Page, SectionHeading, Reveal } from '@/components/Layout'
import { Tabs } from '@/components/Tabs'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Avatar } from '@/components/Avatar'
import { BadgeIcon } from '@/components/BadgeIcon'
import { Skeleton, CountUp } from '@/components/Progress'
import { StreakFlame, XPRing } from '@/components/Gamification'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { Highlight } from '@/components/art/Brush'
import { Washes } from '@/components/art/Washes'
import { useAchievements, useChallenges, useClaimChallenge, useLeaderboard } from '@/api/queries'
import { BadgeMedal } from '@/features/gamification/BadgeMedal'
import { useLevel, useLiveStreak } from '@/features/gamification/hooks'
import { nextRank, xpForLevel } from '@/features/gamification/rules'
import { RANKS } from '@/mocks/challenges'
import { useL } from '@/i18n/useL'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { useNow } from '@/lib/hooks'
import { msUntilMidnight, formatDuration } from '@/lib/date'
import { useProgress } from '@/store/progress'
import { presentReward, toast } from '@/store/ui'
import { ApiError } from '@/api/client'

const CATS: (BadgeCategory | 'all')[] = ['all', 'practice', 'score', 'streak', 'learning', 'colour', 'exploration', 'secret']

function LevelHero() {
  const { t } = useTranslation()
  const L = useL()
  const { level, current, needed, ratio, rank, xp } = useLevel()
  const nr = nextRank(level)
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="relative mx-auto">
          <XPRing size={168} />
          <motion.span
            className="absolute -right-3 top-2 rounded-full bg-gold px-3 py-1 text-sm font-bold text-inkwell shadow-lift"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.3 }}
          >
            {t('gamification.level', { level })}
          </motion.span>
        </div>
        <div>
          <p className="eyebrow">{t('achievements.rank')}</p>
          <h2 className="display-md mt-2">{L(rank.name)}</h2>
          <p className="mt-2 text-ink-soft">{L(rank.perk)}</p>
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-sm">
              <span>
                <CountUp to={xp} /> XP
              </span>
              <span className="tabular-nums text-ink-faint">
                {current} / {needed} · {t('achievements.toNext', { level: level + 1 })}
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-paper-3"
              role="progressbar"
              aria-valuenow={Math.round(ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('achievements.toNext', { level: level + 1 })}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-saffron via-gold to-vermilion"
                initial={{ width: 0 }}
                animate={{ width: `${ratio * 100}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
          {nr && (
            <p className="hand mt-3 text-xl text-accent-ink">
              {t('achievements.nextRank', { rank: L(nr.name), level: nr.minLevel, xp: xpForLevel(nr.minLevel) - xp })}
            </p>
          )}
        </div>
      </div>
      <ol className="no-scrollbar mt-8 flex gap-2 overflow-x-auto" aria-label={t('achievements.ladder')} tabIndex={0}>
        {RANKS.map((r) => {
          const reached = level >= r.minLevel
          return (
            <li
              key={r.id}
              className={cn(
                'min-w-[132px] flex-1 rounded-2xl border p-3 text-sm',
                reached ? 'border-gold/60 bg-gold/10' : 'border-line opacity-70',
              )}
            >
              <p className="flex items-center gap-1.5 font-semibold">
                {reached && <Check size={14} className="text-viridian" />}
                {L(r.name)}
              </p>
              <p className="text-xs text-ink-faint">{t('gamification.level', { level: r.minLevel })}</p>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function Challenges() {
  const { t } = useTranslation()
  const L = useL()
  const { data, isLoading } = useChallenges()
  const claim = useClaimChallenge()
  const now = useNow(1000)
  if (isLoading || !data) return <Skeleton className="h-64 rounded-[22px]" />
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((c) => {
        const done = c.progress >= c.challenge.target
        const pct = Math.min(1, c.progress / c.challenge.target)
        const special = c.challenge.kind === 'special'
        return (
          <article
            key={`${c.challenge.id}@${c.periodKey}`}
            className={cn(
              'relative overflow-hidden rounded-[22px] border p-5 shadow-paper',
              special ? 'border-transparent bg-[#1b1a17] text-[#f6f1e7] md:col-span-2 xl:col-span-1' : 'paper border-line',
            )}
          >
            {special && c.theme && (
              <div aria-hidden className="absolute inset-x-0 top-0 flex h-1.5">
                {c.theme.map((col) => (
                  <span key={col} className="flex-1" style={{ background: col }} />
                ))}
              </div>
            )}
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                  special ? 'bg-white/10 text-gold' : 'bg-ink/[0.06] text-ink',
                )}
              >
                <BadgeIcon name={c.challenge.icon} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', special ? 'text-gold' : 'text-ink-faint')}>
                  {t(`achievements.kind.${c.challenge.kind}`)}
                  {c.challenge.kind === 'daily' && ` · ${formatDuration(msUntilMidnight(now) / 1000)}`}
                </p>
                <h3 className="mt-1 font-display text-xl leading-tight">{L(c.challenge.title)}</h3>
                <p className={cn('mt-1 text-sm', special ? 'text-[#f6f1e7]/75' : 'text-ink-soft')}>{L(c.challenge.description)}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="tabular-nums">
                  {Math.min(c.progress, c.challenge.target)} / {c.challenge.target}
                </span>
                <span className={cn('font-semibold', special ? 'text-gold' : 'text-gold-deep dark:text-gold')}>+{c.challenge.xp} XP</span>
              </div>
              <div
                className={cn('h-2 overflow-hidden rounded-full', special ? 'bg-white/15' : 'bg-paper-3')}
                role="progressbar"
                aria-valuenow={Math.round(pct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={L(c.challenge.title)}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-saffron to-vermilion transition-[width] duration-700"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-4">
              {c.claimed ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-viridian">
                  <Check size={16} /> {t('achievements.claimed')}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant={done ? 'gold' : 'outline'}
                  icon={<Gift size={15} />}
                  disabled={!done || claim.isPending}
                  className={cn(!done && special && '!border-white/25 !text-[#f6f1e7]')}
                  onClick={() =>
                    claim.mutate(
                      { id: c.challenge.id, periodKey: c.periodKey },
                      {
                        onSuccess: (r) => {
                          toast({ title: t('achievements.claimedToast', { xp: c.challenge.xp }), tone: 'gold' })
                          presentReward(r)
                        },
                        onError: (e) => toast({ title: e instanceof ApiError ? e.message : t('common.errorGeneric'), tone: 'error' }),
                      },
                    )
                  }
                >
                  {done ? t('achievements.claim') : t('achievements.inProgress')}
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function StreakCard() {
  const { t, i18n } = useTranslation()
  const streak = useLiveStreak()
  const s = useProgress((p) => p.streak)
  const activity = useProgress((p) => p.activity)
  return (
    <Card className="p-6">
      <div className="flex items-center gap-5">
        <StreakFlame count={streak} size={64} showCount={false} />
        <div>
          <p className="font-display text-5xl leading-none tabular-nums">{streak}</p>
          <p className="text-ink-soft">{t('achievements.streakDays', { count: streak })}</p>
        </div>
        <div className="ml-auto text-right text-sm">
          <p className="text-ink-faint">{t('achievements.longest')}</p>
          <p className="font-display text-2xl">{s.longest}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-cerulean/10 p-3 text-sm">
        <Snowflake size={18} className="text-cerulean" />
        <span className="flex-1">{t('achievements.freezes', { count: s.freezes })}</span>
        <span className="text-xs text-ink-faint">{t('achievements.freezeNote')}</span>
      </div>
      <div className="mt-5">
        <CalendarHeatmap
          activity={activity}
          frozen={s.frozenDays}
          weeks={10}
          title={t('collection.calendarTitle')}
          locale={i18n.language === 'vi' ? 'vi-VN' : 'en-GB'}
          lessLabel={t('collection.less')}
          moreLabel={t('collection.more')}
          countLabel={(n) => t('collection.activities', { count: n })}
        />
      </div>
    </Card>
  )
}

function BadgeWall() {
  const { t, i18n } = useTranslation()
  const L = useL()
  const { data, isLoading } = useAchievements()
  const [cat, setCat] = useState<BadgeCategory | 'all'>('all')
  const [open, setOpen] = useState<(Badge & { unlockedAt?: string }) | null>(null)
  const badges = useMemo(() => (data?.badges ?? []).filter((b) => cat === 'all' || b.category === cat), [data, cat])
  const unlocked = (data?.badges ?? []).filter((b) => b.unlockedAt).length
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs
          ariaLabel={t('achievements.badges')}
          value={cat}
          onChange={setCat}
          size="sm"
          items={CATS.map((c) => ({ id: c, label: c === 'all' ? t('common.all') : t(`achievements.cat.${c}`) }))}
        />
        <p className="text-sm text-ink-faint">{t('achievements.unlockedCount', { count: unlocked, total: data?.badges.length ?? 0 })}</p>
      </div>
      {isLoading ? (
        <Skeleton className="mt-6 h-72 rounded-[22px]" />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {badges.map((b, i) => {
            const got = !!b.unlockedAt
            const hidden = b.secret && !got
            return (
              <motion.li
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 12) * 0.03 }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(b)}
                  className={cn(
                    'group flex h-full w-full flex-col items-center rounded-[22px] border p-4 text-center transition-shadow',
                    got ? 'paper border-line shadow-paper hover:shadow-lift' : 'border-dashed border-line-strong',
                  )}
                  aria-label={
                    hidden ? t('achievements.secretBadge') : `${L(b.name)} — ${got ? t('achievements.unlocked') : t('achievements.locked')}`
                  }
                >
                  <BadgeMedal
                    badge={b}
                    unlocked={got}
                    size={76}
                    className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
                  />
                  <p className={cn('mt-3 font-display text-base leading-tight', !got && 'text-ink-faint')}>{hidden ? '???' : L(b.name)}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10.5px] font-semibold uppercase tracking-wider',
                      `rarity-${b.rarity}`,
                      got ? 'text-gold-deep dark:text-gold' : 'text-ink-faint',
                    )}
                  >
                    {t(`rarity.${b.rarity}`)}
                  </p>
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} size="sm">
        {open && (
          <div className="text-center">
            <div className="flex justify-center">
              <BadgeMedal badge={open} unlocked={!!open.unlockedAt} size={120} />
            </div>
            <h2 className="display-md mt-5">{open.secret && !open.unlockedAt ? t('achievements.secretBadge') : L(open.name)}</h2>
            <p className="mt-2 text-ink-soft">{open.secret && !open.unlockedAt ? t('achievements.secretHint') : L(open.description)}</p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-gold-deep dark:text-gold">
              {t(`rarity.${open.rarity}`)} · +{open.xp} XP
            </p>
            <p className="mt-2 text-sm text-ink-faint">
              {open.unlockedAt
                ? t('achievements.unlockedOn', { date: formatDate(open.unlockedAt, i18n.language) })
                : t('achievements.notYet')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Leaderboard() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'weekly' | 'all'>('weekly')
  const [filter, setFilter] = useState<'global' | 'friends'>('global')
  const { data, isLoading } = useLeaderboard(scope, filter)
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel={t('achievements.leaderboard')}
          value={scope}
          onChange={setScope}
          size="sm"
          items={[
            { id: 'weekly', label: t('achievements.weekly') },
            { id: 'all', label: t('achievements.allTime') },
          ]}
        />
        <Tabs
          ariaLabel={t('achievements.audience')}
          value={filter}
          onChange={setFilter}
          size="sm"
          items={[
            { id: 'global', label: t('achievements.global') },
            { id: 'friends', label: t('achievements.friends'), icon: <Users size={14} /> },
          ]}
        />
      </div>
      {isLoading || !data ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <ol className="mt-5 space-y-1.5">
          {data.map((e, i) => (
            <li
              key={e.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2',
                e.isCurrentUser ? 'bg-saffron/20 ring-1 ring-saffron/60' : i < 3 ? 'bg-ink/[0.03]' : '',
              )}
              aria-current={e.isCurrentUser ? 'true' : undefined}
            >
              <span
                className={cn(
                  'w-7 text-center font-display text-lg tabular-nums',
                  i === 0 ? 'text-gold-deep dark:text-gold' : 'text-ink-faint',
                )}
              >
                {i + 1}
              </span>
              <Avatar seed={e.avatarSeed} size={34} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {e.name}
                {e.isCurrentUser && <span className="ml-2 text-xs font-semibold text-accent-ink">{t('achievements.you')}</span>}
              </span>
              <span className="hidden text-xs text-ink-faint sm:inline">{t('gamification.level', { level: e.level })}</span>
              <span className="w-20 text-right text-sm font-semibold tabular-nums">
                {(scope === 'weekly' ? e.weeklyXp : e.xp).toLocaleString()} XP
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-ink-faint">{t('achievements.sampleNote')}</p>
    </Card>
  )
}

export default function AchievementsPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <Washes
        washes={[
          { color: '#D4AF37', size: '38vmax', top: '-14%', left: '-10%' },
          { color: 'var(--ultramarine)', size: '28vmax', top: '35%', right: '-12%', delay: -9 },
        ]}
      />
      <div className="container-art">
        <SectionHeading
          index="06"
          eyebrow={t('achievements.eyebrow')}
          title={
            <>
              {t('achievements.titleA')} <Highlight color="#D4AF37">{t('achievements.titleB')}</Highlight>
            </>
          }
          lede={t('achievements.lede')}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <LevelHero />
          <StreakCard />
        </div>
        <Reveal as="section" className="mt-16">
          <h2 className="display-md mb-6">{t('achievements.challenges')}</h2>
          <Challenges />
        </Reveal>
        <Reveal as="section" className="mt-16">
          <h2 className="display-md mb-6">{t('achievements.badges')}</h2>
          <BadgeWall />
        </Reveal>
        <Reveal as="section" className="mt-16">
          <h2 className="display-md mb-6">{t('achievements.leaderboard')}</h2>
          <Leaderboard />
        </Reveal>
      </div>
    </Page>
  )
}
