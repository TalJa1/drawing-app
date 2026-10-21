/* TanStack Query bindings. Components use these hooks; swapping the
   mock functions for real fetch() calls requires no component changes. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTemplate, getTemplates } from './templates'
import { deleteArtwork, getArtwork, listArtworks, updateArtwork } from './artworks'
import { getAchievements, getChallenges, getLeaderboard, claimChallenge } from './progress'
import {
  getArtForm,
  getArtForms,
  getArtist,
  getArtists,
  getGlossary,
  getLesson,
  getLessons,
  getMovement,
  getMovements,
} from './learn'

const forever = { staleTime: Infinity, gcTime: Infinity }

export const qk = {
  templates: ['templates'] as const,
  template: (id: string) => ['templates', id] as const,
  artworks: ['artworks'] as const,
  artwork: (id: string) => ['artworks', id] as const,
  achievements: ['achievements'] as const,
  challenges: ['challenges'] as const,
  leaderboard: (scope: string, filter: string) => ['leaderboard', scope, filter] as const,
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

export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: getTemplates, ...forever })
export const useTemplate = (id: string) => useQuery({ queryKey: qk.template(id), queryFn: () => getTemplate(id), ...forever })

export const useArtworks = () => useQuery({ queryKey: qk.artworks, queryFn: listArtworks, staleTime: 0 })
export const useArtwork = (id: string) => useQuery({ queryKey: qk.artwork(id), queryFn: () => getArtwork(id), staleTime: 0, retry: 0 })

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

export const useAchievements = () => useQuery({ queryKey: qk.achievements, queryFn: getAchievements, staleTime: 0 })
export const useChallenges = () => useQuery({ queryKey: qk.challenges, queryFn: getChallenges, staleTime: 0 })
export function useClaimChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, periodKey }: { id: string; periodKey: string }) => claimChallenge(id, periodKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.challenges })
      void qc.invalidateQueries({ queryKey: qk.achievements })
    },
  })
}
export const useLeaderboard = (scope: 'weekly' | 'all', filter: 'global' | 'friends') =>
  useQuery({ queryKey: qk.leaderboard(scope, filter), queryFn: () => getLeaderboard(scope, filter), staleTime: 30_000 })

export const useLessons = () => useQuery({ queryKey: qk.lessons, queryFn: getLessons, ...forever })
export const useLesson = (slug: string) => useQuery({ queryKey: qk.lesson(slug), queryFn: () => getLesson(slug), ...forever, retry: 0 })
export const useMovements = () => useQuery({ queryKey: qk.movements, queryFn: getMovements, ...forever })
export const useMovement = (slug: string) => useQuery({ queryKey: qk.movement(slug), queryFn: () => getMovement(slug), ...forever, retry: 0 })
export const useArtists = () => useQuery({ queryKey: qk.artists, queryFn: getArtists, ...forever })
export const useArtist = (slug: string) => useQuery({ queryKey: qk.artist(slug), queryFn: () => getArtist(slug), ...forever, retry: 0 })
export const useArtForms = () => useQuery({ queryKey: qk.artForms, queryFn: getArtForms, ...forever })
export const useArtForm = (slug: string) => useQuery({ queryKey: qk.artForm(slug), queryFn: () => getArtForm(slug), ...forever, retry: 0 })
export const useGlossary = () => useQuery({ queryKey: qk.glossary, queryFn: getGlossary, ...forever })
