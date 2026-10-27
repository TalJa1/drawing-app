/* ------------------------------------------------------------------
   Shared domain types. These double as the back-end contract
   (see src/api/CONTRACT.md) — keep them serialisable (no functions).
   ------------------------------------------------------------------ */

export type Lang = 'en' | 'vi'

/** A string available in every supported language. */
export interface Localized {
  en: string
  vi: string
}
export interface LocalizedList {
  en: string[]
  vi: string[]
}

export type ISODate = string // 2026-10-21T08:00:00.000Z
export type DayKey = string // 2026-10-21 (local calendar day)

/* ---------- Users ---------- */

export interface User {
  id: string
  email: string
  displayName: string
  bio: string
  avatarSeed: string
  createdAt: ISODate
  isGuest: boolean
}

/* ---------- Templates ---------- */

export type TemplateCategory =
  'animals' | 'landscapes' | 'portraits' | 'objects' | 'flowers' | 'architecture' | 'fantasy' | 'patterns' | 'food'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'master'

export interface Template {
  id: string
  title: Localized
  category: TemplateCategory
  difficulty: Difficulty
  /** Estimated minutes to complete */
  minutes: number
  /** Level required to unlock (1 = always open) */
  unlockLevel: number
  /** Raw SVG markup (viewBox 0 0 1200 900). Replaceable by `imageUrl` later. */
  svg: string
  imageUrl?: string
  suggestedPalette: string[]
  popularity: number
  createdAt: ISODate
  tags: string[]
}

/* ---------- Artworks & scoring ---------- */

export type ArtworkKind = 'practice' | 'free'

/** Client-side image analysis sent alongside the image (mock scoring input). */
export interface ArtworkAnalysis {
  /** 0–1: share of the template's inside regions that received paint */
  coverage: number
  /** 0–1: share of outside/background area that was painted over */
  spill: number
  /** 0–1: share of the line-art that is covered by a trace / paint stroke near it */
  lineTrace: number
  /** distinct hue buckets (of 12) with meaningful pixel counts */
  distinctHues: number
  /** dominant colours (hex), most common first */
  dominant: string[]
  /** 0–1 palette harmony estimate from hue relationships */
  harmony: number
  /** 0–1 how close the colours are to the template's suggested palette */
  paletteMatch: number
  /** 0–1 spread of light/dark values */
  valueRange: number
  /** 0–1 average saturation */
  saturation: number
  /** 0–1 overall painted share of the canvas (free draw) */
  inkAmount: number
  /** Coverage grid (rows × cols of 0–1, -1 = no fillable area) for the heatmap */
  grid: number[][]
  strokes: number
}

export interface Artwork {
  id: string
  kind: ArtworkKind
  title: string
  templateId?: string
  createdAt: ISODate
  updatedAt: ISODate
  /** Seconds spent drawing */
  timeSpent: number
  width: number
  height: number
  /** Key of the image blob in IndexedDB (or a URL once a server exists) */
  imageKey: string
  thumbKey: string
  favourite: boolean
  medium: string
  analysis?: ArtworkAnalysis
  score?: ScoreResult
  /** true for seeded demo artworks */
  demo?: boolean
}

export interface SubScores {
  lineAccuracy: number
  composition: number
  proportion: number
  harmony: number
  suitability: number
  aesthetics: number
}

export type RankLabel = 'starter' | 'rising' | 'steady' | 'gallery' | 'masterpiece'

export interface ScoreResult {
  artworkId: string
  similarity: number
  colour: number
  overall: number
  sub: SubScores
  rank: RankLabel
  strengths: Localized[]
  weaknesses: Localized[]
  feedback: Localized[]
  tips: Localized[]
  judgeNote: Localized
  scoredAt: ISODate
}

/* ---------- Gamification ---------- */

export type BadgeCategory = 'practice' | 'score' | 'streak' | 'learning' | 'colour' | 'exploration' | 'secret'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Badge {
  id: string
  name: Localized
  description: Localized
  category: BadgeCategory
  rarity: Rarity
  icon: string
  secret?: boolean
  xp: number
}

export type ChallengeKind = 'daily' | 'weekly' | 'special'
export type ChallengeMetric =
  | 'artworks'
  | 'practiceArtworks'
  | 'highScores'
  | 'lessons'
  | 'quizzes'
  | 'freeDraws'
  | 'colourScore'
  | 'templateCategory'
  | 'chat'
  | 'dailyTemplate'

export interface Challenge {
  id: string
  kind: ChallengeKind
  title: Localized
  description: Localized
  metric: ChallengeMetric
  target: number
  xp: number
  /** optional filter for the metric, e.g. template category */
  param?: string
  icon: string
}

export interface Rank {
  id: string
  name: Localized
  minLevel: number
  perk: Localized
}

export interface LeaderboardEntry {
  id: string
  name: string
  avatarSeed: string
  xp: number
  weeklyXp: number
  level: number
  country: string
  isFriend: boolean
  isCurrentUser?: boolean
  sample: true | false
}

export interface RewardSummary {
  xpGained: number
  xpBefore: number
  xpAfter: number
  levelBefore: number
  levelAfter: number
  newBadges: string[]
  streak: number
  streakExtended: boolean
  completedChallenges: string[]
}

/* ---------- Learning ---------- */

export interface ArtForm {
  slug: string
  name: Localized
  family: 'drawing' | 'painting' | 'print' | '3d' | 'lens' | 'digital' | 'word' | 'street' | 'space' | 'craft'
  definition: Localized
  history: Localized
  examples: LocalizedList
  tools: LocalizedList
  difficulty: Difficulty
  exercise: Localized
  relatedLessons: string[]
  coverStyle: CoverStyle
  palette: string[]
}

export type CoverStyle =
  | 'hatching'
  | 'washes'
  | 'impasto'
  | 'blocks'
  | 'ink'
  | 'print'
  | 'stone'
  | 'clay'
  | 'lens'
  | 'pixels'
  | 'panels'
  | 'letters'
  | 'spray'
  | 'collage'
  | 'columns'
  | 'weave'
  | 'space'
  | 'dots'
  | 'geometry'
  | 'lacquer'

export type GenStyle =
  | 'impressionist'
  | 'cubist'
  | 'abstract'
  | 'pop'
  | 'minimal'
  | 'surreal'
  | 'ukiyoe'
  | 'pointillist'
  | 'expressionist'
  | 'renaissance'
  | 'geometric'
  | 'dots'
  | 'ink'
  | 'lacquer'
  | 'folk'
  | 'baroque'
  | 'cave'
  | 'mosaic'
  | 'fauve'
  | 'digital'

export interface ArtMovement {
  slug: string
  name: Localized
  period: string
  startYear: number
  region: Localized
  tradition: 'western' | 'global'
  summary: Localized
  keyIdeas: LocalizedList
  techniques: LocalizedList
  spotIt: LocalizedList
  palette: string[]
  artists: string[]
  genStyle: GenStyle
}

export interface ArtistWork {
  title: Localized
  year: string
  description: Localized
  imageUrl?: string
  genStyle: GenStyle
  palette: string[]
}

export interface Artist {
  slug: string
  name: string
  years: string
  nationality: Localized
  movements: string[]
  bio: Localized
  quote?: Localized
  works: ArtistWork[]
  imageUrl?: string
}

export type LessonTrack = 'beginner' | 'colour' | 'history'
export type LessonTopic = 'composition' | 'colour' | 'light' | 'perspective' | 'drawing' | 'technique' | 'figure' | 'subject' | 'history'

export type DiagramKind =
  | 'thirds'
  | 'golden'
  | 'leading'
  | 'wheel'
  | 'value'
  | 'warmcool'
  | 'schemes'
  | 'psychology'
  | 'shadow'
  | 'onepoint'
  | 'twopoint'
  | 'proportion'
  | 'line'
  | 'hatching'
  | 'blending'
  | 'texture'
  | 'gesture'
  | 'face'
  | 'hand'
  | 'anatomy'
  | 'stilllife'
  | 'landscape'
  | 'watercolour'
  | 'negative'
  | 'contour'
  | 'atmos'

export interface LessonSection {
  heading: Localized
  body: Localized
  diagram?: DiagramKind
  callout?: Localized
}

export interface QuizQuestion {
  id: string
  prompt: Localized
  options: Localized[]
  answer: number
  explain: Localized
}

export interface Quiz {
  lessonSlug: string
  questions: QuizQuestion[]
}

export interface Lesson {
  slug: string
  title: Localized
  summary: Localized
  topic: LessonTopic
  track: LessonTrack
  difficulty: Difficulty
  minutes: number
  sections: LessonSection[]
  tryIt: { tool: string; palette: string[]; prompt: Localized }
  quiz: Quiz
  xp: number
}

export interface GlossaryTerm {
  id: string
  term: Localized
  definition: Localized
  category: 'colour' | 'technique' | 'composition' | 'material' | 'history' | 'form'
}

export interface LessonProgress {
  progress: number
  completed: boolean
  quizBest: number
  quizPassed: boolean
  lastOpened: ISODate
}

/* ---------- Chat ---------- */

export type ChatMode = 'ideas' | 'colour' | 'composition' | 'history'
export type ChatRole = 'user' | 'assistant'
export type ReplyStatus = 'streaming' | 'completed' | 'stopped' | 'interrupted' | 'failed'
export type AiErrorCode =
  | 'unauthorized'
  | 'ai_not_configured'
  | 'service_unavailable'
  | 'rate_limited'
  | 'ai_busy'
  | 'ai_budget_exceeded'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'bad_request'
  | 'validation_error'
  | 'upstream'
  | 'timeout'
  | 'model_unavailable'
  | 'network'
  | 'protocol'
  | 'client'
export type PaletteRole = 'dominant' | 'support' | 'accent'

export type ChatCard =
  | { type: 'palette'; name: string; colors: string[]; roles?: PaletteRole[]; note?: string }
  | { type: 'template'; templateId: string; reason?: string }
  | {
      type: 'idea'
      title: string
      description: string
      difficulty: Difficulty
      minutes: number
    }
  | { type: 'lesson'; slug: string; reason?: string }
  | { type: 'critique'; imageId: string; observations: string[]; strengths: string[]; priorities: string[]; exercise: string }

export interface ChatAttachment {
  kind: 'image'
  id: string
  src?: string
  previewKey?: string
  blobKey?: string
  hash?: string
  width?: number
  height?: number
  artworkId?: string
  name: string
}

export interface ReplyVariant {
  content: string
  cards: ChatCard[]
  status: ReplyStatus
  createdAt: ISODate
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  cards: ChatCard[]
  attachments: ChatAttachment[]
  createdAt: ISODate
  rating?: 'up' | 'down'
  turnId: string
  mode?: ChatMode
  status?: ReplyStatus
  errorCode?: AiErrorCode
  incompleteReason?: string
  variants?: ReplyVariant[]
}

export interface Conversation {
  id: string
  title: string
  mode: ChatMode
  messages: ChatMessage[]
  createdAt: ISODate
  updatedAt: ISODate
  imageContextTurnId?: string | null
}

export type ChatStreamEvent =
  | { type: 'status'; phase: 'thinking' }
  | { type: 'token'; text: string }
  | { type: 'card'; card: ChatCard }
  | { type: 'done'; finish: 'completed' | 'incomplete'; reason?: string }
  | { type: 'error'; code: AiErrorCode; retryAfterMs?: number }

/* ---------- Misc ---------- */

export interface Palette {
  id: string
  name: Localized
  colors: string[]
}

export interface Testimonial {
  name: string
  role: Localized
  quote: Localized
  avatarSeed: string
}
