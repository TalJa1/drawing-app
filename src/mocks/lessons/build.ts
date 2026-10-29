import type { DiagramKind, Difficulty, Lesson, LessonSection, LessonTopic, LessonTrack, QuizKey, QuizQuestion } from '@/types'

export type S = [string, string, string, string, DiagramKind?, string?, string?]
export type Q = [string, string, [string, string][], number, string, string]

/**
 * The right answers, by lesson. This is what the server keeps: the lessons below never carry them, so no
 * screen can read an answer before a quiz is submitted (see `submitQuiz` in api/learn.ts).
 */
export const QUIZ_KEYS: Record<string, QuizKey[]> = {}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/** Compact builder so lesson files read like prose. */
export function lesson(
  slug: string,
  topic: LessonTopic,
  track: LessonTrack,
  difficulty: Difficulty,
  title: [string, string],
  summary: [string, string],
  sections: S[],
  tryIt: { tool: string; palette: string[]; prompt: [string, string] },
  quiz: Q[],
): Lesson {
  const secs: LessonSection[] = sections.map(([he, hv, be, bv, diagram, ce, cv]) => ({
    heading: { en: he, vi: hv },
    body: { en: be, vi: bv },
    diagram,
    callout: ce ? { en: ce, vi: cv ?? ce } : undefined,
  }))
  const questions: QuizQuestion[] = quiz.map(([pe, pv, opts], i) => ({
    id: `${slug}-q${i + 1}`,
    prompt: { en: pe, vi: pv },
    options: opts.map(([en, vi]) => ({ en, vi })),
  }))
  QUIZ_KEYS[slug] = quiz.map(([, , , answer, ee, ev], i) => ({
    id: `${slug}-q${i + 1}`,
    answer,
    explain: { en: ee, vi: ev },
  }))
  // reading time from the English text (~180 wpm) plus time for diagrams and the quiz
  const total = secs.reduce((n, s) => n + words(s.body.en) + words(s.callout?.en ?? ''), 0)
  const minutes = Math.max(3, Math.min(6, Math.round(total / 180 + secs.filter((s) => s.diagram).length * 0.3 + 1)))
  return {
    slug,
    topic,
    track,
    difficulty,
    title: { en: title[0], vi: title[1] },
    summary: { en: summary[0], vi: summary[1] },
    minutes,
    sections: secs,
    tryIt: { tool: tryIt.tool, palette: tryIt.palette, prompt: { en: tryIt.prompt[0], vi: tryIt.prompt[1] } },
    quiz: { lessonSlug: slug, questions },
    xp: { beginner: 40, intermediate: 55, advanced: 70, master: 90 }[difficulty],
  }
}
