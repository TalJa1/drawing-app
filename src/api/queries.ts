/* TanStack Query bindings. Components use these hooks rather than calling the api functions. */
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { dayKey } from '@/lib/date'
import { queryClient } from '@/app/queryClient'
import { useSession } from '@/store/session'
import { getDailyTemplateId, getTemplate, getTemplatePopularity, getTemplates } from './templates'
import { deleteArtwork, getArtwork, listArtworks, updateArtwork } from './artworks'
import { getAchievements, getChallenges, getLeaderboard, claimChallenge } from './progress'
import { getArtForm, getArtForms, getArtist, getArtists, getGlossary, getLesson, getLessons, getMovement, getMovements } from './learn'

const forever = { staleTime: Infinity, gcTime: Infinity }

export const qk = {
  templates: ['templates'] as const,
  dailyTemplate: (day: string) => ['dailyTemplate', day] as const,
  template: (id: string) => ['templates', id] as const,
  // not under 'templates': ['templates', 'popularity'] would also be the key of a template whose id is "popularity"
  templatePopularity: ['templatePopularity'] as const,
  artworks: ['artworks'] as const,
  artwork: (id: string) => ['artworks', id] as const,
  achievements: ['achievements'] as const,
  challenges: ['challenges'] as const,
  leaderboard: (scope: string) => ['leaderboard', scope] as const,
  lessons: ['lessons'] as const,
  lesson: (slug: string) => ['lessons', slug] as const,
  movements: ['movements'] as const,
  movement: (slug: string) => ['movements', slug] as const,
  artists: ['artists'] as const,
  artist: (slug: string) => ['artists', slug] as const,
  artForms: ['artForms'] as const,
  artForm: (slug: string) => ['artForms', slug] as const,
  glossary: ['glossary'] as const,
}

/**
 * What belongs to one account must not be seen by the next person on this browser. When the token
 * changes (sign-out, or someone else signs in) the queries holding an account's data are cancelled and
 * dropped. Returns the function that stops watching.
 */
const ACCOUNT_QUERIES = [qk.artworks, qk.challenges, qk.achievements, ['leaderboard']] as const

export function watchAccountChange(client: QueryClient): () => void {
  return useSession.subscribe((s, prev) => {
    if (s.token === prev.token) return
    // everything that belongs to one account: ['artworks'] and ['artworks', id], the challenges, the badges and
    // both rankings (['leaderboard', scope])
    for (const queryKey of ACCOUNT_QUERIES) {
      void client.cancelQueries({ queryKey })
      client.removeQueries({ queryKey })
    }
  })
}
watchAccountChange(queryClient)

export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: getTemplates, ...forever })
export const useTemplate = (id: string) => useQuery({ queryKey: qk.template(id), queryFn: () => getTemplate(id), ...forever })

/**
 * How many people practised each template lately, for the "Most popular" order. Fresh for a minute
 * (the server itself keeps the numbers for 15), and not asked again just because the window got
 * focus: the order should not shuffle under someone's cursor. `data` is `undefined` while loading
 * and when it fails; the library then keeps the API's order.
 */
export const useTemplatePopularityQuery = () =>
  useQuery({
    queryKey: qk.templatePopularity,
    queryFn: getTemplatePopularity,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

/** Find a template by id in the list (shared with `useTemplates`); `undefined` until it has loaded. */
export function useTemplateLookup() {
  const { data } = useTemplates()
  return useMemo(() => {
    const byId = new Map((data ?? []).map((t) => [t.id, t]))
    return (id: string | undefined) => (id ? byId.get(id) : undefined)
  }, [data])
}

/**
 * The template of the day, as the server names it (it also credits the challenge, so the app does
 * not keep its own copy of the rule). `undefined` until the answer arrives and when it fails: no
 * guess is better than a template that would not count. The key holds the local day, so a new day
 * asks again.
 */
export function useDailyTemplateQuery() {
  return useQuery({ queryKey: qk.dailyTemplate(dayKey()), queryFn: getDailyTemplateId, staleTime: 10 * 60_000 })
}

/** Just the id of the template of the day (`undefined` while loading and when the server fails). */
export function useDailyTemplateId(): string | undefined {
  return useDailyTemplateQuery().data
}

// The artworks belong to an account: a guest has none, and asking would only be answered with a 401.
const useSignedIn = () => useSession((s) => !!s.token)
export const useArtworks = () => useQuery({ queryKey: qk.artworks, queryFn: listArtworks, staleTime: 0, enabled: useSignedIn() })
export const useArtwork = (id: string) =>
  useQuery({ queryKey: qk.artwork(id), queryFn: () => getArtwork(id), staleTime: 0, retry: 0, enabled: useSignedIn() })

export function useUpdateArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; favourite?: boolean; title?: string }) => updateArtwork(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.artworks }),
  })
}

export function useDeleteArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteArtwork,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.artworks }),
  })
}

export const useAchievements = () => useQuery({ queryKey: qk.achievements, queryFn: getAchievements, staleTime: 0, enabled: useSignedIn() })
export const useChallenges = () => useQuery({ queryKey: qk.challenges, queryFn: getChallenges, staleTime: 0, enabled: useSignedIn() })
export function useClaimChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, periodKey }: { id: string; periodKey: string }) => claimChallenge(id, periodKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.challenges })
      void qc.invalidateQueries({ queryKey: qk.achievements })
      void qc.invalidateQueries({ queryKey: ['leaderboard'] }) // the XP changed, so did the ranking
    },
    // a refused claim means this page is out of date (claimed on another device, progress moved): look again
    onError: () => void qc.invalidateQueries({ queryKey: qk.challenges }),
  })
}
export const useLeaderboard = (scope: 'weekly' | 'all') =>
  useQuery({ queryKey: qk.leaderboard(scope), queryFn: () => getLeaderboard(scope), staleTime: 30_000, enabled: useSignedIn() })

export const useLessons = () => useQuery({ queryKey: qk.lessons, queryFn: getLessons, ...forever })

/** Find a lesson by slug in the list (shared with `useLessons`); `undefined` until it has loaded. */
export function useLessonLookup() {
  const { data } = useLessons()
  return useMemo(() => {
    const bySlug = new Map((data ?? []).map((l) => [l.slug, l]))
    return (slug: string | undefined) => (slug ? bySlug.get(slug) : undefined)
  }, [data])
}
export const useLesson = (slug: string) => useQuery({ queryKey: qk.lesson(slug), queryFn: () => getLesson(slug), ...forever, retry: 0 })
export const useMovements = () => useQuery({ queryKey: qk.movements, queryFn: getMovements, ...forever })
export const useMovement = (slug: string) =>
  useQuery({ queryKey: qk.movement(slug), queryFn: () => getMovement(slug), ...forever, retry: 0 })
export const useArtists = () => useQuery({ queryKey: qk.artists, queryFn: getArtists, ...forever })
export const useArtist = (slug: string) => useQuery({ queryKey: qk.artist(slug), queryFn: () => getArtist(slug), ...forever, retry: 0 })
export const useArtForms = () => useQuery({ queryKey: qk.artForms, queryFn: getArtForms, ...forever })
export const useArtForm = (slug: string) => useQuery({ queryKey: qk.artForm(slug), queryFn: () => getArtForm(slug), ...forever, retry: 0 })
export const useGlossary = () => useQuery({ queryKey: qk.glossary, queryFn: getGlossary, ...forever })
