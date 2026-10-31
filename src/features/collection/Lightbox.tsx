import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Heart, Paintbrush, Trash2 } from 'lucide-react'
import type { Artwork } from '@/types'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Meter } from '@/components/Progress'
import { WallLabel } from '@/components/Frame'
import { useDeleteArtwork, useTemplateLookup, useUpdateArtwork } from '@/api/queries'
import { getImageBlob } from '@/api/artworks'
import { recordActivity } from '@/api/progress'
import { useL } from '@/i18n/useL'
import { cn, downloadBlob } from '@/lib/utils'
import { formatDate, formatMinutes } from '@/lib/date'
import { presentReward, toast } from '@/store/ui'
import { ArtworkImage } from './ArtworkImage'

/** Large artwork view with details and actions; arrow keys move between artworks. */
export function Lightbox({
  artworks,
  index,
  onIndex,
  onClose,
}: {
  artworks: Artwork[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const update = useUpdateArtwork()
  const remove = useDeleteArtwork()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const art = index !== null ? artworks[index] : null
  const templateOf = useTemplateLookup()
  const template = templateOf(art?.templateId)

  const go = (d: number) => {
    if (index === null) return
    onIndex((index + d + artworks.length) % artworks.length)
  }

  const download = async () => {
    if (!art) return
    const blob = await getImageBlob(art.imageKey)
    if (!blob) return
    downloadBlob(blob, `art-spark-${art.title.toLowerCase().replace(/\W+/g, '-')}.png`)
    toast({ title: t('studio.downloaded', { type: 'PNG' }), tone: 'success' })
    presentReward(await recordActivity({ type: 'download' }))
  }

  return (
    <Modal open={!!art} onClose={onClose} size="full" title={art?.title}>
      {art && (
        <div
          className="grid gap-8 lg:grid-cols-[1.6fr_1fr]"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
        >
          <div className="relative">
            <div className="frame" style={{ '--frame-w': '12px' } as React.CSSProperties}>
              <div className="mat" style={{ '--mat-w': '14px' } as React.CSSProperties}>
                <ArtworkImage imageKey={art.imageKey} alt={art.title} aspect={art.width / art.height} fit="contain" className="art" />
              </div>
            </div>
            {artworks.length > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <IconButton label={t('collection.previous')} icon={<ChevronLeft size={18} />} variant="paper" onClick={() => go(-1)} />
                <span className="text-sm tabular-nums text-ink-faint">
                  {index! + 1} / {artworks.length}
                </span>
                <IconButton label={t('collection.next')} icon={<ChevronRight size={18} />} variant="paper" onClick={() => go(1)} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <WallLabel
              title={art.title}
              lines={[
                art.kind === 'practice' ? t('collection.kind.practice') : t('collection.kind.free'),
                art.medium,
                `${formatDate(art.createdAt, i18n.language)} · ${formatMinutes(art.timeSpent)}`,
                template ? t('collection.fromTemplate', { title: L(template.title) }) : '',
              ]}
            />
            {art.score ? (
              <div className="space-y-4 rounded-2xl border border-line p-4">
                <p className="flex items-baseline justify-between">
                  <span className="eyebrow">{t('collection.judgeScore')}</span>
                  <span className={cn('font-display text-4xl', art.score.overall >= 85 && 'gold-text')}>{art.score.overall}</span>
                </p>
                <Meter value={art.score.similarity} label={t('result.similarity')} color="var(--viz-2)" />
                <Meter value={art.score.colour} label={t('result.colour')} color="var(--viz-3)" />
                <p className="hand text-xl text-accent-ink">“{L(art.score.judgeNote)}”</p>
                <Link to={`/practice/result/${art.id}`} className="link-ink inline-flex items-center gap-1 text-sm" onClick={onClose}>
                  {t('collection.viewResult')} <ExternalLink size={13} />
                </Link>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-faint">{t('collection.notJudged')}</p>
            )}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={art.favourite ? 'gold' : 'outline'}
                icon={<Heart size={15} className={art.favourite ? 'fill-current' : ''} />}
                onClick={() => update.mutate({ id: art.id, favourite: !art.favourite })}
              >
                {art.favourite ? t('result.inFavourites') : t('result.saveFavourite')}
              </Button>
              <Button size="sm" variant="outline" icon={<Download size={15} />} onClick={() => void download()}>
                {t('common.download')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Paintbrush size={15} />}
                onClick={() => {
                  onClose()
                  navigate(art.kind === 'practice' && art.templateId ? `/practice/${art.templateId}` : '/free-draw')
                }}
              >
                {t('collection.reopen')}
              </Button>
              <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('collection.deleteTitle')}
        description={t('collection.deleteBody')}
        size="sm"
      >
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="pigment"
            className="flex-1"
            onClick={() => {
              if (!art) return
              remove.mutate(art.id, {
                onSuccess: () => {
                  toast({ title: t('collection.deleted'), tone: 'info' })
                  setConfirmDelete(false)
                  onClose()
                },
              })
            }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </Modal>
  )
}
