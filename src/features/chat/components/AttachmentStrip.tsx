import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { PreparedImage } from '../attachments'

function Preview({ image }: { image: PreparedImage }) {
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(image.previewBlob)
    let alive = true
    void Promise.resolve().then(() => {
      if (alive) setPreview({ blob: image.previewBlob, url })
    })
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [image.previewBlob])
  return preview?.blob === image.previewBlob ? (
    <img src={preview.url} alt={image.name} className="h-16 w-20 rounded-xl border border-line object-cover" />
  ) : null
}

export function AttachmentStrip({
  images,
  preparing,
  onRemove,
}: {
  images: PreparedImage[]
  preparing: number
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {images.map((image) => (
        <span key={image.id} className="relative">
          <Preview image={image} />
          <button
            type="button"
            aria-label={t('chat.removeAttachment')}
            onClick={() => onRemove(image.id)}
            className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper"
          >
            <X size={14} />
          </button>
        </span>
      ))}
      {Array.from({ length: preparing }, (_, index) => (
        <div key={index} role="img" aria-label={t('chat.attach.preparing')} className="skeleton h-16 w-20 rounded-xl" />
      ))}
    </div>
  )
}
