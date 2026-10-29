import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import type { Quiz as QuizT } from '@/types'
import { useL } from '@/i18n/useL'
import { cn } from '@/lib/utils'
import { submitQuiz, type QuizResult } from '@/api/learn'
import { Button } from '@/components/Button'
import { presentReward } from '@/store/ui'
import { burst } from '@/lib/confetti'

/**
 * One-question-at-a-time quiz. The right answers are not known here: the API grades the whole quiz
 * when it is submitted and only then sends back the right option and the explanation of each question.
 */
export function Quiz({ quiz }: { quiz: QuizT }) {
  const { t } = useTranslation()
  const L = useL()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [busy, setBusy] = useState(false)
  const q = quiz.questions[i]
  const total = quiz.questions.length

  const next = async () => {
    const all = [...answers, picked!]
    setAnswers(all)
    setPicked(null)
    if (i + 1 < total) {
      setI(i + 1)
      return
    }
    setBusy(true)
    try {
      const r = await submitQuiz(quiz.lessonSlug, all)
      setResult(r)
      if (r.correct === r.total) burst(0.5, 0.6)
      presentReward(r.reward)
    } finally {
      setBusy(false)
    }
  }

  const restart = () => {
    setI(0)
    setAnswers([])
    setPicked(null)
    setResult(null)
  }

  if (result)
    return (
      <div>
        <div className="text-center" role="status">
          <p className="eyebrow">{t('learn.quiz.result')}</p>
          <p className="mt-3 font-display text-6xl">
            {result.correct}
            <span className="text-3xl text-ink-faint">/{result.total}</span>
          </p>
          <p className="mt-3 text-lg text-ink-soft">
            {result.correct === result.total ? t('learn.quiz.perfect') : result.passed ? t('learn.quiz.passed') : t('learn.quiz.tryAgain')}
          </p>
          {result.reward && <p className="mt-2 font-semibold text-gold-deep dark:text-gold">+{result.reward.xpGained} XP</p>}
        </div>
        <h3 className="eyebrow mt-8">{t('learn.quiz.review')}</h3>
        <ol className="mt-3 grid gap-3">
          {quiz.questions.map((question, qi) => {
            const key = result.review[qi]
            const right = answers[qi] === key.answer
            return (
              <li key={question.id} className="rounded-2xl bg-paper-2 p-4">
                <p className="flex items-start gap-2 font-semibold">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white',
                      right ? 'bg-viridian' : 'bg-vermilion',
                    )}
                    aria-label={right ? t('learn.quiz.correct') : t('learn.quiz.notQuite')}
                  >
                    {right ? <Check size={12} /> : <X size={12} />}
                  </span>
                  {L(question.prompt)}
                </p>
                {!right && (
                  <p className="mt-2 text-sm text-ink-soft">
                    {t('learn.quiz.yourAnswer')}: {L(question.options[answers[qi]])}
                  </p>
                )}
                <p className="mt-1 text-sm font-medium">
                  {t('learn.quiz.rightAnswer')}: {L(question.options[key.answer])}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{L(key.explain)}</p>
              </li>
            )
          })}
        </ol>
        <div className="mt-6 text-center">
          <Button variant="outline" icon={<RotateCcw size={16} />} onClick={restart}>
            {t('learn.quiz.retake')}
          </Button>
        </div>
      </div>
    )

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm font-medium text-ink-faint">{t('learn.quiz.progress', { n: i + 1, total })}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-3">
          <div
            className="h-full rounded-full bg-saffron transition-[width] duration-500"
            style={{ width: `${((i + (picked !== null ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.fieldset key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <legend className="font-display text-2xl leading-snug">{L(q.prompt)}</legend>
          <div className="mt-5 grid gap-2.5" role="radiogroup">
            {q.options.map((o, oi) => {
              const isPicked = oi === picked
              return (
                <button
                  key={oi}
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  disabled={busy}
                  onClick={() => setPicked(oi)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                    isPicked ? 'border-ink bg-ink/[0.05]' : 'border-line-strong hover:border-ink hover:bg-ink/[0.03]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                      isPicked ? 'border-ink bg-ink text-paper' : 'border-line-strong',
                    )}
                  >
                    {isPicked ? <Check size={14} /> : String.fromCharCode(65 + oi)}
                  </span>
                  {L(o)}
                </button>
              )
            })}
          </div>
          <Button className="mt-5" variant="ink" onClick={() => void next()} disabled={picked === null || busy} data-autofocus>
            {i + 1 < total ? t('common.next') : busy ? t('common.loading') : t('learn.quiz.finish')}
          </Button>
        </motion.fieldset>
      </AnimatePresence>
    </div>
  )
}
