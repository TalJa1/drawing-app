import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Brush, Clock, Flame, Heart, Image as ImageIcon, Sparkles, Star, Table2, Trophy } from 'lucide-react'
import type { Artwork } from '@/types'
import { Page, SectionHeading, EmptyState } from '@/components/Layout'
import { Tabs } from '@/components/Tabs'
import { Select } from '@/components/Form'
import { Button, ButtonLink } from '@/components/Button'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Progress'
import { LineChart } from '@/components/charts/LineChart'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { Highlight } from '@/components/art/Brush'
import { Washes } from '@/components/art/Washes'
import { useArtworks, useTemplateLookup, qk } from '@/api/queries'
import { seedDemoData } from '@/api/demo'
import { useL } from '@/i18n/useL'
import { cn } from '@/lib/utils'
import { formatDate, formatMinutes } from '@/lib/date'
import { useProgress } from '@/store/progress'
import { useLiveStreak } from '@/features/gamification/hooks'
import { ArtworkImage } from '@/features/collection/ArtworkImage'
import { Lightbox } from '@/features/collection/Lightbox'
import { queryClient } from '@/app/queryClient'
import { toast } from '@/store/ui'
import { useNow } from '@/lib/hooks'

type Tab = 'all' | 'practice' | 'free' | 'favourites'
type Sort = 'new' | 'old' | 'score'
type Range = 'all' | '7' | '30'

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-paper">
      <p className="flex items-center gap-2 text-xs font-medium text-ink-faint">
        {icon} {label}
      </p>
      <p className="mt-2 font-display text-3xl tabular-nums leading-none text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}

function GalleryItem({ art, onOpen, index }: { art: Artwork; onOpen: () => void; index: number }) {
  const { t, i18n } = useTranslation()
  const tilt = ((index * 37) % 5) - 2
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-8 break-inside-avoid"
    >
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full text-left"
        aria-label={t('collection.openArtwork', { title: art.title })}
      >
        <div
          className={cn(
            'frame transition-transform duration-500 [transform:rotate(var(--tilt))] group-hover:[transform:translateY(-4px)]',
            art.score && art.score.overall >= 85 && 'frame-gold',
          )}
          style={{ '--frame-w': '9px', '--tilt': `${tilt * 0.35}deg` } as React.CSSProperties}
        >
          <div className="mat" style={{ '--mat-w': '10px' } as React.CSSProperties}>
            <div className="art relative overflow-hidden">
              <ArtworkImage imageKey={art.thumbKey} alt={art.title} aspect={art.width / art.height} />
              {art.favourite && (
                <span className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 text-rose shadow">
                  <Heart size={13} className="fill-current" />
                </span>
              )}
              {/* museum label slides up on hover */}
              <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/75 to-transparent p-3 pt-8 text-[#f6f1e7] transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
                <p className="font-display text-lg leading-tight">{art.title}</p>
                <p className="text-[11px] uppercase tracking-wider opacity-80">
                  {art.kind === 'practice' ? t('collection.kind.practice') : t('collection.kind.free')} ·{' '}
                  {formatDate(art.createdAt, i18n.language)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="wall-label truncate">{art.title}</span>
          {art.score && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                art.score.overall >= 85 ? 'bg-gold text-inkwell' : 'bg-ink/[0.07] text-ink',
              )}
            >
              {art.score.overall}
            </span>
          )}
        </div>
      </button>
    </motion.li>
  )
}

export default function CollectionPage() {
  const { t, i18n } = useTranslation()
  const L = useL()
  const templateOf = useTemplateLookup()
  const { data, isLoading } = useArtworks()
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<Sort>('new')
  const [range, setRange] = useState<Range>('all')
  const [templateFilter, setTemplateFilter] = useState('all')
  const [open, setOpen] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const progress = useProgress()
  const streak = useLiveStreak()
  const all = useMemo(() => data ?? [], [data])
  const now = useNow(60_000).getTime()

  const filtered = useMemo(() => {
    let l = all
    if (tab === 'practice') l = l.filter((a) => a.kind === 'practice')
    if (tab === 'free') l = l.filter((a) => a.kind === 'free')
    if (tab === 'favourites') l = l.filter((a) => a.favourite)
    if (templateFilter !== 'all') l = l.filter((a) => a.templateId === templateFilter)
    if (range !== 'all') {
      const since = now - Number(range) * 86_400_000
      l = l.filter((a) => new Date(a.createdAt).getTime() >= since)
    }
    const s = [...l]
    if (sort === 'new') s.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'old') s.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (sort === 'score') s.sort((a, b) => (b.score?.overall ?? -1) - (a.score?.overall ?? -1))
    return s
  }, [all, tab, sort, range, templateFilter, now])

  const scored = all.filter((a) => a.score)
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + a.score!.overall, 0) / scored.length) : 0
  const best = scored.reduce((m, a) => Math.max(m, a.score!.overall), 0)
  const totalSeconds = all.reduce((s, a) => s + a.timeSpent, 0)
  const templatesUsed = [...new Set(all.map((a) => a.templateId).filter(Boolean) as string[])]

  const history = progress.scoreHistory.slice(-20)
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-GB'

  const loadDemo = async () => {
    setSeeding(true)
    try {
      await seedDemoData()
      await queryClient.invalidateQueries({ queryKey: qk.artworks })
      toast({ title: t('profile.demoLoaded'), tone: 'success' })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Page>
      <Washes
        washes={[
          { color: 'var(--rose)', size: '34vmax', top: '-10%', right: '-10%' },
          { color: 'var(--viridian)', size: '30vmax', top: '50%', left: '-16%', delay: -12 },
        ]}
      />
      <div className="container-art">
        <SectionHeading
          index="05"
          eyebrow={t('collection.eyebrow')}
          title={
            <>
              {t('collection.titleA')} <Highlight color="var(--rose)">{t('collection.titleB')}</Highlight>
            </>
          }
          lede={t('collection.lede')}
        />

        {/* ---------- stats ---------- */}
        <section aria-labelledby="stats" className="mt-12">
          <h2 id="stats" className="sr-only">
            {t('collection.stats')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile icon={<ImageIcon size={14} />} label={t('collection.statArtworks')} value={all.length} />
            <StatTile icon={<Sparkles size={14} />} label={t('collection.statAverage')} value={scored.length ? avg : '—'} />
            <StatTile icon={<Star size={14} />} label={t('collection.statBest')} value={scored.length ? best : '—'} />
            <StatTile icon={<Clock size={14} />} label={t('collection.statTime')} value={formatMinutes(totalSeconds)} />
            <StatTile icon={<Flame size={14} />} label={t('collection.statStreak')} value={streak} hint={t('collection.statDays')} />
            <StatTile
              icon={<Trophy size={14} />}
              label={t('collection.statLongest')}
              value={progress.streak.longest}
              hint={t('collection.statDays')}
            />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-5 sm:p-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-display text-xl">{t('collection.chartTitle')}</h3>
                <Button size="sm" variant="ghost" icon={<Table2 size={15} />} aria-pressed={table} onClick={() => setTable((v) => !v)}>
                  {table ? t('collection.hideTable') : t('collection.showTable')}
                </Button>
              </div>
              {history.length >= 2 ? (
                <LineChart
                  title={t('collection.chartTitle')}
                  showTable={table}
                  labels={history.map((h) => new Date(h.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))}
                  series={[
                    { id: 'overall', label: t('collection.series.overall'), color: 'var(--viz-1)', values: history.map((h) => h.overall) },
                    {
                      id: 'similarity',
                      label: t('result.similarity'),
                      color: 'var(--viz-2)',
                      dash: '6 4',
                      values: history.map((h) => h.similarity),
                    },
                    { id: 'colour', label: t('result.colour'), color: 'var(--viz-3)', dash: '2 4', values: history.map((h) => h.colour) },
                  ]}
                />
              ) : (
                <p className="py-10 text-center text-ink-faint">{t('collection.chartEmpty')}</p>
              )}
            </Card>
            <Card className="p-5 sm:p-6">
              <h3 className="mb-4 font-display text-xl">{t('collection.calendarTitle')}</h3>
              <CalendarHeatmap
                activity={progress.activity}
                frozen={progress.streak.frozenDays}
                weeks={18}
                title={t('collection.calendarTitle')}
                locale={locale}
                lessLabel={t('collection.less')}
                moreLabel={t('collection.more')}
                countLabel={(n) => t('collection.activities', { count: n })}
              />
            </Card>
          </div>
        </section>

        {/* ---------- gallery ---------- */}
        <section aria-labelledby="gallery" className="mt-16">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="gallery" className="display-md">
                {t('collection.galleryTitle')}
              </h2>
              <Tabs
                className="mt-4"
                ariaLabel={t('collection.galleryTitle')}
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'all', label: t('common.all'), count: all.length },
                  { id: 'practice', label: t('collection.kind.practice'), count: all.filter((a) => a.kind === 'practice').length },
                  { id: 'free', label: t('collection.kind.free'), count: all.filter((a) => a.kind === 'free').length },
                  { id: 'favourites', label: t('collection.favourites'), count: all.filter((a) => a.favourite).length },
                ]}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[520px]">
              <Select label={t('common.sortBy')} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="new">{t('practice.sort.new')}</option>
                <option value="old">{t('collection.sortOld')}</option>
                <option value="score">{t('collection.sortScore')}</option>
              </Select>
              <Select label={t('collection.date')} value={range} onChange={(e) => setRange(e.target.value as Range)}>
                <option value="all">{t('collection.anyTime')}</option>
                <option value="7">{t('collection.last7')}</option>
                <option value="30">{t('collection.last30')}</option>
              </Select>
              <Select label={t('collection.template')} value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
                <option value="all">{t('common.all')}</option>
                {templatesUsed.map((id) => (
                  <option key={id} value={id}>
                    {L(templateOf(id)?.title)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-[4/3]" />
              ))}
            </div>
          ) : all.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={t('collection.empty.title')}
              body={t('collection.empty.body')}
              note={t('collection.empty.note')}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <ButtonLink to="/practice" variant="pigment" icon={<Brush size={17} />}>
                    {t('collection.empty.cta')}
                  </ButtonLink>
                  <Button variant="outline" onClick={() => void loadDemo()} disabled={seeding}>
                    {seeding ? t('common.loading') : t('collection.empty.demo')}
                  </Button>
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-ink-faint">{t('collection.noMatch')}</p>
          ) : (
            <motion.ul layout className="mt-10 columns-1 gap-8 sm:columns-2 lg:columns-3">
              <AnimatePresence initial={false}>
                {filtered.map((a, i) => (
                  <GalleryItem key={a.id} art={a} index={i} onOpen={() => setOpen(i)} />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
          {all.length > 0 && (
            <p className="mt-6 text-center text-sm text-ink-faint">
              {t('collection.achievementsLink')}{' '}
              <Link to="/achievements" className="link-ink">
                {t('nav.achievements')}
              </Link>
            </p>
          )}
        </section>
      </div>
      <Lightbox artworks={filtered} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </Page>
  )
}
