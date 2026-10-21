import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Quote } from 'lucide-react'
import { Page, Reveal, EmptyState } from '@/components/Layout'
import { Frame, WallLabel } from '@/components/Frame'
import { ButtonLink } from '@/components/Button'
import { Pill } from '@/components/Chip'
import { Skeleton } from '@/components/Progress'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { Avatar } from '@/components/Avatar'
import { useArtist } from '@/api/queries'
import { MOVEMENT_MAP } from '@/mocks/movements'
import { ARTISTS } from '@/mocks/artists'
import { useViewed } from '@/features/learn/useViewed'
import { useL } from '@/i18n/useL'

export default function ArtistPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const L = useL()
  const { data: a, isLoading, isError } = useArtist(slug)
  useViewed('artist', a?.slug)

  if (isLoading)
    return (
      <Page>
        <div className="container-art">
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </Page>
    )
  if (isError || !a)
    return (
      <Page>
        <EmptyState title={t('learn.notFound')} action={<ButtonLink to="/learn">{t('learn.backToAtlas')}</ButtonLink>} />
      </Page>
    )

  const i = ARTISTS.findIndex((x) => x.slug === a.slug)
  const next = ARTISTS[(i + 1) % ARTISTS.length]

  return (
    <Page>
      <div className="container-art">
        <Link to="/learn#artists" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <header className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              {a.movements.map((m) =>
                MOVEMENT_MAP[m] ? (
                  <Link key={m} to={`/learn/movements/${m}`}>
                    <Pill tone="saffron">{L(MOVEMENT_MAP[m].name)}</Pill>
                  </Link>
                ) : null,
              )}
            </div>
            <h1 className="display-xl mt-5">{a.name}</h1>
            <p className="mt-3 font-display text-xl italic text-ink-faint">
              {a.years} · {L(a.nationality)}
            </p>
            <p className="prose-art mt-6 max-w-2xl text-lg">{L(a.bio)}</p>
          </div>
          {a.quote && (
            <figure className="relative self-end rounded-[26px] border border-line bg-paper-2/60 p-8">
              <Quote className="absolute -top-5 left-6 h-10 w-10 rounded-full bg-saffron p-2 text-inkwell" aria-hidden />
              <blockquote className="font-display text-2xl italic leading-snug">“{L(a.quote)}”</blockquote>
              <figcaption className="hand mt-3 text-xl text-accent-ink">— {a.name}</figcaption>
            </figure>
          )}
        </header>

        <section className="mt-16">
          <h2 className="display-md">{t('learn.signatureWorks')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-faint">{t('learn.worksNote')}</p>
          <div className="mt-8 grid gap-12 md:grid-cols-2">
            {a.works.map((w, wi) => (
              <Reveal key={w.title.en} delay={wi * 0.08}>
                <Frame
                  tone={wi === 0 ? 'gold' : 'wood'}
                  frameWidth={14}
                  matWidth={16}
                  tilt={wi === 0 ? -1 : 1}
                  label={<WallLabel title={L(w.title)} lines={[`${a.name}, ${w.year}`, t('learn.generativeNote')]} />}
                >
                  <div className="aspect-[4/3]">
                    <GenerativeArt
                      style={w.genStyle}
                      seed={`${a.slug}-${wi}`}
                      palette={w.palette.length ? w.palette : undefined}
                      title={L(w.title)}
                    />
                  </div>
                </Frame>
                <p className="mt-4 text-ink-soft">{L(w.description)}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Link
          to={`/learn/artists/${next.slug}`}
          className="mt-16 flex items-center justify-between gap-6 rounded-[26px] border border-line p-6 transition-colors hover:bg-ink/[0.03]"
        >
          <div>
            <p className="eyebrow">{t('learn.nextArtist')}</p>
            <p className="mt-2 font-display text-3xl">{next.name}</p>
            <p className="text-sm text-ink-faint">{next.years}</p>
          </div>
          <Avatar seed={next.slug} size={64} />
        </Link>
      </div>
    </Page>
  )
}
