import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Brush, Eye, Lightbulb, Paintbrush, Send } from 'lucide-react'
import { Page, Reveal, EmptyState } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Frame, WallLabel } from '@/components/Frame'
import { Button, ButtonLink } from '@/components/Button'
import { Skeleton } from '@/components/Progress'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { Washes } from '@/components/art/Washes'
import { useMovement } from '@/api/queries'
import { recordActivity } from '@/api/progress'
import { TIMELINE } from '@/mocks/movements'
import { ARTIST_MAP } from '@/mocks/artists'
import { useViewed } from '@/features/learn/useViewed'
import { useL, useLL } from '@/i18n/useL'
import { copyText } from '@/lib/utils'
import { presentReward, toast } from '@/store/ui'
import { useStudio } from '@/store/studio'

export default function MovementPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const L = useL()
  const LL = useLL()
  const navigate = useNavigate()
  const { data: m, isLoading, isError } = useMovement(slug)
  const setPalette = useStudio((s) => s.setPendingPalette)
  useViewed('movement', m?.slug)

  if (isLoading)
    return (
      <Page>
        <div className="container-art">
          <Skeleton className="aspect-[16/7] rounded-3xl" />
        </div>
      </Page>
    )
  if (isError || !m)
    return (
      <Page>
        <EmptyState title={t('learn.notFound')} action={<ButtonLink to="/learn">{t('learn.backToAtlas')}</ButtonLink>} />
      </Page>
    )

  const i = TIMELINE.findIndex((x) => x.slug === m.slug)
  const prev = TIMELINE[i - 1]
  const next = TIMELINE[i + 1]
  const artists = m.artists.map((s) => ARTIST_MAP[s]).filter(Boolean)
  const sendPalette = async () => {
    setPalette({ name: L(m.name), colors: m.palette })
    presentReward(await recordActivity({ type: 'paletteSent' }))
    navigate('/free-draw')
  }

  return (
    <Page>
      <Washes
        washes={[
          { color: m.palette[1], size: '40vmax', top: '-18%', left: '-12%' },
          { color: m.palette[2] ?? m.palette[0], size: '28vmax', top: '30%', right: '-14%', delay: -8 },
        ]}
      />
      <div className="container-art">
        <Link to="/learn#timeline" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToTimeline')}
        </Link>
        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="eyebrow">
              {m.period} · {L(m.region)}
            </p>
            <h1 className="display-xl mt-4">{L(m.name)}</h1>
            <p className="mt-6 text-xl leading-relaxed text-ink-soft">{L(m.summary)}</p>
          </div>
          <Frame
            tone={m.tradition === 'global' ? 'wood' : 'gold'}
            frameWidth={16}
            matWidth={18}
            tilt={-1}
            label={<WallLabel title={t('learn.inTheStyleOf', { name: L(m.name) })} lines={[t('learn.generativeNote')]} />}
          >
            <div className="aspect-[4/3]">
              <GenerativeArt style={m.genStyle} seed={m.slug} palette={m.palette} title={t('learn.inTheStyleOf', { name: L(m.name) })} />
            </div>
          </Frame>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {(
            [
              ['keyIdeas', Lightbulb, m.keyIdeas],
              ['techniques', Paintbrush, m.techniques],
              ['spotIt', Eye, m.spotIt],
            ] as const
          ).map(([k, Icon, list], idx) => (
            <Reveal key={k} delay={idx * 0.06}>
              <Card className="h-full p-6">
                <h2 className="flex items-center gap-2 font-display text-2xl">
                  <Icon size={20} style={{ color: m.palette[idx] }} /> {t(`learn.${k}`)}
                </h2>
                <ul className="mt-4 space-y-3 text-ink-soft">
                  {LL(list).map((x) => (
                    <li key={x} className="flex gap-3">
                      <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: m.palette[idx] }} />
                      {x}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl">{t('learn.palette')}</h2>
                <p className="text-sm text-ink-faint">{t('learn.paletteHint')}</p>
              </div>
              <Button size="sm" variant="pigment" icon={<Send size={15} />} onClick={() => void sendPalette()}>
                {t('learn.sendToStudio')}
              </Button>
            </div>
            <div className="mt-5 flex overflow-hidden rounded-2xl border border-line">
              {m.palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={async () => toast({ title: (await copyText(c)) ? t('common.copied') : c, description: c, tone: 'success' })}
                  className="group flex h-28 flex-1 items-end p-2 transition-[flex] hover:flex-[1.4]"
                  style={{ background: c }}
                  aria-label={t('learn.copyColour', { hex: c })}
                >
                  <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {c}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        {artists.length > 0 && (
          <section className="mt-16">
            <h2 className="display-md">{t('learn.keyArtists')}</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {artists.map((a) => (
                <li key={a.slug}>
                  <Link to={`/learn/artists/${a.slug}`} className="group block">
                    <Frame frameWidth={7} matWidth={8}>
                      <div className="aspect-[4/3]">
                        <GenerativeArt
                          style={a.works[0].genStyle}
                          seed={`${a.slug}-0`}
                          palette={a.works[0].palette.length ? a.works[0].palette : undefined}
                        />
                      </div>
                    </Frame>
                    <p className="mt-3 font-display text-xl">{a.name}</p>
                    <p className="text-sm text-ink-faint">{a.years}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {prev ? (
            <Link
              to={`/learn/movements/${prev.slug}`}
              className="group rounded-[22px] border border-line p-5 transition-colors hover:bg-ink/[0.03]"
            >
              <p className="eyebrow flex items-center gap-2">
                <ArrowLeft size={14} /> {t('learn.earlier')}
              </p>
              <p className="mt-2 font-display text-2xl">{L(prev.name)}</p>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/learn/movements/${next.slug}`}
              className="group rounded-[22px] border border-line p-5 text-right transition-colors hover:bg-ink/[0.03]"
            >
              <p className="eyebrow flex items-center justify-end gap-2">
                {t('learn.later')} <ArrowRight size={14} />
              </p>
              <p className="mt-2 font-display text-2xl">{L(next.name)}</p>
            </Link>
          )}
        </div>
        <p className="mt-10 text-center">
          <ButtonLink to="/learn/spot-the-style" variant="outline" icon={<Brush size={16} />}>
            {t('learn.testYourEye')}
          </ButtonLink>
        </p>
      </div>
    </Page>
  )
}
