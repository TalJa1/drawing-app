import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Clock,
  Eye,
  GalleryVerticalEnd,
  Lightbulb,
  Palette,
  Shapes,
  Sparkles,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { LessonTopic } from '@/types'
import { Page, Reveal, SectionHeading } from '@/components/Layout'
import { SearchBar } from '@/components/Form'
import { Chip, DifficultyDots, Pill } from '@/components/Chip'
import { Card, TiltCard } from '@/components/Card'
import { Frame } from '@/components/Frame'
import { IconButton } from '@/components/IconButton'
import { ButtonLink } from '@/components/Button'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { Highlight } from '@/components/art/Brush'
import { Washes } from '@/components/art/Washes'
import { ProgressRing } from '@/components/Progress'
import { ArtWheel } from '@/features/learn/ArtWheel'
import { ArtFormCover } from '@/features/learn/ArtFormCover'
import { searchAtlas } from '@/features/learn/search'
import { DIFF_LEVEL } from '@/features/practice/constants'
import { useArtForms, useArtists, useGlossary, useLessons, useMovements } from '@/api/queries'
import { TIMELINE } from '@/mocks/movements'
import { ARTISTS } from '@/mocks/artists'
import { ART_FACTS } from '@/mocks/palettes'
import { TRACKS } from '@/mocks/lessons'
import { useL, useLang } from '@/i18n/useL'
import { hashString } from '@/lib/random'
import { dayKey } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'

const SECTIONS = ['forms', 'timeline', 'artists', 'lessons', 'tools', 'paths'] as const
const TOPICS: (LessonTopic | 'all' | 'saved')[] = [
  'all',
  'saved',
  'composition',
  'colour',
  'light',
  'perspective',
  'drawing',
  'technique',
  'figure',
  'subject',
  'history',
]

function SectionNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('learn.sectionNav')} className="sticky top-[76px] z-30 -mx-1 md:top-[92px]">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-card/85 p-1 shadow-paper backdrop-blur-xl">
        {SECTIONS.map((s) => (
          <li key={s}>
            <a
              href={`#${s}`}
              className="inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {t(`learn.sections.${s}`)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function DailyWidgets() {
  const { t } = useTranslation()
  const L = useL()
  const day = dayKey()
  const artist = ARTISTS[hashString(`artist:${day}`) % ARTISTS.length]
  const fact = ART_FACTS[hashString(`fact:${day}`) % ART_FACTS.length]
  const work = artist.works[0]
  const last = useLearn((s) => s.lastLesson)
  const { data: lessons } = useLessons()
  const lastLesson = lessons?.find((l) => l.slug === last)
  const lastProgress = useLearn((s) => (last ? s.lessons[last] : undefined))
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Link to={`/learn/artists/${artist.slug}`} className="group block">
        <Card className="flex h-full gap-4 p-5 transition-shadow group-hover:shadow-lift">
          <div className="w-28 shrink-0">
            <Frame frameWidth={6} matWidth={6}>
              <div className="aspect-[3/4]">
                <GenerativeArt
                  style={work.genStyle}
                  seed={`${artist.slug}-0`}
                  palette={work.palette.length ? work.palette : undefined}
                  aspect="portrait"
                />
              </div>
            </Frame>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">{t('learn.artistOfDay')}</p>
            <p className="mt-2 font-display text-2xl leading-tight">{artist.name}</p>
            <p className="text-sm text-ink-faint">{artist.years}</p>
            <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{L(artist.bio)}</p>
          </div>
        </Card>
      </Link>
      <Card className="relative overflow-hidden p-5">
        <p className="eyebrow flex items-center gap-2">
          <Lightbulb size={14} /> {t('learn.artFact')}
        </p>
        <p className="mt-3 font-display text-xl leading-snug">{L(fact)}</p>
        <p className="hand absolute bottom-3 right-5 -rotate-3 text-xl text-accent-ink">{t('learn.factNote')}</p>
      </Card>
      <Card className="p-5">
        <p className="eyebrow flex items-center gap-2">
          <BookOpen size={14} /> {t('learn.continue')}
        </p>
        {lastLesson ? (
          <div className="mt-3 flex items-center gap-4">
            <ProgressRing value={lastProgress?.progress ?? 0} size={58} color="var(--viz-3)" label={t('learn.readProgress')}>
              <span className="text-xs font-bold">{Math.round((lastProgress?.progress ?? 0) * 100)}%</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight">{L(lastLesson.title)}</p>
              <Link to={`/learn/lessons/${lastLesson.slug}`} className="link-ink mt-1 inline-flex items-center gap-1 text-sm">
                {t('learn.resume')} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-ink-soft">{t('learn.continueEmpty')}</p>
            <ButtonLink to="/learn/lessons/rule-of-thirds" size="sm" variant="ink" className="mt-3">
              {t('learn.startFirst')}
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  )
}

function Paths() {
  const { t } = useTranslation()
  const L = useL()
  const lessons = useLearn((s) => s.lessons)
  const viewed = useProgress((s) => s.stats.movementsViewed.length)
  const { data } = useLessons()
  const byslug = Object.fromEntries((data ?? []).map((l) => [l.slug, l]))
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TRACKS.map((tr) => {
        const items = tr.lessons
        const done = items.filter((s) => lessons[s]?.completed).length + (tr.movementGoal ? Math.min(viewed, tr.movementGoal) : 0)
        const total = items.length + (tr.movementGoal ?? 0)
        const pct = done / total
        return (
          <Card key={tr.id} className="flex flex-col p-6">
            <div className="flex items-center gap-4">
              <ProgressRing value={pct} size={64} color="var(--viridian)" label={t(`learn.tracks.${tr.id}.name`)}>
                <span className="text-sm font-bold tabular-nums">{Math.round(pct * 100)}%</span>
              </ProgressRing>
              <div>
                <h3 className="font-display text-2xl leading-tight">{t(`learn.tracks.${tr.id}.name`)}</h3>
                <p className="text-sm text-ink-faint">{t('learn.checkpoints', { done, total })}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-soft">{t(`learn.tracks.${tr.id}.desc`)}</p>
            <ol className="mt-4 space-y-1.5">
              {items.map((slug, i) => {
                const ok = lessons[slug]?.completed
                return (
                  <li key={slug}>
                    <Link
                      to={`/learn/lessons/${slug}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-ink/[0.04]"
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                          ok ? 'border-viridian bg-viridian text-white' : 'border-line-strong text-ink-faint',
                        )}
                      >
                        {ok ? <Check size={12} /> : i + 1}
                      </span>
                      <span className={cn(ok ? 'text-ink-faint line-through decoration-ink/30' : 'text-ink')}>
                        {byslug[slug] ? L(byslug[slug].title) : slug}
                      </span>
                    </Link>
                  </li>
                )
              })}
              {tr.movementGoal && (
                <li className="flex items-center gap-3 px-2 py-1.5 text-sm">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                      viewed >= tr.movementGoal ? 'border-viridian bg-viridian text-white' : 'border-line-strong text-ink-faint',
                    )}
                  >
                    <Eye size={12} />
                  </span>
                  {t('learn.visitMovements', { done: Math.min(viewed, tr.movementGoal), goal: tr.movementGoal })}
                </li>
              )}
            </ol>
          </Card>
        )
      })}
    </div>
  )
}

function Timeline() {
  const { t } = useTranslation()
  const L = useL()
  const [zoom, setZoom] = useState(1)
  const viewed = useProgress((s) => s.stats.movementsViewed)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-vermilion" /> {t('learn.timeline.western')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-viridian" /> {t('learn.timeline.global')}
          </span>
        </div>
        <div className="flex gap-1">
          <IconButton
            size="sm"
            variant="paper"
            label={t('learn.timeline.zoomOut')}
            icon={<ZoomOut size={15} />}
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
          />
          <IconButton
            size="sm"
            variant="paper"
            label={t('learn.timeline.zoomIn')}
            icon={<ZoomIn size={15} />}
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
          />
        </div>
      </div>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-6 sm:-mx-0 sm:px-0" tabIndex={0} aria-label={t('learn.sections.timeline')}>
        <ol className="relative flex items-stretch gap-4 pt-10" style={{ width: 'max-content' }}>
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[68px] h-[3px] rounded-full bg-gradient-to-r from-umber/30 via-saffron/60 to-ultramarine/40"
          />
          {TIMELINE.map((m) => (
            <li key={m.slug} style={{ width: 210 * zoom }} className="relative shrink-0">
              <span
                aria-hidden
                className={cn(
                  'absolute left-6 top-[22px] h-4 w-4 rounded-full border-4 border-card',
                  m.tradition === 'western' ? 'bg-vermilion' : 'bg-viridian',
                )}
              />
              <p className="absolute -top-6 left-2 font-display text-sm italic text-ink-faint">
                {m.startYear < 0 ? `${Math.abs(m.startYear).toLocaleString()} BCE` : m.startYear}
              </p>
              <Link
                to={`/learn/movements/${m.slug}`}
                className="group mt-12 block overflow-hidden rounded-2xl border border-line bg-card shadow-paper transition-shadow hover:shadow-lift"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <div className="h-full transition-transform duration-500 group-hover:scale-105">
                    <GenerativeArt style={m.genStyle} seed={m.slug} palette={m.palette} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-display text-lg leading-tight">{L(m.name)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{m.period}</p>
                  {viewed.includes(m.slug) && (
                    <Pill tone="viridian" className="mt-2" icon={<Check size={11} />}>
                      {t('learn.visited')}
                    </Pill>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function LearnHubPage() {
  const { t } = useTranslation()
  const L = useL()
  const lang = useLang()
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('all')
  const { data: forms } = useArtForms()
  const { data: artists } = useArtists()
  const { data: lessons } = useLessons()
  const { data: movements } = useMovements()
  const lessonState = useLearn((s) => s.lessons)
  const bookmarks = useLearn((s) => s.bookmarks)
  const toggleBookmark = useLearn((s) => s.toggleBookmark)
  const formsViewed = useProgress((s) => s.stats.artFormsViewed)
  const { data: glossary } = useGlossary()
  const hits = useMemo(
    () => searchAtlas(q, lang, { artForms: forms ?? [], lessons: lessons ?? [], glossary: glossary ?? [] }),
    [q, lang, forms, lessons, glossary],
  )

  const shownLessons = (lessons ?? []).filter((l) =>
    topic === 'all' ? true : topic === 'saved' ? bookmarks.includes(l.slug) : l.topic === topic,
  )

  return (
    <Page>
      <Washes
        washes={[
          { color: 'var(--saffron)', size: '40vmax', top: '-16%', left: '-12%' },
          { color: 'var(--cerulean)', size: '32vmax', top: '6%', right: '-14%', delay: -7 },
          { color: 'var(--rose)', size: '26vmax', top: '60%', left: '30%', delay: -14 },
        ]}
      />
      <div className="container-art">
        {/* ---------- hero ---------- */}
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="eyebrow flex items-center gap-3">
              <span className="font-display text-base italic tracking-normal text-accent-ink normal-case">03</span>
              <span aria-hidden className="h-px w-10 bg-ink/30" />
              {t('learn.eyebrow')}
            </p>
            <h1 className="display-xl mt-5">
              {t('learn.heroA')} <em>{t('learn.heroB')}</em> <Highlight color="var(--saffron)">{t('learn.heroC')}</Highlight>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              {t('learn.heroLede', {
                forms: forms?.length ?? 20,
                movements: movements?.length ?? 31,
                artists: artists?.length ?? 33,
                lessons: lessons?.length ?? 26,
              })}
            </p>
            <div className="relative mt-8 max-w-xl">
              <SearchBar value={q} onChange={setQ} label={t('learn.search')} placeholder={t('learn.searchPlaceholder')} />
              {q.trim().length >= 2 && (
                <div
                  className="paper absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-96 overflow-y-auto rounded-2xl border border-line p-2 shadow-lift scrollbar-thin"
                  role="listbox"
                  aria-label={t('learn.searchResults')}
                >
                  {hits.length ? (
                    hits.map((h) => (
                      <Link
                        key={h.to}
                        to={h.to}
                        className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-ink/5"
                        role="option"
                        aria-selected={false}
                      >
                        <Pill
                          tone={
                            h.kind === 'lesson'
                              ? 'cerulean'
                              : h.kind === 'artist'
                                ? 'rose'
                                : h.kind === 'movement'
                                  ? 'saffron'
                                  : h.kind === 'term'
                                    ? 'neutral'
                                    : 'viridian'
                          }
                          className="mt-0.5 shrink-0"
                        >
                          {t(`learn.kinds.${h.kind}`)}
                        </Pill>
                        <span className="min-w-0">
                          <span className="block font-medium">{h.title}</span>
                          <span className="block truncate text-sm text-ink-faint">{h.subtitle}</span>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="p-4 text-center text-sm text-ink-faint">{t('learn.noResults')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          {forms && <ArtWheel forms={forms} />}
        </section>

        <div className="mt-16">
          <SectionNav />
        </div>
        <div className="mt-8">
          <DailyWidgets />
        </div>

        {/* ---------- art forms ---------- */}
        <section id="forms" className="scroll-mt-40 pt-20">
          <SectionHeading
            index="i"
            eyebrow={t('learn.sections.forms')}
            title={
              <>
                {t('learn.formsTitleA')} <em>{t('learn.formsTitleB')}</em>
              </>
            }
            lede={t('learn.formsLede')}
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(forms ?? []).map((f, i) => (
              <Reveal key={f.slug} as="li" delay={(i % 4) * 0.05}>
                <Link to={`/learn/art-forms/${f.slug}`} className="group block h-full">
                  <TiltCard className="h-full rounded-[22px]">
                    <article className="paper flex h-full flex-col overflow-hidden rounded-[22px] border border-line shadow-paper transition-shadow group-hover:shadow-lift">
                      <div className="aspect-[4/3] overflow-hidden">
                        <div className="h-full transition-transform duration-500 group-hover:scale-105">
                          <ArtFormCover style={f.coverStyle} palette={f.palette} seed={f.slug} />
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-xl leading-tight">{L(f.name)}</h3>
                          {formsViewed.includes(f.slug) && <Check size={16} className="text-viridian" aria-label={t('learn.visited')} />}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{L(f.definition)}</p>
                        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-ink-faint">
                          <DifficultyDots level={DIFF_LEVEL[f.difficulty]} label={t(`difficulty.${f.difficulty}`)} />
                          {t(`difficulty.${f.difficulty}`)}
                        </div>
                      </div>
                    </article>
                  </TiltCard>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* ---------- timeline ---------- */}
        <section id="timeline" className="scroll-mt-40 pt-24">
          <SectionHeading
            index="ii"
            eyebrow={t('learn.sections.timeline')}
            title={
              <>
                {t('learn.timelineTitleA')} <em>{t('learn.timelineTitleB')}</em>
              </>
            }
            lede={t('learn.timelineLede')}
          />
          <div className="mt-10">
            <Timeline />
          </div>
        </section>

        {/* ---------- artists ---------- */}
        <section id="artists" className="scroll-mt-40 pt-20">
          <SectionHeading
            index="iii"
            eyebrow={t('learn.sections.artists')}
            title={
              <>
                {t('learn.artistsTitleA')} <em>{t('learn.artistsTitleB')}</em>
              </>
            }
            lede={t('learn.artistsLede')}
          />
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {(artists ?? []).map((a, i) => (
              <li key={a.slug}>
                <Link to={`/learn/artists/${a.slug}`} className="group block">
                  <Frame
                    frameWidth={7}
                    matWidth={8}
                    tilt={((i * 13) % 5) - 2}
                    className="transition-transform duration-500 group-hover:-translate-y-1"
                  >
                    <div className="aspect-[3/4]">
                      <GenerativeArt
                        style={a.works[0].genStyle}
                        seed={`${a.slug}-0`}
                        palette={a.works[0].palette.length ? a.works[0].palette : undefined}
                        aspect="portrait"
                      />
                    </div>
                  </Frame>
                  <p className="mt-3 font-display text-lg leading-tight">{a.name}</p>
                  <p className="text-xs text-ink-faint">
                    {a.years} · {L(a.nationality)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- lessons ---------- */}
        <section id="lessons" className="scroll-mt-40 pt-24">
          <SectionHeading
            index="iv"
            eyebrow={t('learn.sections.lessons')}
            title={
              <>
                {t('learn.lessonsTitleA')} <em>{t('learn.lessonsTitleB')}</em>
              </>
            }
            lede={t('learn.lessonsLede')}
          />
          <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('learn.filterTopic')}>
            {TOPICS.map((tp) => (
              <Chip
                key={tp}
                selected={topic === tp}
                onClick={() => setTopic(tp)}
                layoutGroup="topic"
                icon={tp === 'saved' ? <Bookmark size={13} /> : undefined}
              >
                {tp === 'all' ? t('common.all') : tp === 'saved' ? t('learn.saved') : t(`learn.topics.${tp}`)}
              </Chip>
            ))}
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shownLessons.map((l) => {
              const st = lessonState[l.slug]
              const saved = bookmarks.includes(l.slug)
              return (
                <li key={l.slug} className="relative">
                  <Link to={`/learn/lessons/${l.slug}`} className="block h-full">
                    <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-lift">
                      <div className="flex items-center gap-2 text-xs text-ink-faint">
                        <Pill tone="cerulean">{t(`learn.topics.${l.topic}`)}</Pill>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {t('common.minutes', { count: l.minutes })}
                        </span>
                        {st?.completed && (
                          <Pill tone="viridian" icon={<Check size={11} />}>
                            {t('learn.done')}
                          </Pill>
                        )}
                      </div>
                      <h3 className="mt-3 pr-8 font-display text-2xl leading-tight">{L(l.title)}</h3>
                      <p className="mt-2 text-sm text-ink-soft">{L(l.summary)}</p>
                      <div className="mt-auto pt-4">
                        <div className="h-1.5 overflow-hidden rounded-full bg-paper-3">
                          <div className="h-full rounded-full bg-viridian" style={{ width: `${(st?.progress ?? 0) * 100}%` }} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                  <IconButton
                    size="sm"
                    className="absolute right-3 top-3"
                    label={saved ? t('learn.unbookmark') : t('learn.bookmark')}
                    icon={saved ? <BookmarkCheck size={16} className="text-accent-ink" /> : <Bookmark size={16} />}
                    onClick={() => toggleBookmark(l.slug)}
                  />
                </li>
              )
            })}
            {shownLessons.length === 0 && <li className="col-span-full py-10 text-center text-ink-faint">{t('learn.noSaved')}</li>}
          </ul>
        </section>

        {/* ---------- tools ---------- */}
        <section id="tools" className="scroll-mt-40 pt-24">
          <SectionHeading
            index="v"
            eyebrow={t('learn.sections.tools')}
            title={
              <>
                {t('learn.toolsTitleA')} <em>{t('learn.toolsTitleB')}</em>
              </>
            }
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: '/learn/color-lab', icon: Palette, key: 'colorLab', tone: 'var(--rose)' },
              { to: '/learn/glossary', icon: Type, key: 'glossary', tone: 'var(--cerulean)' },
              { to: '/learn/flashcards', icon: GalleryVerticalEnd, key: 'flashcards', tone: 'var(--viridian)' },
              { to: '/learn/spot-the-style', icon: Eye, key: 'spot', tone: 'var(--saffron)' },
            ].map(({ to, icon: Icon, key, tone }) => (
              <Link key={key} to={to} className="group block">
                <Card className="relative h-full overflow-hidden p-6 transition-shadow group-hover:shadow-lift">
                  <span
                    aria-hidden
                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-transform duration-500 group-hover:scale-125"
                    style={{ background: tone }}
                  />
                  <Icon size={28} style={{ color: tone }} />
                  <h3 className="mt-4 font-display text-2xl">{t(`learn.tools.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{t(`learn.tools.${key}.body`)}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
                    {t('learn.open')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- paths ---------- */}
        <section id="paths" className="scroll-mt-40 pt-24">
          <SectionHeading
            index="vi"
            eyebrow={t('learn.sections.paths')}
            title={
              <>
                {t('learn.pathsTitleA')} <em>{t('learn.pathsTitleB')}</em>
              </>
            }
            lede={t('learn.pathsLede')}
            note={
              <span className="inline-flex items-center gap-1">
                <Sparkles size={16} /> {t('learn.pathsNote')}
              </span>
            }
          />
          <div className="mt-10">
            <Paths />
          </div>
        </section>
        <p className="mt-16 flex items-center justify-center gap-2 text-sm text-ink-faint">
          <Shapes size={14} /> {t('learn.footerNote')}
        </p>
      </div>
    </Page>
  )
}
