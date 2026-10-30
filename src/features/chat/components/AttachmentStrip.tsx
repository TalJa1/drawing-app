import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { chatVariants } from '../motion'
import { X } from 'lucide-react'
import type { PreparedImage } from '../attachments'

function Preview({ image, onRemove }: { image: PreparedImage; onRemove: (id: string) => void }) {
  const { t } = useTranslation()
  const present = useIsPresent()
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
  return (
    <>
      {preview?.blob === image.previewBlob && (
        <img src={preview.url} alt={image.name} className="h-16 w-20 rounded-xl border border-line object-cover" />
      )}
      <button
        type="button"
        disabled={!present}
        aria-label={t('chat.removeAttachment')}
        onClick={() => onRemove(image.id)}
        className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper"
      >
        <X size={14} />
      </button>
    </>
  )
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
  const previews = images.map((image) => (
    <motion.span
      key={image.id}
      variants={chatVariants(reduced).attachment}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout={!reduced}
      className="relative"
    >
      <Preview image={image} onRemove={onRemove} />
    </motion.span>
  ))
  return (
    <div className="mb-2 flex flex-wrap gap-2 empty:mb-0">
      {reduced ? previews : <AnimatePresence initial={false}>{previews}</AnimatePresence>}
      {Array.from({ length: preparing }, (_, index) => (
        <div key={index} role="img" aria-label={t('chat.attach.preparing')} className="skeleton h-16 w-20 rounded-xl" />
      ))}
    </div>
  )
}
