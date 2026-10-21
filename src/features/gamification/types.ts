import type { DayKey, ISODate, ScoreResult, TemplateCategory } from '@/types'

export interface StreakState {
  current: number
  longest: number
  lastDay: DayKey | null
  freezes: number
  /** days a freeze was spent on (shown on the streak calendar) */
  frozenDays: DayKey[]
}

export interface ProgressStats {
  artworks: number
  practiceArtworks: number
  freeDraws: number
  highScores: number // ≥ 85
  masterpieces: number // ≥ 90
  perfect: number // ≥ 95
  bestScore: number
  scoreRun: number // consecutive ≥ 80
  colourHigh: number // colour sub-score ≥ 90
  lessonsCompleted: number
  quizzesPassed: number
  perfectQuizzes: number
  flashcardsReviewed: number
  spotStyleBest: number
  chatMessages: number
  downloads: number
  palettesSent: number
  nightDraws: number
  earlyDraws: number
  speedDraws: number
  weekendDraws: number
  dailyChallenges: number
  colorLabUses: number
  totalSeconds: number
  templatesTried: string[]
  categoriesTried: TemplateCategory[]
  movementsViewed: string[]
  artFormsViewed: string[]
  artistsViewed: string[]
  glossaryOpened: number
  bigComeback: boolean
}

export interface ScoreHistoryEntry {
  at: ISODate
  overall: number
  similarity: number
  colour: number
  artworkId: string
}

export interface ChallengeProgress {
  progress: number
  claimed: boolean
}

export interface ProgressData {
  xp: number
  badges: Record<string, ISODate>
  streak: StreakState
  /** creative actions per local day */
  activity: Record<DayKey, number>
  stats: ProgressStats
  /** keyed by `${challengeId}@${periodKey}` */
  challenges: Record<string, ChallengeProgress>
  scoreHistory: ScoreHistoryEntry[]
}

export type ProgressEvent =
  | {
      type: 'artworkScored'
      score: ScoreResult
      templateId: string
      category: TemplateCategory
      seconds: number
      isDaily: boolean
      distinctHues: number
      /** best previous overall score on the same template, if any */
      previousBest?: number
    }
  | { type: 'artworkSaved'; kind: 'free' | 'practice'; seconds: number }
  | { type: 'lessonCompleted'; slug: string; xp: number }
  | { type: 'quizCompleted'; slug: string; correct: number; total: number }
  | { type: 'viewed'; what: 'movement' | 'artForm' | 'artist'; slug: string }
  | { type: 'chatMessage' }
  | { type: 'download' }
  | { type: 'flashcardReviewed'; count: number }
  | { type: 'spotStyle'; streak: number }
  | { type: 'colorLab' }
  | { type: 'paletteSent' }
  | { type: 'glossary' }
  | { type: 'challengeClaimed'; challengeId: string; periodKey: string; xp: number }

export const emptyStats = (): ProgressStats => ({
  artworks: 0,
  practiceArtworks: 0,
  freeDraws: 0,
  highScores: 0,
  masterpieces: 0,
  perfect: 0,
  bestScore: 0,
  scoreRun: 0,
  colourHigh: 0,
  lessonsCompleted: 0,
  quizzesPassed: 0,
  perfectQuizzes: 0,
  flashcardsReviewed: 0,
  spotStyleBest: 0,
  chatMessages: 0,
  downloads: 0,
  palettesSent: 0,
  nightDraws: 0,
  earlyDraws: 0,
  speedDraws: 0,
  weekendDraws: 0,
  dailyChallenges: 0,
  colorLabUses: 0,
  totalSeconds: 0,
  templatesTried: [],
  categoriesTried: [],
  movementsViewed: [],
  artFormsViewed: [],
  artistsViewed: [],
  glossaryOpened: 0,
  bigComeback: false,
})

export const emptyProgress = (): ProgressData => ({
  xp: 0,
  badges: {},
  streak: { current: 0, longest: 0, lastDay: null, freezes: 1, frozenDays: [] },
  activity: {},
  stats: emptyStats(),
  challenges: {},
  scoreHistory: [],
})
