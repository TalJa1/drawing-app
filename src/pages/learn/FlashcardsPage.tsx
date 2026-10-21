import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, RefreshCw, RotateCcw } from 'lucide-react'
import type { GlossaryTerm } from '@/types'
import { Page, SectionHeading } from '@/components/Layout'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Progress'
import { useGlossary } from '@/api/queries'
import { recordActivity } from '@/api/progress'
import { useL } from '@/i18n/useL'
import { cn } from '@/lib/utils'
import { useLearn, type FlashcardState } from '@/store/learn'
import { presentReward, toast } from '@/store/ui'
import { burst } from '@/lib/confetti'
import { useNow } from '@/lib/hooks'

/* Leitner-lite spaced repetition: each box waits longer before the card returns. */
const INTERVALS = [0, 10 * 60_000, 86_400_000, 3 * 86_400_000, 7 * 86_400_000]
const SESSION = 10

const schedule = (box: number): FlashcardState => ({ box, due: Date.now() + INTERVALS[box] })

function pickSession(terms: GlossaryTerm[], cards: Record<string, FlashcardState>, now: number): string[] {
  const due = terms.filter((g) => (cards[g.id]?.due ?? 0) <= now)
  // lowest box first, then the ones never seen
  due.sort((a, b) => (cards[a.id]?.box ?? -1) - (cards[b.id]?.box ?? -1) || a.id.localeCompare(b.id))
  return due.slice(0, SESSION).map((g) => g.id)
}

export default function FlashcardsPage() {
  const { t } = useTranslation()
  const L = useL()
  const { data } = useGlossary()
  const cards = useLearn((s) => s.flashcards)
  const setCard = useLearn((s) => s.setFlashcard)
  const [session, setSession] = useState<string[] | null>(null)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const now = useNow(30_000).getTime()

  if (!data)
    return (
      <Page>
        <div className="container-art">
          <Skeleton className="mx-auto h-96 max-w-xl" />
        </div>
      </Page>
    )

  const byId = Object.fromEntries(data.map((g) => [g.id, g]))
  const mastered = data.filter((g) => (cards[g.id]?.box ?? 0) >= 3).length
  const start = () => {
    const ids = pickSession(data, cards, Date.now())
    setSession(ids.length ? ids : data.slice(0, SESSION).map((g) => g.id))
    setI(0)
    setKnown(0)
    setFlipped(false)
  }
  const current = session && i < session.length ? byId[session[i]] : null
  const finished = session && i >= session.length

  const answer = (knewIt: boolean) => {
    if (!current) return
    const prev = cards[current.id]?.box ?? 0
    const box = knewIt ? Math.min(4, prev + 1) : 0
    setCard(current.id, schedule(box))
    if (knewIt) setKnown((k) => k + 1)
    setFlipped(false)
    const nextI = i + 1
    setI(nextI)
    if (session && nextI >= session.length) {
      void recordActivity({ type: 'flashcardReviewed', count: session.length }).then((r) => {
        presentReward(r)
        toast({ title: t('learn.cards.sessionDone'), description: `+${r.xpGained} XP`, tone: 'gold' })
      })
      if (known + (knewIt ? 1 : 0) === session.length) burst(0.5, 0.5)
    }
  }

  return (
    <Page>
      <div className="container-art">
        <Link to="/learn#tools" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <SectionHeading className="mt-6" eyebrow={t('learn.cards.eyebrow')} title={<>{t('learn.cards.titleA')} <em>{t('learn.cards.titleB')}</em></>} lede={t('learn.cards.lede')} />
        <div className="mt-6 flex flex-wrap gap-6 text-sm text-ink-soft">
          <span>{t('learn.cards.deck', { count: data.length })}</span>
          <span>{t('learn.cards.mastered', { count: mastered })}</span>
          <span>{t('learn.cards.due', { count: data.filter((g) => (cards[g.id]?.due ?? 0) <= now).length })}</span>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          {!session || finished ? (
            <div className="paper rounded-[28px] border border-line p-10 text-center shadow-lift">
              {finished ? (
                <>
                  <p className="eyebrow">{t('learn.cards.result')}</p>
                  <p className="mt-3 font-display text-6xl">
                    {known}
                    <span className="text-3xl text-ink-faint">/{session!.length}</span>
                  </p>
                  <p className="mt-3 text-ink-soft">{t('learn.cards.resultBody')}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-3xl">{t('learn.cards.ready')}</p>
                  <p className="mt-3 text-ink-soft">{t('learn.cards.readyBody', { count: SESSION })}</p>
                </>
              )}
              <Button variant="pigment" size="lg" className="mt-8" icon={finished ? <RefreshCw size={18} /> : undefined} onClick={start}>
                {finished ? t('learn.cards.again') : t('learn.cards.start')}
              </Button>
            </div>
          ) : (
            current && (
              <>
                <p className="mb-3 text-center text-sm text-ink-faint">{t('learn.quiz.progress', { n: i + 1, total: session.length })}</p>
                <div className="flip-scene">
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    aria-label={flipped ? t('learn.cards.showFront') : t('learn.cards.flip')}
                    className={cn('flip-card relative block h-80 w-full text-left', flipped && 'is-flipped')}
                  >
                    <div className="flip-face paper flex flex-col items-center justify-center rounded-[28px] border border-line p-8 text-center shadow-lift">
                      <p className="eyebrow">{t(`learn.glossary.cats.${current.category}`)}</p>
                      <p className="mt-4 font-display text-4xl leading-tight">{L(current.term)}</p>
                      <p className="hand mt-6 text-xl text-accent-ink">{t('learn.cards.tapToFlip')}</p>
                    </div>
                    <div className="flip-face flip-back flex flex-col items-center justify-center rounded-[28px] bg-[#1b1a17] p-8 text-center text-[#f6f1e7] shadow-lift">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F2A93B]">{L(current.term)}</p>
                      <p className="mt-4 font-display text-2xl leading-snug">{L(current.definition)}</p>
                    </div>
                  </button>
                </div>
                <div className={cn('mt-6 grid grid-cols-2 gap-3 transition-opacity', flipped ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!flipped}>
                  <Button variant="outline" icon={<RotateCcw size={16} />} onClick={() => answer(false)} tabIndex={flipped ? 0 : -1}>
                    {t('learn.cards.again2')}
                  </Button>
                  <Button variant="ink" icon={<Check size={16} />} onClick={() => answer(true)} tabIndex={flipped ? 0 : -1}>
                    {t('learn.cards.knew')}
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </Page>
  )
}
