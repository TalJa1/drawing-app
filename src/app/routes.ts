/* Route-level code splitting. Each loader is also used to preload a page
   when a link is hovered (see preloadRoute). */

export const pages = {
  home: () => import('@/pages/home/HomePage'),
  practice: () => import('@/pages/practice/PracticeLibraryPage'),
  practiceStudio: () => import('@/pages/practice/PracticeStudioPage'),
  practiceResult: () => import('@/pages/practice/PracticeResultPage'),
  freeDraw: () => import('@/pages/free-draw/FreeDrawPage'),
  learn: () => import('@/pages/learn/LearnHubPage'),
  artForm: () => import('@/pages/learn/ArtFormPage'),
  movement: () => import('@/pages/learn/MovementPage'),
  artist: () => import('@/pages/learn/ArtistPage'),
  lesson: () => import('@/pages/learn/LessonPage'),
  colorLab: () => import('@/pages/learn/ColorLabPage'),
  glossary: () => import('@/pages/learn/GlossaryPage'),
  flashcards: () => import('@/pages/learn/FlashcardsPage'),
  spotStyle: () => import('@/pages/learn/SpotTheStylePage'),
  chat: () => import('@/pages/chat/ChatPage'),
  collection: () => import('@/pages/collection/CollectionPage'),
  achievements: () => import('@/pages/achievements/AchievementsPage'),
  profile: () => import('@/pages/profile/ProfilePage'),
  login: () => import('@/pages/auth/LoginPage'),
  register: () => import('@/pages/auth/RegisterPage'),
  styleguide: () => import('@/pages/styleguide/StyleguidePage'),
  notFound: () => import('@/pages/NotFoundPage'),
} as const

export type PageKey = keyof typeof pages

const prefixes: [RegExp, PageKey][] = [
  [/^\/$/, 'home'],
  [/^\/practice\/result\//, 'practiceResult'],
  [/^\/practice\/.+/, 'practiceStudio'],
  [/^\/practice\/?$/, 'practice'],
  [/^\/free-draw/, 'freeDraw'],
  [/^\/learn\/art-forms\//, 'artForm'],
  [/^\/learn\/movements\//, 'movement'],
  [/^\/learn\/artists\//, 'artist'],
  [/^\/learn\/lessons\//, 'lesson'],
  [/^\/learn\/color-lab/, 'colorLab'],
  [/^\/learn\/glossary/, 'glossary'],
  [/^\/learn\/flashcards/, 'flashcards'],
  [/^\/learn\/spot-the-style/, 'spotStyle'],
  [/^\/learn\/?$/, 'learn'],
  [/^\/chat/, 'chat'],
  [/^\/collection/, 'collection'],
  [/^\/achievements/, 'achievements'],
  [/^\/profile/, 'profile'],
  [/^\/login/, 'login'],
  [/^\/register/, 'register'],
]

const preloaded = new Set<PageKey>()

/** Warm the chunk for a path (called on link hover/focus). */
export function preloadRoute(path: string): void {
  const clean = path.split(/[?#]/)[0]
  const hit = prefixes.find(([re]) => re.test(clean))
  if (!hit || preloaded.has(hit[1])) return
  preloaded.add(hit[1])
  void pages[hit[1]]().catch(() => preloaded.delete(hit[1]))
}
