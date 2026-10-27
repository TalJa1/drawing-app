import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useArtworks } from '@/api/queries'
import { getImageBlob, getImageUrl } from '@/api/artworks'
import { toast } from '@/store/ui'
import { AttachmentError, prepareImage } from '../attachments'
import type { PreparedImage } from '../attachments'

function Thumbnail({ imageKey, alt }: { imageKey: string; alt: string }) {
  const [image, setImage] = useState<{ key: string; url: string } | null>(null)
  useEffect(() => {
    let alive = true
    void getImageUrl(imageKey)
      .then((url) => {
        if (alive && url) setImage({ key: imageKey, url })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [imageKey])
  return image?.key === imageKey ? (
    <img src={image.url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
  ) : (
    <div className="skeleton aspect-[4/3] w-full rounded-lg" aria-label={alt} />
  )
}

export function AttachmentPicker({
  open,
  onClose,
  onPick,
  disabled = false,
}: {
  open: boolean
  onClose: () => void
  onPick: (image: PreparedImage) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const { data } = useArtworks()
  const input = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const pending = useRef(false)
  const [preparing, setPreparing] = useState<string | null>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const pick = async (key: string, name: string, file?: Blob) => {
    if (pending.current || disabled) return
    pending.current = true
    setPreparing(key)
    try {
      const blob = file ?? (await getImageBlob(key))
      if (!active.current) return
      if (!blob) {
        toast({ title: t('chat.attach.errors.missing'), tone: 'error' })
        return
      }
      const image = await prepareImage(blob, name)
      if (active.current) {
        onPick(image)
        onClose()
      }
    } catch (error) {
      if (active.current)
        toast({ title: t(`chat.attach.errors.${error instanceof AttachmentError ? error.code : 'decode'}`), tone: 'error' })
    } finally {
      pending.current = false
      if (active.current) setPreparing(null)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('chat.attach.title')} size="lg">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || preparing !== null}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.currentTarget.value = ''
          if (file) void pick('upload', file.name, file)
        }}
      />
      <Button
        variant="outline"
        icon={<Upload size={16} />}
        disabled={disabled || preparing !== null}
        onClick={() => input.current?.click()}
      >
        {t('chat.attach.upload')}
      </Button>
      {preparing === 'upload' && <div role="img" aria-label={t('chat.attach.preparing')} className="skeleton mt-3 h-16 w-20 rounded-xl" />}
      <p className="eyebrow mt-6">{t('chat.attach.fromCollection')}</p>
      {data?.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data.slice(0, 16).map((artwork) => (
            <li key={artwork.id}>
              <button
                type="button"
                disabled={disabled || preparing !== null}
                aria-label={artwork.title}
                aria-busy={preparing === artwork.imageKey}
                onClick={() => void pick(artwork.imageKey, artwork.title)}
                className="block min-h-11 w-full rounded-xl border border-line p-1 hover:border-ink"
              >
                {preparing === artwork.imageKey ? (
                  <div role="img" aria-label={t('chat.attach.preparing')} className="skeleton aspect-[4/3] rounded-lg" />
                ) : (
                  <Thumbnail imageKey={artwork.thumbKey} alt={artwork.title} />
                )}
                <span className="mt-1 block truncate text-xs">{artwork.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">{t('chat.attach.empty')}</p>
      )}
    </Modal>
  )
}
