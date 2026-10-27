import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { chatVariants } from '../motion'
import { X } from 'lucide-react'
import type { PreparedImage } from '../attachments'

function Preview({ image }: { image: PreparedImage }) {
  const present = useIsPresent()
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  useEffect(() => {
    if (!present) return
    const url = URL.createObjectURL(image.previewBlob)
    let alive = true
    void Promise.resolve().then(() => {
      if (alive) setPreview({ blob: image.previewBlob, url })
    })
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [image.previewBlob, present])
  return present && preview?.blob === image.previewBlob ? (
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
  const reduced = useReducedMotion()
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {images.map((image) => (
          <motion.span
            key={image.id}
            variants={chatVariants(reduced).attachment}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout={!reduced}
            className="relative"
          >
            <Preview image={image} />
            <button
              type="button"
              aria-label={t('chat.removeAttachment')}
              onClick={() => onRemove(image.id)}
              className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper"
            >
              <X size={14} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {Array.from({ length: preparing }, (_, index) => (
        <div key={index} role="img" aria-label={t('chat.attach.preparing')} className="skeleton h-16 w-20 rounded-xl" />
      ))}
    </div>
  )
}
