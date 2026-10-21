import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Brush, Heart, Palette, Sparkles, Trash2 } from 'lucide-react'
import { Page, SectionHeading, EmptyState, Marquee, Reveal } from '@/components/Layout'
import { Button, ButtonLink } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { TiltCard } from '@/components/Card'
import { Frame, WallLabel } from '@/components/Frame'
import { Chip, DifficultyDots, Pill } from '@/components/Chip'
import { Tabs } from '@/components/Tabs'
import { Modal, Sheet } from '@/components/Modal'
import { Tooltip } from '@/components/Tooltip'
import { CountUp, Meter, ProgressRing, Skeleton } from '@/components/Progress'
import { SearchBar, Select, Slider, Switch, TextField } from '@/components/Form'
import { BrushDivider, DrawnStroke, Highlight } from '@/components/art/Brush'
import { PaintSplatter } from '@/components/art/Splatter'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { Avatar } from '@/components/Avatar'
import { StreakFlame, XPBar, XPRing } from '@/components/Gamification'
import { LanguageSwitch, ThemeToggle } from '@/components/nav/Toggles'
import { BadgeMedal } from '@/features/gamification/BadgeMedal'
import { BADGES } from '@/mocks/badges'
import { toast } from '@/store/ui'
import { burst } from '@/lib/confetti'
import type { GenStyle } from '@/types'

const PIGMENTS = [
  ['vermilion', '#E4572E'],
  ['saffron', '#F2A93B'],
  ['viridian', '#2E8B6F'],
  ['cerulean', '#2F80C4'],
  ['ultramarine', '#3A3FA8'],
  ['rose', '#C93C6B'],
  ['ochre', '#C98B2B'],
  ['umber', '#4A3426'],
  ['ivory', '#F6F1E7'],
  ['ink', '#1B1A17'],
  ['gold', '#D4AF37'],
] as const

const STYLES: GenStyle[] = [
  'impressionist', 'pointillist', 'cubist', 'abstract', 'pop', 'minimal', 'surreal', 'ukiyoe', 'expressionist', 'renaissance',
  'geometric', 'dots', 'ink', 'lacquer', 'folk', 'baroque', 'cave', 'mosaic', 'fauve', 'digital',
]

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="eyebrow mb-6">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a')
  const [modal, setModal] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [chip, setChip] = useState('one')
  const [slider, setSlider] = useState(40)
  const [sw, setSw] = useState(true)
  const [q, setQ] = useState('')

  return (
    <Page>
      <div className="container-art">
        <SectionHeading
          index="00"
          eyebrow={t('styleguide.eyebrow')}
          title={
            <>
              {t('styleguide.titleA')} <em>{t('styleguide.titleB')}</em>
            </>
          }
          lede={t('styleguide.lede')}
          note={t('styleguide.note')}
        />

        <Block title={t('styleguide.pigments')}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {PIGMENTS.map(([name, hex]) => (
              <li key={name} className="overflow-hidden rounded-2xl border border-line">
                <div className="h-20" style={{ background: hex }} />
                <div className="p-3">
                  <p className="font-display text-lg capitalize">{name}</p>
                  <p className="font-mono text-xs text-ink-faint">{hex}</p>
                </div>
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t('styleguide.type')}>
          <p className="display-xl">
            Draw. Colour. <em>Inspire.</em>
          </p>
          <p className="display-lg mt-6">
            The living <Highlight>gallery</Highlight>
          </p>
          <p className="display-md mt-6">
            Editorial serif, <em>soft italics</em>
          </p>
          <p className="prose-art mt-6 max-w-2xl">{t('styleguide.body')}</p>
          <p className="hand mt-4 text-3xl text-accent-ink">{t('styleguide.hand')}</p>
          <DrawnStroke className="mt-4 h-16 w-80" />
        </Block>

        <Block title={t('styleguide.buttons')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ink" icon={<Brush size={18} />}>Ink</Button>
            <Button variant="pigment">Pigment</Button>
            <Button variant="gold" icon={<Sparkles size={18} />}>Gold</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="paper">Paper</Button>
            <Button variant="ink" size="sm">Small</Button>
            <Button variant="pigment" size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink to="/practice" variant="outline">Link</ButtonLink>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <IconButton label="Brush" icon={<Brush size={18} />} shortcut="B" />
            <IconButton label="Palette" icon={<Palette size={18} />} active />
            <IconButton label="Favourite" icon={<Heart size={18} />} variant="paper" />
            <IconButton label="Delete" icon={<Trash2 size={18} />} variant="ink" />
            <Tooltip label={t('styleguide.tooltip')}>
              <span tabIndex={0} className="rounded-full border border-dashed border-line-strong px-3 py-1.5 text-sm">
                {t('styleguide.hoverMe')}
              </span>
            </Tooltip>
          </div>
        </Block>

        <Block title={t('styleguide.chips')}>
          <div className="flex flex-wrap gap-2">
            {['one', 'two', 'three'].map((c) => (
              <Chip key={c} selected={chip === c} onClick={() => setChip(c)} layoutGroup="sg">
                {c}
              </Chip>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(['neutral', 'vermilion', 'viridian', 'cerulean', 'saffron', 'rose', 'gold', 'ultramarine'] as const).map((tone) => (
              <Pill key={tone} tone={tone}>
                {tone}
              </Pill>
            ))}
            <DifficultyDots level={2} label="Intermediate" />
            <DifficultyDots level={4} label="Master" />
          </div>
          <Tabs
            className="mt-6"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'a', label: 'Practice', count: 4 },
              { id: 'b', label: 'Free draw' },
              { id: 'c', label: 'Favourites' },
            ]}
          />
        </Block>

        <Block title={t('styleguide.forms')}>
          <div className="grid gap-6 md:grid-cols-2">
            <Slider label="Brush size" value={slider} onChange={setSlider} format={(v) => `${v}px`} />
            <Switch checked={sw} onChange={setSw} label="Pressure sensitivity" description="Use pen pressure when available" />
            <Select label="Sort by" defaultValue="new">
              <option value="new">Newest</option>
              <option value="popular">Popular</option>
            </Select>
            <TextField label="Display name" placeholder="Your artist name" hint="Shown on the leaderboard" />
            <SearchBar value={q} onChange={setQ} label="Search" placeholder="Search templates…" className="md:col-span-2" />
          </div>
        </Block>

        <Block title={t('styleguide.frames')}>
          <div className="grid gap-10 sm:grid-cols-3">
            <Frame label={<WallLabel title="Morning Harbour" lines={['Impressionism · Sample', 'Score 88']} />}>
              <div className="aspect-[4/3]">
                <GenerativeArt style="impressionist" seed="sg1" />
              </div>
            </Frame>
            <Frame tone="gold" label={<WallLabel title="Masterpiece" lines={['Gold frame']} />}>
              <div className="aspect-[4/3]">
                <GenerativeArt style="ukiyoe" seed="sg2" />
              </div>
            </Frame>
            <TiltCard>
              <Frame tone="light" label={<WallLabel title="Tilt me" lines={['3D hover']} />}>
                <div className="aspect-[4/3]">
                  <GenerativeArt style="abstract" seed="sg3" />
                </div>
              </Frame>
            </TiltCard>
          </div>
        </Block>

        <Block title={t('styleguide.generative')}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {STYLES.map((s) => (
              <li key={s}>
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line">
                  <GenerativeArt style={s} seed={s} />
                </div>
                <p className="mt-1.5 text-sm capitalize text-ink-soft">{s}</p>
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t('styleguide.feedback')}>
          <div className="flex flex-wrap items-center gap-8">
            <ProgressRing value={0.72} size={84} label="72%">
              <span className="font-display text-xl">72</span>
            </ProgressRing>
            <div className="w-64 space-y-4">
              <Meter value={82} label="Similarity" color="var(--cerulean)" />
              <Meter value={67} label="Colour" color="var(--rose)" />
            </div>
            <p className="font-display text-6xl">
              <CountUp to={94} />
            </p>
            <StreakFlame count={7} size={32} />
            <StreakFlame count={0} size={32} />
            <XPRing size={64} />
            <div className="w-56">
              <XPBar />
            </div>
            <Avatar seed="ada" size={56} />
            <Avatar seed="hokusai" size={56} />
            <Avatar seed="frida" size={56} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast({ title: 'Saved to your gallery', tone: 'success' })}>Toast</Button>
            <Button variant="outline" onClick={() => toast({ title: 'Masterpiece!', description: 'Gold tone toast', tone: 'gold' })}>Gold toast</Button>
            <Button variant="outline" onClick={() => setModal(true)}>Modal</Button>
            <Button variant="outline" onClick={() => setSheet(true)}>Sheet</Button>
            <Button variant="gold" onClick={() => burst(0.5, 0.6, true)}>Confetti</Button>
          </div>
        </Block>

        <Block title={t('styleguide.badges')}>
          <div className="flex flex-wrap gap-6">
            {(['common', 'rare', 'epic', 'legendary'] as const).map((r) => {
              const b = BADGES.find((x) => x.rarity === r)!
              return <BadgeMedal key={r} badge={b} unlocked />
            })}
            <BadgeMedal badge={BADGES[0]} unlocked={false} />
            <BadgeMedal badge={BADGES.find((b) => b.secret)!} unlocked={false} />
          </div>
        </Block>

        <Block title={t('styleguide.decor')}>
          <div className="relative flex items-center gap-8">
            <PaintSplatter seed="a" className="h-32 w-32" />
            <PaintSplatter seed="b" color="var(--cerulean)" className="h-32 w-32" />
            <PaintSplatter seed="c" color="var(--saffron)" className="h-32 w-32" />
            <LanguageSwitch />
            <ThemeToggle />
          </div>
          <BrushDivider className="mt-6" />
          <Marquee className="mt-6 py-3">
            {['Impressionism', 'Ukiyo-e', 'Sơn mài', 'Cubism', 'Pop Art', 'Bauhaus'].map((m) => (
              <span key={m} className="mx-6 font-display text-3xl italic">
                {m} <span className="text-accent-ink">✦</span>
              </span>
            ))}
          </Marquee>
          <Reveal>
            <EmptyState title="Every masterpiece begins with one brave line." body="Empty state sample." note="go on…" />
          </Reveal>
        </Block>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="A modal" description="Focus is trapped, Escape closes.">
        <Button onClick={() => setModal(false)}>{t('common.close')}</Button>
      </Modal>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="A sheet">
        <p className="text-ink-soft">Bottom sheet on mobile.</p>
      </Sheet>
    </Page>
  )
}
