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

/** One-question-at-a-time quiz with instant feedback; graded by the API at the end. */
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

  const choose = (opt: number) => {
    if (picked !== null) return
    setPicked(opt)
  }

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
        <Button variant="outline" className="mt-6" icon={<RotateCcw size={16} />} onClick={restart}>
          {t('learn.quiz.retake')}
        </Button>
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
              const isAnswer = oi === q.answer
              const isPicked = oi === picked
              const state = picked === null ? 'idle' : isAnswer ? 'right' : isPicked ? 'wrong' : 'dim'
              return (
                <button
                  key={oi}
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  disabled={picked !== null}
                  onClick={() => choose(oi)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                    state === 'idle' && 'border-line-strong hover:border-ink hover:bg-ink/[0.03]',
                    state === 'right' && 'border-viridian bg-viridian/12 text-ink',
                    state === 'wrong' && 'border-vermilion bg-vermilion/10',
                    state === 'dim' && 'border-line opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                      state === 'right'
                        ? 'border-viridian bg-viridian text-white'
                        : state === 'wrong'
                          ? 'border-vermilion bg-vermilion text-white'
                          : 'border-line-strong',
                    )}
                  >
                    {state === 'right' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : String.fromCharCode(65 + oi)}
                  </span>
                  {L(o)}
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-2xl bg-paper-2 p-4"
              role="status"
            >
              <p className="font-semibold">{picked === q.answer ? t('learn.quiz.correct') : t('learn.quiz.notQuite')}</p>
              <p className="mt-1 text-ink-soft">{L(q.explain)}</p>
              <Button className="mt-4" variant="ink" onClick={() => void next()} disabled={busy} data-autofocus>
                {i + 1 < total ? t('common.next') : busy ? t('common.loading') : t('learn.quiz.finish')}
              </Button>
            </motion.div>
          )}
        </motion.fieldset>
      </AnimatePresence>
    </div>
  )
}
