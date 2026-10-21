import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Check, Flame, Trophy, X } from 'lucide-react'
import type { ArtMovement } from '@/types'
import { Page, SectionHeading } from '@/components/Layout'
import { Frame } from '@/components/Frame'
import { Button } from '@/components/Button'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { MOVEMENTS } from '@/mocks/movements'
import { recordActivity } from '@/api/progress'
import { useL, useLL } from '@/i18n/useL'
import { cn } from '@/lib/utils'
import { shuffle } from '@/lib/random'
import { useLearn } from '@/store/learn'
import { presentReward } from '@/store/ui'
import { burst } from '@/lib/confetti'

interface Round {
  answer: ArtMovement
  options: ArtMovement[]
  seed: string
}

function newRound(n: number): Round {
  const rng = () => Math.random()
  const answer = MOVEMENTS[Math.floor(rng() * MOVEMENTS.length)]
  // distractors never share the answer's visual style, so every question is fair
  const others = shuffle(
    rng,
    MOVEMENTS.filter((m) => m.genStyle !== answer.genStyle),
  )
  const picked: ArtMovement[] = []
  for (const m of others) if (!picked.some((p) => p.genStyle === m.genStyle) && picked.length < 3) picked.push(m)
  return { answer, options: shuffle(rng, [answer, ...picked]), seed: `${answer.slug}-${n}-${Math.floor(rng() * 1e6)}` }
}

export default function SpotTheStylePage() {
  const { t } = useTranslation()
  const L = useL()
  const LL = useLL()
  const best = useLearn((s) => s.spotBest)
  const setBest = useLearn((s) => s.setSpotBest)
  const [n, setN] = useState(0)
  const [round, setRound] = useState<Round>(() => newRound(0))
  const [picked, setPicked] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)

  const choose = (slug: string) => {
    if (picked) return
    setPicked(slug)
    if (slug === round.answer.slug) {
      const s = streak + 1
      setStreak(s)
      setBest(s)
      if (s % 5 === 0) burst(0.5, 0.5)
      void recordActivity({ type: 'spotStyle', streak: s }).then(presentReward)
    } else setStreak(0)
  }

  const next = () => {
    setN(n + 1)
    setRound(newRound(n + 1))
    setPicked(null)
  }

  const right = picked === round.answer.slug

  return (
    <Page>
      <div className="container-art">
        <Link to="/learn#tools" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <SectionHeading
          className="mt-6"
          eyebrow={t('learn.spot.eyebrow')}
          title={
            <>
              {t('learn.spot.titleA')} <em>{t('learn.spot.titleB')}</em>
            </>
          }
          lede={t('learn.spot.lede')}
        />
        <div className="mt-6 flex gap-6 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Flame size={16} className="text-vermilion" /> {t('learn.spot.streak', { count: streak })}
          </span>
          <span className="inline-flex items-center gap-2 text-ink-soft">
            <Trophy size={16} className="text-gold-deep dark:text-gold" /> {t('learn.spot.best', { count: best })}
          </span>
        </div>
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          <Frame frameWidth={14} matWidth={16} tone={picked && right ? 'gold' : 'wood'}>
            <div className="aspect-[4/3]">
              <GenerativeArt
                key={round.seed}
                style={round.answer.genStyle}
                seed={round.seed}
                palette={round.answer.palette}
                title={t('learn.spot.mystery')}
              />
            </div>
          </Frame>
          <div>
            <p className="font-display text-2xl">{t('learn.spot.question')}</p>
            <div className="mt-5 grid gap-3" role="radiogroup" aria-label={t('learn.spot.question')}>
              {round.options.map((m) => {
                const isAnswer = m.slug === round.answer.slug
                const isPicked = m.slug === picked
                return (
                  <button
                    key={m.slug}
                    type="button"
                    role="radio"
                    aria-checked={isPicked}
                    disabled={!!picked}
                    onClick={() => choose(m.slug)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left font-display text-xl transition-colors',
                      !picked && 'border-line-strong hover:border-ink hover:bg-ink/[0.03]',
                      picked && isAnswer && 'border-viridian bg-viridian/12',
                      picked && isPicked && !isAnswer && 'border-vermilion bg-vermilion/10',
                      picked && !isPicked && !isAnswer && 'border-line opacity-55',
                    )}
                  >
                    {L(m.name)}
                    {picked && isAnswer && <Check className="text-viridian" />}
                    {picked && isPicked && !isAnswer && <X className="text-accent-ink" />}
                  </button>
                )
              })}
            </div>
            {picked && (
              <div className="mt-6 rounded-2xl bg-paper-2 p-5" role="status">
                <p className="font-semibold">{right ? t('learn.spot.right') : t('learn.spot.wrong', { name: L(round.answer.name) })}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {LL(round.answer.spotIt).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="ink" iconRight={<ArrowRight size={16} />} onClick={next} data-autofocus>
                    {t('learn.spot.next')}
                  </Button>
                  <Link to={`/learn/movements/${round.answer.slug}`} className="link-ink self-center text-sm">
                    {t('learn.spot.learnMore', { name: L(round.answer.name) })}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
