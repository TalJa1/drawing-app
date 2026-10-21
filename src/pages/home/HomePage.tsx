import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BookOpen, Brush, Flame, GalleryVerticalEnd, Layers, MessageCircle, Palette, Send, Shapes, Sparkles, Star, Trophy, WandSparkles } from 'lucide-react'
import type { GenStyle } from '@/types'
import { ButtonLink, Button } from '@/components/Button'
import { Magnetic } from '@/components/Magnetic'
import { Frame, WallLabel } from '@/components/Frame'
import { Card } from '@/components/Card'
import { Reveal, SectionHeading, Marquee } from '@/components/Layout'
import { CountUp, Meter, ProgressRing } from '@/components/Progress'
import { Avatar } from '@/components/Avatar'
import { StreakFlame } from '@/components/Gamification'
import { DrawnStroke, Highlight } from '@/components/art/Brush'
import { PaintSplatter } from '@/components/art/Splatter'
import { Washes } from '@/components/art/Washes'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { HeroDoodle } from '@/features/home/HeroDoodle'
import { RankStamp } from '@/features/practice/ResultParts'
import { BadgeMedal } from '@/features/gamification/BadgeMedal'
import { LessonDiagram } from '@/features/learn/LessonDiagram'
import { ChatCardView } from '@/features/chat/ChatCards'
import { TemplateImage } from '@/features/practice/TemplateCard'
import { BADGE_MAP } from '@/mocks/badges'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { TESTIMONIALS } from '@/mocks/palettes'
import { useL } from '@/i18n/useL'
import { colouriseTemplate } from '@/lib/raster'
import { seeded } from '@/lib/random'
import { cn, svgToDataUrl } from '@/lib/utils'
import { toast } from '@/store/ui'
import { useReducedMotion } from '@/app/theme'
import { preloadRoute } from '@/app/routes'

/** Hand-picked fills (document order) so showcase pieces look intentional. */
const HAND_COLOURED: Record<string, string[]> = {
  fox: ['#E4572E', '#F6F1E7', '#E4572E', '#F6F1E7', '#F6F1E7', '#F6F1E7', '#E4572E', '#4A3426', '#4A3426', '#F6F1E7'],
}

function colouredTemplate(id: string, seed: string, coverage = 1) {
  const t = TEMPLATE_MAP[id]
  return svgToDataUrl(colouriseTemplate(t.svg, t.suggestedPalette, seeded(seed), coverage, HAND_COLOURED[id]))
}

/* ---------------- hero ---------------- */

function Hero() {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y1 = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -140])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -60])
  const y3 = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -220])
  const fox = useMemo(() => colouredTemplate('fox', 'hero-fox'), [])

  return (
    <section ref={ref} className="relative isolate overflow-hidden pb-24 pt-32 md:pt-40">
      <Washes />
      <PaintSplatter seed="hero-a" color="var(--vermilion)" className="absolute -left-10 top-24 h-48 w-48 opacity-25" />
      <PaintSplatter seed="hero-b" color="var(--cerulean)" className="absolute bottom-10 right-[38%] h-36 w-36 opacity-20" />
      <div className="container-art grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative">
          <p className="eyebrow flex items-center gap-3">
            <Sparkles size={14} className="text-accent-ink" /> {t('home.eyebrow')}
          </p>
          <h1 className="display-xl mt-6">
            {t('home.h1a')} <Highlight color="var(--saffron)">{t('home.h1b')}</Highlight>
            <br />
            <em>{t('home.h1c')}</em>
          </h1>
          <DrawnStroke className="-mt-2 h-14 w-72 sm:w-96" />
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">{t('home.lede')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Magnetic>
              <ButtonLink to="/practice" variant="pigment" size="lg" icon={<Brush size={19} />}>
                {t('home.ctaDraw')}
              </ButtonLink>
            </Magnetic>
            <Magnetic>
              <ButtonLink to="/learn" variant="outline" size="lg" iconRight={<ArrowRight size={18} />}>
                {t('home.ctaLearn')}
              </ButtonLink>
            </Magnetic>
          </div>
          <div className="mt-10 flex items-center gap-4 text-sm text-ink-faint">
            <div className="flex -space-x-2">
              {['mai', 'theo', 'linh', 'sam-k'].map((s) => (
                <Avatar key={s} seed={s} size={34} ring />
              ))}
            </div>
            <p>{t('home.social')}</p>
          </div>
        </div>

        <div className="relative h-[460px] sm:h-[520px]">
          <motion.div style={{ y: y1 }} className="absolute right-0 top-0 w-[62%]">
            <div className="float-y" style={{ '--r': '3deg', '--d': '7s' } as React.CSSProperties}>
              <Frame tone="gold" frameWidth={12} matWidth={12}>
                <div className="aspect-[4/3]">
                  <img src={fox} alt={t('home.heroArtAlt')} className="h-full w-full object-contain" />
                </div>
              </Frame>
            </div>
          </motion.div>
          <motion.div style={{ y: y2 }} className="absolute left-0 top-[18%] w-[44%]">
            <div className="float-y" style={{ '--r': '-5deg', '--d': '8s' } as React.CSSProperties}>
              <Frame frameWidth={9} matWidth={9}>
                <div className="aspect-[3/4]">
                  <GenerativeArt style="ukiyoe" seed="hero-wave" aspect="portrait" />
                </div>
              </Frame>
            </div>
          </motion.div>
          <motion.div style={{ y: y3 }} className="absolute bottom-0 right-[8%] w-[56%]">
            <div className="paper rounded-[22px] border border-line p-2 shadow-lift" style={{ transform: 'rotate(-1.5deg)' }}>
              <HeroDoodle className="aspect-[16/9]" />
            </div>
            <p className="hand absolute -left-24 top-6 hidden -rotate-6 text-xl text-accent-ink sm:block">
              {t('home.doodleArrow')}
              <svg viewBox="0 0 80 30" className="ml-10 mt-1 h-6 w-16" aria-hidden>
                <path d="M2 6 C 30 4 50 10 74 24 M74 24 l-10 -1 M74 24 l-3 -9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- how it works ---------------- */

const STEP_ICONS = [Shapes, Brush, WandSparkles, Star, Sparkles]

function HowItWorks() {
  const { t } = useTranslation()
  const steps = t('home.steps', { returnObjects: true }) as { title: string; body: string }[]
  const colours = ['var(--vermilion)', 'var(--saffron)', 'var(--viridian)', 'var(--cerulean)', 'var(--rose)']
  return (
    <section className="container-art py-24">
      <SectionHeading index="01" eyebrow={t('home.howEyebrow')} title={<>{t('home.howTitleA')} <em>{t('home.howTitleB')}</em></>} lede={t('home.howLede')} />
      <ol className="relative mt-14 grid gap-8 md:grid-cols-5 md:gap-4">
        <svg aria-hidden className="draw-in pointer-events-none absolute left-0 top-9 hidden h-8 w-full md:block" viewBox="0 0 1000 30" preserveAspectRatio="none">
          <path d="M40 15 C 200 0 300 30 500 15 S 800 0 960 15" fill="none" stroke="var(--line-strong)" strokeWidth="2.5" strokeDasharray="0" style={{ ['--len' as string]: 1000 }} />
        </svg>
        {steps.map((s, i) => {
          const Icon = STEP_ICONS[i]
          return (
            <Reveal key={s.title} as="li" delay={i * 0.12} className="relative">
              <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-card shadow-lift md:mx-0" style={{ background: colours[i] }}>
                <Icon size={28} className="text-white" />
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-sm text-paper">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-center font-display text-2xl md:text-left">{s.title}</h3>
              <p className="mt-2 text-center text-ink-soft md:text-left">{s.body}</p>
            </Reveal>
          )
        })}
      </ol>
    </section>
  )
}

/* ---------------- feature showcase ---------------- */

const FEATURES = [
  { key: 'practice', to: '/practice', icon: Shapes },
  { key: 'freeDraw', to: '/free-draw', icon: Brush },
  { key: 'learn', to: '/learn', icon: BookOpen },
  { key: 'chat', to: '/chat', icon: MessageCircle },
  { key: 'collection', to: '/collection', icon: GalleryVerticalEnd },
] as const

function FeatureMock({ k }: { k: (typeof FEATURES)[number]['key'] }) {
  const { t } = useTranslation()
  const L = useL()
  if (k === 'practice')
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {['sunflower', 'koi', 'mandala-lotus', 'lighthouse', 'cat', 'pho'].map((id, i) => (
          <div key={id} className="overflow-hidden rounded-xl border-[5px] border-[var(--mat)] bg-white shadow-paper">
            <div className="aspect-[4/3] p-1">
              <TemplateImage template={TEMPLATE_MAP[id]} />
            </div>
            <p className="truncate px-1.5 pb-1 font-display text-[11px]">{L(TEMPLATE_MAP[id].title)}</p>
            {i === 0 && <span className="sr-only">{t('practice.daily.badge')}</span>}
          </div>
        ))}
      </div>
    )
  if (k === 'freeDraw')
    return (
      <div className="flex gap-3 p-4">
        <div className="paper flex flex-col gap-2 rounded-2xl border border-line p-2 shadow-paper">
          {[Brush, Palette, Layers, Shapes, Sparkles].map((I, i) => (
            <span key={i} className={cn('flex h-9 w-9 items-center justify-center rounded-xl', i === 0 ? 'bg-ink text-paper' : 'text-ink-soft')}>
              <I size={16} />
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-hidden rounded-xl bg-white shadow-paper">
          <GenerativeArt style="impressionist" seed="mock-free" />
        </div>
        <div className="hidden w-24 flex-col gap-2 sm:flex">
          {['#E4572E', '#F2A93B', '#2E8B6F', '#2F80C4', '#C93C6B', '#3A3FA8'].map((c) => (
            <span key={c} className="h-6 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    )
  if (k === 'learn')
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-3 shadow-paper">
          <LessonDiagram kind="thirds" />
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 shadow-paper">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('learn.topics.composition')}</p>
          <p className="mt-2 font-display text-xl leading-tight">{t('home.mock.lessonTitle')}</p>
          <div className="mt-4 space-y-2">
            {[t('home.mock.q1'), t('home.mock.q2')].map((q, i) => (
              <div key={q} className={cn('rounded-xl border px-3 py-2 text-xs', i === 1 ? 'border-viridian bg-viridian/12' : 'border-line')}>
                {q}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  if (k === 'chat')
    return (
      <div className="space-y-3 p-4">
        <div className="ml-auto w-fit rounded-[18px] rounded-tr-md bg-ink px-4 py-2 text-sm text-paper">{t('home.mock.chatQ')}</div>
        <div className="w-fit max-w-[90%] rounded-[18px] rounded-tl-md border border-line bg-card px-4 py-2 text-sm text-ink-soft">{t('home.mock.chatA')}</div>
        <ChatCardView card={{ type: 'palette', name: t('home.mock.chatPalette'), colors: ['#1F8A8A', '#E4572E', '#F2A93B', '#F6F1E7', '#1B1A17'] }} />
      </div>
    )
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['impressionist', 92],
          ['folk', 81],
          ['lacquer', 88],
        ].map(([s, score]) => (
          <div key={s as string}>
            <div className={cn('frame', (score as number) >= 85 && 'frame-gold')} style={{ '--frame-w': '5px' } as React.CSSProperties}>
              <div className="mat" style={{ '--mat-w': '5px' } as React.CSSProperties}>
                <div className="art aspect-[4/3]">
                  <GenerativeArt style={s as GenStyle} seed={`mock-${s}`} />
                </div>
              </div>
            </div>
            <p className="mt-1 text-right text-[11px] font-bold tabular-nums">{score}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          [t('collection.statArtworks'), '24'],
          [t('collection.statAverage'), '84'],
          [t('collection.statStreak'), '9'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-card p-2">
            <p className="text-[10px] text-ink-faint">{l}</p>
            <p className="font-display text-xl">{v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Features() {
  const { t } = useTranslation()
  const [active, setActive] = useState<(typeof FEATURES)[number]['key']>('practice')
  return (
    <section className="relative py-24">
      <div className="container-art">
        <SectionHeading index="02" eyebrow={t('home.featuresEyebrow')} title={<>{t('home.featuresTitleA')} <em>{t('home.featuresTitleB')}</em></>} />
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1.25fr]">
          <ul className="space-y-2">
            {FEATURES.map(({ key, to, icon: Icon }, i) => (
              <li key={key}>
                <Link
                  to={to}
                  onMouseEnter={() => {
                    setActive(key)
                    preloadRoute(to)
                  }}
                  onFocus={() => setActive(key)}
                  className={cn('group flex items-start gap-4 rounded-[22px] border p-5 transition-all duration-300', active === key ? 'border-line bg-card shadow-paper' : 'border-transparent hover:bg-ink/[0.03]')}
                >
                  <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors', active === key ? 'bg-ink text-paper' : 'bg-ink/[0.06] text-ink')}>
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-display text-2xl">
                      <span className="text-sm italic text-accent-ink">0{i + 1}</span> {t(`home.features.${key}.title`)}
                    </span>
                    <span className="mt-1 block text-ink-soft">{t(`home.features.${key}.body`)}</span>
                  </span>
                  <ArrowRight size={18} className={cn('ml-auto mt-3 shrink-0 transition-transform', active === key ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0')} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative">
            <Frame frameWidth={14} matWidth={10} tilt={-1}>
              <div className="relative min-h-[320px] bg-paper-2 sm:min-h-[360px]">
                <AnimatePresence mode="wait">
                  <motion.div key={active} initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
                    <FeatureMock k={active} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </Frame>
            <p className="hand absolute -bottom-10 right-4 rotate-2 text-xl text-accent-ink">{t('home.featuresNote')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- AI judge preview ---------------- */

function JudgePreview() {
  const { t } = useTranslation()
  const cat = useMemo(() => colouredTemplate('mushroom-house', 'judge-demo'), [])
  return (
    <section className="relative overflow-hidden bg-[#141210] py-24 text-[#f6f1e7]">
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(50% 60% at 30% 40%, rgba(242,169,59,0.16), transparent 70%)' }} />
      <div className="container-art relative grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Frame tone="gold" frameWidth={16} matWidth={16} tilt={-1.5}>
            <div className="aspect-[4/3]">
              <img src={cat} alt={t('home.judgeArtAlt')} className="h-full w-full object-contain" />
            </div>
          </Frame>
        </Reveal>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F2A93B]">03 — {t('home.judgeEyebrow')}</p>
          <h2 className="display-lg mt-4 text-[#f6f1e7]">
            {t('home.judgeTitleA')} <em>{t('home.judgeTitleB')}</em>
          </h2>
          <p className="mt-4 max-w-lg text-[#f6f1e7]/75">{t('home.judgeLede')}</p>
          <div className="mt-8 flex items-end gap-6">
            <p className="gold-text font-display text-8xl leading-none">
              <CountUp to={91} duration={2} />
            </p>
            <RankStamp rank="masterpiece" label={t('result.rank.masterpiece')} ringText={t('result.stampRing')} />
          </div>
          <div className="mt-8 grid max-w-md gap-4 [&_*]:!text-[#f6f1e7]">
            <Meter value={93} label={t('result.similarity')} color="#7a7fe6" />
            <Meter value={88} label={t('result.colour')} color="#1fa596" />
          </div>
          <p className="hand mt-8 max-w-md -rotate-1 text-2xl text-[#F2A93B]">“{t('home.judgeQuote')}”</p>
        </div>
      </div>
    </section>
  )
}

/* ---------------- gamification ---------------- */

function Gamify() {
  const { t } = useTranslation()
  const ids = ['first-stroke', 'hot-streak', 'colour-whisperer', 'time-traveller', 'ten-masterpieces', 'week-warrior']
  return (
    <section className="container-art py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading index="04" eyebrow={t('home.gameEyebrow')} title={<>{t('home.gameTitleA')} <em>{t('home.gameTitleB')}</em></>} lede={t('home.gameLede')} />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {(t('home.gamePoints', { returnObjects: true }) as string[]).map((p, i) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-deep dark:text-gold">{[<Flame key="f" size={13} />, <Trophy key="t" size={13} />, <Star key="s" size={13} />, <Sparkles key="sp" size={13} />][i % 4]}</span>
                <span className="text-ink-soft">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-[420px]">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <ProgressRing value={0.72} size={210} stroke={12} color="var(--gold)" label={t('home.xpRing')}>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">{t('gamification.levelShort')}</p>
                <p className="font-display text-6xl leading-none">7</p>
                <p className="text-xs text-ink-faint">{t('home.rankSample')}</p>
              </div>
            </ProgressRing>
          </div>
          {ids.map((id, i) => {
            const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2
            return (
              <div key={id} className="float-y absolute" style={{ left: `calc(50% + ${Math.cos(a) * 42}% - 36px)`, top: `calc(50% + ${Math.sin(a) * 40}% - 36px)`, '--d': `${5 + i}s`, '--r': `${(i % 2 ? 1 : -1) * 8}deg` } as React.CSSProperties}>
                <BadgeMedal badge={BADGE_MAP[id]} unlocked size={72} />
              </div>
            )
          })}
          <div className="absolute right-4 top-2 rounded-2xl bg-card px-4 py-3 shadow-lift">
            <StreakFlame count={12} size={30} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- gallery wall ---------------- */

const WALL: ({ gen: GenStyle } | { tpl: string })[] = [
  { gen: 'impressionist' },
  { tpl: 'koi' },
  { gen: 'ukiyoe' },
  { tpl: 'mandala-lotus' },
  { gen: 'lacquer' },
  { gen: 'cubist' },
  { tpl: 'lighthouse' },
  { gen: 'folk' },
  { gen: 'pointillist' },
  { tpl: 'teapot' },
  { gen: 'dots' },
  { gen: 'abstract' },
]

function GalleryWall() {
  const { t } = useTranslation()
  const items = useMemo(
    () => WALL.map((w, i) => ('tpl' in w ? { kind: 'tpl' as const, src: colouredTemplate(w.tpl, `wall-${i}`), key: w.tpl } : { kind: 'gen' as const, style: w.gen, key: w.gen })),
    [],
  )
  return (
    <section className="relative py-24">
      <div className="container-art">
        <SectionHeading index="05" eyebrow={t('home.wallEyebrow')} title={<>{t('home.wallTitleA')} <em>{t('home.wallTitleB')}</em></>} lede={t('home.wallLede')} align="center" />
        <ul className="mt-14 columns-2 gap-6 md:columns-3 lg:columns-4">
          {items.map((it, i) => (
            <Reveal key={it.key + i} as="li" delay={(i % 4) * 0.06} className="mb-6 break-inside-avoid">
              <Frame frameWidth={8} matWidth={8} tone={i % 5 === 0 ? 'gold' : i % 3 === 0 ? 'light' : 'wood'} tilt={((i * 17) % 5) - 2} label={<WallLabel title={t(`home.wallLabels.${i % 6}`)} lines={[t('home.sampleArtwork')]} />}>
                <div className={i % 3 === 1 ? 'aspect-[3/4]' : 'aspect-[4/3]'}>
                  {it.kind === 'tpl' ? <img src={it.src} alt="" className="h-full w-full object-contain" /> : <GenerativeArt style={it.style} seed={`wall-${i}`} aspect={i % 3 === 1 ? 'portrait' : 'landscape'} />}
                </div>
              </Frame>
            </Reveal>
          ))}
        </ul>
      </div>
      <Marquee className="mt-16 border-y border-line py-5" duration={50}>
        {['Impressionism', 'Đông Hồ', 'Ukiyo-e', 'Sơn mài', 'Cubism', 'Fauvism', 'Pop Art', 'Pointillism', 'Surrealism', 'Mexican Muralism', 'Chinese ink'].map((m) => (
          <span key={m} className="mx-8 inline-flex items-center gap-8 font-display text-3xl italic text-ink-soft">
            {m} <span className="text-accent-ink not-italic">✦</span>
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ---------------- testimonials + CTA ---------------- */

function Testimonials() {
  const { t } = useTranslation()
  const L = useL()
  return (
    <section className="container-art py-24">
      <SectionHeading index="06" eyebrow={t('home.voicesEyebrow')} title={<>{t('home.voicesTitleA')} <em>{t('home.voicesTitleB')}</em></>} note={t('home.voicesNote')} />
      <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TESTIMONIALS.map((v, i) => (
          <Reveal key={v.name} as="li" delay={i * 0.08}>
            <Card className={cn('h-full p-6', i % 2 && 'lg:translate-y-8')}>
              <span className="font-display text-6xl leading-none text-saffron">“</span>
              <blockquote className="-mt-4 text-ink-soft">{L(v.quote)}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <Avatar seed={v.avatarSeed} size={40} />
                <span>
                  <span className="block font-semibold">{v.name}</span>
                  <span className="block text-xs text-ink-faint">{L(v.role)}</span>
                </span>
              </figcaption>
              <span className="mt-4 inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{t('common.sample')}</span>
            </Card>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function FinalCta() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr(t('auth.errors.emailInvalid'))
      return
    }
    setErr(null)
    setEmail('')
    toast({ title: t('home.newsletterThanks'), description: t('home.newsletterNote'), tone: 'success' })
  }
  return (
    <section className="container-art pb-16">
      <div className="relative isolate overflow-hidden rounded-[36px] bg-[#1b1a17] px-6 py-16 text-center text-[#f6f1e7] sm:px-12 sm:py-24">
        <Washes washes={[{ color: '#E4572E', size: '30rem', top: '-30%', left: '-10%' }, { color: '#2F80C4', size: '26rem', bottom: '-40%', right: '-5%', delay: -6 }, { color: '#F2A93B', size: '22rem', top: '10%', right: '30%', delay: -12 }]} />
        <h2 className="display-lg mx-auto max-w-3xl text-[#f6f1e7]">
          {t('home.finalA')} <em>{t('home.finalB')}</em>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[#f6f1e7]/75">{t('home.finalLede')}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <ButtonLink to="/practice" variant="gold" size="lg" icon={<Brush size={19} />}>
            {t('home.ctaDraw')}
          </ButtonLink>
          <ButtonLink to="/free-draw" variant="outline" size="lg" className="!border-white/30 !text-[#f6f1e7] hover:!bg-white/10">
            {t('home.ctaFree')}
          </ButtonLink>
        </div>
        <form onSubmit={submit} className="mx-auto mt-12 flex max-w-md flex-col gap-2 sm:flex-row" noValidate>
          <label htmlFor="newsletter" className="sr-only">
            {t('home.newsletterLabel')}
          </label>
          <input
            id="newsletter"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('home.newsletterPlaceholder')}
            aria-invalid={!!err}
            aria-describedby={err ? 'newsletter-err' : undefined}
            className="h-12 flex-1 rounded-full border border-white/20 bg-white/10 px-5 text-[#f6f1e7] placeholder:text-[#f6f1e7]/50 focus:border-[#F2A93B]"
          />
          <Button type="submit" variant="paper" size="md" className="!h-12" icon={<Send size={16} />}>
            {t('home.newsletterButton')}
          </Button>
        </form>
        {err && (
          <p id="newsletter-err" role="alert" className="mt-2 text-sm text-[#F48A69]">
            {err}
          </p>
        )}
        <p className="hand mt-4 text-lg text-[#F2A93B]">{t('home.newsletterHand')}</p>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <JudgePreview />
      <Gamify />
      <GalleryWall />
      <Testimonials />
      <FinalCta />
    </>
  )
}
