import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useScroll } from 'framer-motion'
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Brush, Check, Clock, Lightbulb } from 'lucide-react'
import { Page, Reveal, EmptyState } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button, ButtonLink } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Pill } from '@/components/Chip'
import { Skeleton } from '@/components/Progress'
import { Markdown } from '@/components/Markdown'
import { Highlight } from '@/components/art/Brush'
import { useLesson } from '@/api/queries'
import { completeLesson, saveLessonProgress } from '@/api/learn'
import { LESSONS } from '@/mocks/lessons'
import { LessonDiagram } from '@/features/learn/LessonDiagram'
import { Quiz } from '@/features/learn/Quiz'
import { useL } from '@/i18n/useL'
import { useLearn } from '@/store/learn'
import { useStudio } from '@/store/studio'
import { presentReward, toast } from '@/store/ui'
import type { ToolId } from '@/features/drawing/engine/types'

export default function LessonPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const { data: lesson, isLoading, isError } = useLesson(slug)
  const state = useLearn((s) => s.lessons[slug])
  const saved = useLearn((s) => s.bookmarks.includes(slug))
  const toggleBookmark = useLearn((s) => s.toggleBookmark)
  const articleRef = useRef<HTMLElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: articleRef, offset: ['start start', 'end end'] })
  const [completedNow, setCompletedNow] = useState(false)

  // save reading progress as you scroll
  useEffect(() => {
    if (!lesson) return
    let last = 0
    return scrollYProgress.on('change', (v) => {
      if (v - last > 0.08 || v >= 0.99) {
        last = v
        void saveLessonProgress(lesson.slug, Math.min(1, v))
      }
    })
  }, [lesson, scrollYProgress])

  // reaching the end of the reading marks the lesson complete
  useEffect(() => {
    const el = endRef.current
    if (!el || !lesson) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      void completeLesson(lesson.slug).then((r) => {
        if (!r) return
        setCompletedNow(true)
        toast({ title: t('learn.lessonComplete'), description: t('learn.lessonXp', { xp: r.xpGained }), tone: 'gold' })
        presentReward(r)
      })
    })
    io.observe(el)
    return () => io.disconnect()
  }, [lesson, t])

  if (isLoading)
    return (
      <Page>
        <div className="container-art max-w-3xl space-y-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-64" />
        </div>
      </Page>
    )
  if (isError || !lesson)
    return (
      <Page>
        <EmptyState title={t('learn.notFound')} action={<ButtonLink to="/learn">{t('learn.backToAtlas')}</ButtonLink>} />
      </Page>
    )

  const idx = LESSONS.findIndex((l) => l.slug === lesson.slug)
  const next = LESSONS[(idx + 1) % LESSONS.length]
  const tryIt = () => {
    const st = useStudio.getState()
    st.setTool(lesson.tryIt.tool as ToolId)
    st.setPendingPalette({ name: L(lesson.title), colors: lesson.tryIt.palette })
    if (lesson.tryIt.palette[0]) st.commitColor(lesson.tryIt.palette[0].toLowerCase())
    navigate(`/free-draw?prompt=${encodeURIComponent(L(lesson.tryIt.prompt))}`)
  }

  return (
    <Page>
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[90] h-1 origin-left bg-gradient-to-r from-saffron via-vermilion to-rose" style={{ scaleX: scrollYProgress }} />
      <div className="container-art">
        <div className="mx-auto max-w-3xl">
          <Link to="/learn#lessons" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
            <ArrowLeft size={16} /> {t('learn.allLessons')}
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Pill tone="cerulean">{t(`learn.topics.${lesson.topic}`)}</Pill>
            <Pill tone="neutral" icon={<Clock size={11} />}>
              {t('learn.readTime', { count: lesson.minutes })}
            </Pill>
            <Pill tone="gold">+{lesson.xp} XP</Pill>
            {(state?.completed || completedNow) && (
              <Pill tone="viridian" icon={<Check size={11} />}>
                {t('learn.done')}
              </Pill>
            )}
            <IconButton
              className="ml-auto"
              label={saved ? t('learn.unbookmark') : t('learn.bookmark')}
              icon={saved ? <BookmarkCheck size={18} className="text-accent-ink" /> : <Bookmark size={18} />}
              onClick={() => toggleBookmark(lesson.slug)}
            />
          </div>
          <h1 className="display-lg mt-5">
            <Highlight>{L(lesson.title)}</Highlight>
          </h1>
          <p className="mt-5 text-xl leading-relaxed text-ink-soft">{L(lesson.summary)}</p>
        </div>

        <article ref={articleRef} className="mx-auto mt-12 max-w-3xl">
          {lesson.sections.map((s, i) => (
            <Reveal key={i} as="section" className="mb-14">
              <h2 className="font-display text-3xl">
                <span className="mr-3 font-display text-xl italic text-accent-ink">{String(i + 1).padStart(2, '0')}</span>
                {L(s.heading)}
              </h2>
              <Markdown text={L(s.body)} className="prose-art mt-4" />
              {s.diagram && (
                <figure className="mt-6 rounded-[22px] border border-line bg-card p-4 shadow-paper sm:p-6">
                  <LessonDiagram kind={s.diagram} />
                </figure>
              )}
              {s.callout && (
                <aside className="mt-6 flex gap-3 rounded-2xl border-l-4 border-saffron bg-saffron/10 p-4">
                  <Lightbulb size={20} className="mt-0.5 shrink-0 text-ochre" />
                  <p className="text-ink-soft">{L(s.callout)}</p>
                </aside>
              )}
            </Reveal>
          ))}
          <div ref={endRef} />
        </article>

        <div className="mx-auto max-w-3xl space-y-8">
          <section className="relative overflow-hidden rounded-[26px] bg-[#1b1a17] p-6 text-[#f6f1e7] sm:p-8">
            <p className="hand text-2xl text-[#F2A93B]">{t('learn.tryItNow')}</p>
            <p className="mt-2 font-display text-2xl leading-snug">{L(lesson.tryIt.prompt)}</p>
            <div className="mt-4 flex gap-2">
              {lesson.tryIt.palette.map((c) => (
                <span key={c} className="h-8 w-8 rounded-full border-2 border-white/30" style={{ background: c }} />
              ))}
            </div>
            <Button variant="gold" className="mt-6" icon={<Brush size={17} />} onClick={tryIt}>
              {t('learn.openStudio', { tool: t(`studio.tools.${lesson.tryIt.tool}`) })}
            </Button>
          </section>

          <Card className="p-6 sm:p-8" id="quiz">
            <h2 className="display-md mb-6">{t('learn.quiz.title')}</h2>
            <Quiz quiz={lesson.quiz} />
          </Card>

          <Link to={`/learn/lessons/${next.slug}`} className="group flex items-center justify-between rounded-[22px] border border-line p-6 transition-colors hover:bg-ink/[0.03]">
            <div>
              <p className="eyebrow">{t('learn.nextLesson')}</p>
              <p className="mt-2 font-display text-2xl">{L(next.title)}</p>
            </div>
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </Page>
  )
}
