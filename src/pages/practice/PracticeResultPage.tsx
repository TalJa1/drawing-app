import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Download,
  Flame,
  Heart,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Share2,
  Sparkles,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import type { Artwork, Template } from '@/types'
import { useArtwork, useTemplates, useUpdateArtwork } from '@/api/queries'
import { getImageBlob, getImageUrl } from '@/api/artworks'
import { recordActivity } from '@/api/progress'
import { templateById } from '@/api/templates'
import { useL } from '@/i18n/useL'
import { cn, copyText, downloadBlob } from '@/lib/utils'
import { celebrate } from '@/lib/confetti'
import { playChime } from '@/lib/sound'
import { presentReward, toast, useLastResult } from '@/store/ui'
import { useChat } from '@/store/chat'
import { useLevel } from '@/features/gamification/hooks'
import { BeforeAfter, HeatmapOverlay, JudgeNote, RankStamp } from '@/features/practice/ResultParts'
import { Page, Reveal, EmptyState } from '@/components/Layout'
import { Frame, WallLabel } from '@/components/Frame'
import { CountUp, Meter, Skeleton } from '@/components/Progress'
import { RadarChart } from '@/components/charts/RadarChart'
import { Button, ButtonLink } from '@/components/Button'
import { Switch } from '@/components/Form'
import { Card } from '@/components/Card'
import { InlineMarkdown } from '@/components/Markdown'
import { StreakFlame, XPBar } from '@/components/Gamification'
import { Washes } from '@/components/art/Washes'
import { Highlight } from '@/components/art/Brush'
import { BadgeMedal } from '@/features/gamification/BadgeMedal'
import { BADGE_MAP } from '@/mocks/badges'
import { formatMinutes, formatDate } from '@/lib/date'

function useImage(key: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!key) return
    let alive = true
    void getImageUrl(key).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [key])
  return url
}

function Result({ artwork, template }: { artwork: Artwork; template: Template }) {
  const { t, i18n } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const score = artwork.score!
  const image = useImage(artwork.imageKey)
  const [heat, setHeat] = useState(false)
  const fresh = useLastResult((s) => s.artworkId === artwork.id)
  const freshReward = useLastResult((s) => s.reward)
  const reward = fresh ? freshReward : null
  const great = score.overall >= 85
  const { data: templates } = useTemplates()
  const { level } = useLevel()
  const update = useUpdateArtwork()
  const setChatDraft = useChat((s) => s.setDraft)

  // the big reveal: confetti + chime for great work, then badge/level ceremonies
  // (marked as celebrated only when it actually happens, so StrictMode re-runs are safe)
  useEffect(() => {
    const st = useLastResult.getState()
    if (st.artworkId !== artwork.id || st.celebrated) return
    const timers: number[] = []
    if (great) {
      timers.push(
        window.setTimeout(() => {
          celebrate()
          playChime('masterpiece')
        }, 1700),
      )
    }
    timers.push(
      window.setTimeout(() => {
        useLastResult.getState().markCelebrated()
        presentReward(st.reward)
      }, great ? 3600 : 2400),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [artwork.id, great])

  const next = templates?.find((x) => x.id !== template.id && x.unlockLevel <= level && x.difficulty === template.difficulty && x.category !== template.category)
    ?? templates?.find((x) => x.id !== template.id && x.unlockLevel <= level)

  const download = async () => {
    const blob = await getImageBlob(artwork.imageKey)
    if (!blob) return
    downloadBlob(blob, `art-spark-${template.id}-${score.overall}.png`)
    toast({ title: t('studio.downloaded', { type: 'PNG' }), tone: 'success' })
    presentReward(await recordActivity({ type: 'download' }))
  }

  const share = async () => {
    const ok = await copyText(`${window.location.origin}/practice/result/${artwork.id}`)
    toast({ title: ok ? t('result.shareCopied') : t('result.shareFailed'), description: t('result.shareNote'), tone: ok ? 'success' : 'info' })
  }

  const askChat = () => {
    const weakest = Object.entries(score.sub).sort((a, b) => a[1] - b[1])[0][0]
    setChatDraft(t('result.chatPrompt', { title: L(template.title), score: score.overall, area: t(`result.sub.${weakest}`) }))
    navigate('/chat')
  }

  const sub = score.sub
  const axes = [
    { label: t('result.sub.lineAccuracy'), value: sub.lineAccuracy },
    { label: t('result.sub.composition'), value: sub.composition },
    { label: t('result.sub.proportion'), value: sub.proportion },
    { label: t('result.sub.harmony'), value: sub.harmony },
    { label: t('result.sub.suitability'), value: sub.suitability },
    { label: t('result.sub.aesthetics'), value: sub.aesthetics },
  ]

  return (
    <Page>
      <Washes
        washes={
          great
            ? [
                { color: '#D4AF37', size: '44vmax', top: '-20%', left: '-10%' },
                { color: 'var(--rose)', size: '30vmax', top: '20%', right: '-14%', delay: -8 },
              ]
            : undefined
        }
      />
      <div className="container-art">
        <nav aria-label={t('result.breadcrumb')} className="mb-6 flex items-center gap-2 text-sm text-ink-faint">
          <Link to="/practice" className="hover:text-ink">
            {t('nav.practice')}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{L(template.title)}</span>
        </nav>

        <div className="grid items-start gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          {/* ---------- artwork ---------- */}
          <div>
            <motion.div initial={{ opacity: 0, y: 30, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
              <Frame
                tone={great ? 'gold' : 'wood'}
                frameWidth={great ? 18 : 14}
                matWidth={18}
                className={cn(great && 'drop-shadow-[0_20px_60px_rgba(212,175,55,0.35)]')}
                label={
                  <WallLabel
                    title={L(template.title)}
                    lines={[
                      `${t('result.labelBy', { date: formatDate(artwork.createdAt, i18n.language) })}`,
                      `${artwork.medium} · ${formatMinutes(artwork.timeSpent)}`,
                      `${t('result.labelScore', { score: score.overall })}`,
                    ]}
                  />
                }
              >
                {image ? <BeforeAfter image={image} template={template} heatmap={heat && artwork.analysis ? <HeatmapOverlay grid={artwork.analysis.grid} /> : undefined} /> : <Skeleton className="aspect-[4/3] rounded-none" />}
              </Frame>
            </motion.div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <Switch checked={heat} onChange={setHeat} label={t('result.heatmap')} description={t('result.heatmapHint')} className="max-w-sm" />
              {heat && (
                <ul className="flex items-center gap-3 text-xs text-ink-soft" aria-label={t('result.heatmapLegend')}>
                  {[
                    ['var(--viz-3)', t('result.heat.matched')],
                    ['var(--saffron)', t('result.heat.partial')],
                    ['var(--viz-1)', t('result.heat.missed')],
                  ].map(([c, l]) => (
                    <li key={l} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ background: c, opacity: 0.7 }} /> {l}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ---------- score ---------- */}
          <div className="relative">
            <p className="eyebrow">{t('result.eyebrow')}</p>
            <div className="mt-3 flex items-end gap-5">
              <p className={cn('font-display text-[7.5rem] leading-[0.8] tracking-tight', great && 'gold-text')} aria-label={t('result.overallAria', { score: score.overall })}>
                <CountUp to={score.overall} duration={1.8} />
              </p>
              <p className="pb-3 font-display text-2xl text-ink-faint">/100</p>
              <div className="ml-auto -mt-6">
                <RankStamp rank={score.rank} label={t(`result.rank.${score.rank}`)} ringText={t('result.stampRing')} big={great} />
              </div>
            </div>
            <h1 className="display-md mt-4">
              {great ? (
                <>
                  {t('result.headlineGreatA')} <Highlight color="#D4AF37">{t('result.headlineGreatB')}</Highlight>
                </>
              ) : (
                t(`result.headline.${score.rank}`)
              )}
            </h1>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <Meter value={score.similarity} label={<span className="font-semibold text-ink">{t('result.similarity')}</span>} color="var(--viz-2)" height={12} />
                <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                  {(['lineAccuracy', 'composition', 'proportion'] as const).map((k) => (
                    <li key={k} className="flex justify-between">
                      <span>{t(`result.sub.${k}`)}</span>
                      <span className="tabular-nums text-ink">{sub[k]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Meter value={score.colour} label={<span className="font-semibold text-ink">{t('result.colour')}</span>} color="var(--viz-3)" height={12} />
                <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                  {(['harmony', 'suitability', 'aesthetics'] as const).map((k) => (
                    <li key={k} className="flex justify-between">
                      <span>{t(`result.sub.${k}`)}</span>
                      <span className="tabular-nums text-ink">{sub[k]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-[340px]">
              <RadarChart axes={axes} title={t('result.radarTitle')} />
            </div>
          </div>
        </div>

        {/* ---------- feedback ---------- */}
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <Reveal>
            <Card className="h-full p-6">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <ThumbsUp size={20} className="text-viridian" /> {t('result.strengths')}
              </h2>
              <ul className="mt-4 space-y-3 text-ink-soft">
                {score.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-viridian" />
                    {L(s)}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card className="h-full p-6">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <TrendingUp size={20} className="text-accent-ink" /> {t('result.improve')}
              </h2>
              <ul className="mt-4 space-y-3 text-ink-soft">
                {(score.weaknesses.length ? score.weaknesses : [{ en: t('result.nothingToImprove'), vi: t('result.nothingToImprove') }]).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-vermilion" />
                    {L(s)}
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-ink-soft">
                {score.feedback.map((f, i) => (
                  <p key={i}>{L(f)}</p>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.16}>
            <JudgeNote signature={t('result.judgeSignature')}>{L(score.judgeNote)}</JudgeNote>
          </Reveal>
        </div>

        <Reveal className="mt-10">
          <section aria-labelledby="tips" className="rounded-[26px] border border-line bg-paper-2/60 p-6 sm:p-8">
            <h2 id="tips" className="flex items-center gap-2 font-display text-2xl">
              <Lightbulb size={22} className="text-ochre" /> {t('result.tips')}
            </h2>
            <ol className="mt-5 grid gap-5 md:grid-cols-3">
              {score.tips.map((tip, i) => (
                <li key={i} className="relative rounded-2xl bg-card p-5 shadow-paper">
                  <span className="font-display text-5xl italic text-saffron/70">{i + 1}</span>
                  <p className="mt-2 text-ink-soft">
                    <InlineMarkdown text={L(tip)} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        {/* ---------- rewards ---------- */}
        {reward && (
          <Reveal className="mt-10">
            <section aria-labelledby="rewards" className="grid gap-6 rounded-[26px] border border-gold/40 bg-gold/[0.06] p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8">
              <div>
                <h2 id="rewards" className="eyebrow">{t('result.rewards')}</h2>
                <p className="mt-2 font-display text-5xl text-gold-deep dark:text-gold">
                  +<CountUp to={reward.xpGained} /> XP
                </p>
              </div>
              <div className="space-y-3">
                <XPBar />
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Flame size={16} className="text-vermilion" />
                  {reward.streakExtended ? t('result.streakUp', { count: reward.streak }) : t('result.streakSame', { count: reward.streak })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StreakFlame count={reward.streak} size={34} />
                {reward.newBadges.slice(0, 3).map((id) => BADGE_MAP[id] && <BadgeMedal key={id} badge={BADGE_MAP[id]} unlocked size={56} />)}
              </div>
            </section>
          </Reveal>
        )}

        {/* ---------- actions ---------- */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            variant={artwork.favourite ? 'gold' : 'outline'}
            icon={<Heart size={17} className={artwork.favourite ? 'fill-current' : ''} />}
            onClick={() => {
              update.mutate({ id: artwork.id, favourite: !artwork.favourite })
              toast({ title: artwork.favourite ? t('result.unfavourited') : t('result.savedFavourite'), tone: 'success' })
            }}
          >
            {artwork.favourite ? t('result.inFavourites') : t('result.saveFavourite')}
          </Button>
          <Button variant="outline" icon={<Download size={17} />} onClick={() => void download()}>
            {t('common.download')}
          </Button>
          <ButtonLink to={`/practice/${template.id}`} variant="outline" icon={<RotateCcw size={17} />}>
            {t('result.tryAgain')}
          </ButtonLink>
          <Button variant="outline" icon={<MessageCircle size={17} />} onClick={askChat}>
            {t('result.askChat')}
          </Button>
          <Button variant="ghost" icon={<Share2 size={17} />} onClick={() => void share()}>
            {t('common.share')}
          </Button>
          {next && (
            <ButtonLink to={`/practice/${next.id}`} variant="pigment" iconRight={<ArrowRight size={17} />} className="sm:ml-auto">
              {t('result.next', { title: L(next.title) })}
            </ButtonLink>
          )}
        </div>
        <p className="mt-3 text-sm text-ink-faint">
          <Sparkles size={14} className="mr-1 inline" /> {t('result.savedNote')}{' '}
          <Link to="/collection" className="link-ink">
            {t('nav.collection')}
          </Link>
        </p>
      </div>
    </Page>
  )
}

export default function PracticeResultPage() {
  const { artworkId = '' } = useParams()
  const { t } = useTranslation()
  const { data: artwork, isLoading, isError } = useArtwork(artworkId)
  const template = templateById(artwork?.templateId)

  if (isLoading)
    return (
      <Page>
        <div className="container-art grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </Page>
    )
  if (isError || !artwork || !artwork.score || !template)
    return (
      <Page>
        <EmptyState title={t('result.notFound')} body={t('result.notFoundBody')} action={<ButtonLink to="/practice">{t('practice.backToLibrary')}</ButtonLink>} />
      </Page>
    )
  return <Result artwork={artwork} template={template} />
}
