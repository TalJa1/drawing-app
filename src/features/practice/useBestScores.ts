import { useMemo } from 'react'
import { useArtworks } from '@/api/queries'

/** Best overall score per template from the user's scored practice artworks. */
export function useBestScores(): Record<string, number> {
  const { data } = useArtworks()
  return useMemo(() => {
    const best: Record<string, number> = {}
    for (const a of data ?? []) {
      if (a.kind !== 'practice' || !a.templateId || !a.score) continue
      best[a.templateId] = Math.max(best[a.templateId] ?? 0, a.score.overall)
    }
    return best
  }, [data])
}
