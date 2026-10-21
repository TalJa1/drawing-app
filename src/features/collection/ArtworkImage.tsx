import { useEffect, useState } from 'react'
import { getImageUrl } from '@/api/artworks'
import { cn } from '@/lib/utils'

/** Loads an artwork image (IndexedDB blob → object URL) with a paint-shimmer placeholder. */
export function ArtworkImage({
  imageKey,
  alt,
  className,
  aspect,
  fit = 'cover',
}: {
  imageKey: string
  alt: string
  className?: string
  /** width / height, keeps layout stable while loading */
  aspect: number
  fit?: 'cover' | 'contain'
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    getImageUrl(imageKey).then(
      (u) => {
        if (!alive) return
        if (u) setUrl(u)
        else setFailed(true)
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [imageKey])
  return (
    <div className={cn('relative w-full overflow-hidden bg-white', className)} style={{ aspectRatio: aspect }}>
      {url ? (
        <img src={url} alt={alt} className={cn('absolute inset-0 h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} decoding="async" />
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-2 text-xs text-ink-faint">{alt}</div>
      ) : (
        <div className="skeleton absolute inset-0 rounded-none" />
      )}
    </div>
  )
}
