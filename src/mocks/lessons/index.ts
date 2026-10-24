import type { Lesson, LessonTrack } from '@/types'
import { COMPOSITION_COLOUR } from './compositionColour'
import { DRAWING } from './drawing'
import { SUBJECTS } from './subjects'

export const LESSONS: Lesson[] = [...COMPOSITION_COLOUR, ...DRAWING, ...SUBJECTS]
export const LESSON_MAP: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.slug, l]))

export interface LearningTrack {
  id: LessonTrack
  icon: string
  /** ordered checkpoints: lessons to complete */
  lessons: string[]
  /** history track also counts movements visited */
  movementGoal?: number
}

export const TRACKS: LearningTrack[] = [
  {
    id: 'beginner',
    icon: 'brush',
    lessons: [
      'line-quality',
      'contour-drawing',
      'proportion',
      'negative-space',
      'light-and-shadow',
      'rule-of-thirds',
      'leading-lines',
      'still-life',
      'gesture-drawing',
      'one-point-perspective',
    ],
  },
  {
    id: 'colour',
    icon: 'palette',
    lessons: [
      'hue-value-saturation',
      'warm-and-cool',
      'colour-schemes',
      'watercolour-basics',
      'colour-psychology',
      'atmospheric-perspective',
    ],
  },
  {
    id: 'history',
    icon: 'library',
    lessons: ['reading-a-painting', 'golden-ratio'],
    movementGoal: 12,
  },
]
