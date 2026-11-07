import { useEffect, useRef, useState, type RefObject } from 'react'
import { acquireImage } from '@/api/artworks'
import { cn } from '@/lib/utils'

/** A picture is asked for when it comes within this far of the screen… */
const LOAD_MARGIN = '400px 0px'
/** …and let go of when it is farther than this (more than the first, so it does not flicker at the edge). */
const UNLOAD_MARGIN = '1600px 0px'

/**
 * True while a card is close enough to the screen for its picture to be worth having. Without
 * `enabled`, or in a browser that cannot watch (no IntersectionObserver), it is always true.
 */
function useNearScreen(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const canWatch = typeof IntersectionObserver !== 'undefined'
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !canWatch || !el) return
    const last = (entries: IntersectionObserverEntry[]) => entries[entries.length - 1]
    const coming = new IntersectionObserver((e) => last(e)?.isIntersecting && setNear(true), { rootMargin: LOAD_MARGIN })
    const going = new IntersectionObserver((e) => last(e) && !last(e).isIntersecting && setNear(false), { rootMargin: UNLOAD_MARGIN })
    coming.observe(el)
    going.observe(el)
    return () => {
      coming.disconnect()
      going.disconnect()
    }
  }, [ref, enabled, canWatch])
  return !enabled || !canWatch || near
}

/**
 * Shows an artwork picture from the account (fetched with the token → object URL) with a paint-shimmer
 * placeholder. With `lazy` (long grids) the picture is only fetched once the card is near the screen, and
 * is let go of again when the card is far off it, so a big collection never holds every picture at once.
 */
export function ArtworkImage({
  imageKey,
  alt,
  className,
  aspect,
  fit = 'cover',
  lazy = false,
}: {
  imageKey: string
  alt: string
  className?: string
  /** width / height, keeps layout stable while loading */
  aspect: number
  fit?: 'cover' | 'contain'
  lazy?: boolean
}) {
  const frame = useRef<HTMLDivElement>(null)
  const wanted = useNearScreen(frame, lazy)
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  useEffect(() => {
    if (!wanted) return
    let alive = true
    let held: { release: () => void } | null = null
    acquireImage(imageKey).then(
      (lease) => {
        if (!alive) {
          lease?.release() // arrived after the card was gone
          return
        }
        if (lease) {
          held = lease
          setShown({ key: imageKey, url: lease.url })
        } else setFailedKey(imageKey)
      },
      () => alive && setFailedKey(imageKey),
    )
    return () => {
      alive = false
      held?.release()
      setShown(null) // the object URL may be revoked once released: never keep showing it
    }
  }, [imageKey, wanted])
  const url = wanted && shown?.key === imageKey ? shown.url : null
  const failed = failedKey === imageKey
  return (
    <div ref={frame} className={cn('relative w-full overflow-hidden bg-white', className)} style={{ aspectRatio: aspect }}>
      {url ? (
        <img
          src={url}
          alt={alt}
          className={cn('absolute inset-0 h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
          decoding="async"
        />
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-2 text-xs text-ink-faint">{alt}</div>
      ) : (
        <div className="skeleton absolute inset-0 rounded-none" />
      )}
    </div>
  )
}
