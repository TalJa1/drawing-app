import { useEffect } from 'react'
import { recordActivity } from '@/api/progress'
import { useProgress } from '@/store/progress'
import { presentReward } from '@/store/ui'

/** Records a first visit to an Atlas page (for exploration badges). */
export function useViewed(what: 'movement' | 'artForm' | 'artist', slug: string | undefined) {
  useEffect(() => {
    if (!slug) return
    const stats = useProgress.getState().stats
    const seen = what === 'movement' ? stats.movementsViewed : what === 'artForm' ? stats.artFormsViewed : stats.artistsViewed
    if (seen.includes(slug)) return
    const id = window.setTimeout(() => {
      void recordActivity({ type: 'viewed', what, slug }).then(presentReward)
    }, 800)
    return () => window.clearTimeout(id)
  }, [what, slug])
}
