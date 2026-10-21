import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Brush, Clock, Hammer, Star } from 'lucide-react'
import { Page, Reveal, EmptyState } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Frame } from '@/components/Frame'
import { ButtonLink } from '@/components/Button'
import { DifficultyDots } from '@/components/Chip'
import { Skeleton } from '@/components/Progress'
import { Washes } from '@/components/art/Washes'
import { useArtForm, useArtForms, useLessons } from '@/api/queries'
import { ArtFormCover } from '@/features/learn/ArtFormCover'
import { useViewed } from '@/features/learn/useViewed'
import { DIFF_LEVEL } from '@/features/practice/constants'
import { useL, useLL } from '@/i18n/useL'

export default function ArtFormPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const L = useL()
  const LL = useLL()
  const { data: form, isLoading, isError } = useArtForm(slug)
  const { data: all } = useArtForms()
  const { data: lessons } = useLessons()
  useViewed('artForm', form?.slug)

  if (isLoading)
    return (
      <Page>
        <div className="container-art space-y-6">
          <Skeleton className="h-16 w-1/2" />
          <Skeleton className="aspect-[16/7] rounded-3xl" />
        </div>
      </Page>
    )
  if (isError || !form)
    return (
      <Page>
        <EmptyState title={t('learn.notFound')} action={<ButtonLink to="/learn">{t('learn.backToAtlas')}</ButtonLink>} />
      </Page>
    )

  const idx = all?.findIndex((f) => f.slug === form.slug) ?? -1
  const next = all && idx >= 0 ? all[(idx + 1) % all.length] : undefined
  const related = (lessons ?? []).filter((l) => form.relatedLessons.includes(l.slug))

  return (
    <Page>
      <Washes washes={[{ color: form.palette[1] ?? 'var(--saffron)', size: '36vmax', top: '-12%', right: '-10%' }, { color: form.palette[0], size: '26vmax', top: '40%', left: '-14%', delay: -9 }]} />
      <div className="container-art">
        <Link to="/learn#forms" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <div className="mt-6 grid items-end gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">{t('learn.kinds.artForm')} · {t(`learn.families.${form.family}`)}</p>
            <h1 className="display-xl mt-4">{L(form.name)}</h1>
            <p className="mt-6 text-xl leading-relaxed text-ink-soft">{L(form.definition)}</p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm text-ink-faint">
              <DifficultyDots level={DIFF_LEVEL[form.difficulty]} label={t(`difficulty.${form.difficulty}`)} />
              {t('learn.beginnerDifficulty')}: {t(`difficulty.${form.difficulty}`)}
            </p>
          </div>
          <Frame frameWidth={14} matWidth={16} tilt={1.2}>
            <div className="aspect-[4/3]">
              <ArtFormCover style={form.coverStyle} palette={form.palette} seed={form.slug} />
            </div>
          </Frame>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <Card className="h-full p-6 sm:p-8">
              <h2 className="font-display text-2xl">{t('learn.history')}</h2>
              <p className="prose-art mt-3">{L(form.history)}</p>
              <h3 className="mt-8 font-display text-xl">{t('learn.famousExamples')}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {LL(form.examples).map((ex, i) => (
                  <li key={ex} className="rounded-2xl border border-line p-3">
                    <Star size={16} className="text-saffron" style={{ color: form.palette[i % form.palette.length] }} />
                    <p className="mt-2 text-sm font-medium">{ex}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card className="h-full p-6 sm:p-8">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <Hammer size={20} /> {t('learn.toolsMaterials')}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {LL(form.tools).map((tool) => (
                  <li key={tool} className="flex gap-3 text-ink-soft">
                    <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: form.palette[0] }} />
                    {tool}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        <Reveal className="mt-6">
          <section className="relative overflow-hidden rounded-[26px] bg-[#1b1a17] p-6 text-[#f6f1e7] sm:p-10">
            <div aria-hidden className="absolute inset-y-0 right-0 w-1/3 opacity-30">
              <ArtFormCover style={form.coverStyle} palette={form.palette} seed={`${form.slug}-try`} />
            </div>
            <div className="relative max-w-2xl">
              <p className="hand text-2xl text-[#F2A93B]">{t('learn.tryAtHome')}</p>
              <p className="mt-3 font-display text-2xl leading-snug sm:text-3xl">{L(form.exercise)}</p>
              <ButtonLink to={`/free-draw?prompt=${encodeURIComponent(L(form.exercise))}`} variant="gold" className="mt-6" icon={<Brush size={17} />}>
                {t('learn.tryInStudio')}
              </ButtonLink>
            </div>
          </section>
        </Reveal>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="display-md">{t('learn.relatedLessons')}</h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-3">
              {related.map((l) => (
                <li key={l.slug}>
                  <Link to={`/learn/lessons/${l.slug}`} className="block h-full">
                    <Card className="h-full p-5 transition-shadow hover:shadow-lift">
                      <p className="flex items-center gap-1 text-xs text-ink-faint">
                        <Clock size={12} /> {t('common.minutes', { count: l.minutes })}
                      </p>
                      <h3 className="mt-2 font-display text-xl">{L(l.title)}</h3>
                      <p className="mt-1 text-sm text-ink-soft">{L(l.summary)}</p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {next && (
          <Link to={`/learn/art-forms/${next.slug}`} className="group mt-16 flex items-center justify-between gap-6 rounded-[26px] border border-line p-6 transition-colors hover:bg-ink/[0.03]">
            <div>
              <p className="eyebrow">{t('learn.nextForm')}</p>
              <p className="mt-2 font-display text-3xl">{L(next.name)}</p>
            </div>
            <div className="h-20 w-28 overflow-hidden rounded-xl">
              <ArtFormCover style={next.coverStyle} palette={next.palette} seed={next.slug} />
            </div>
          </Link>
        )}
      </div>
    </Page>
  )
}
