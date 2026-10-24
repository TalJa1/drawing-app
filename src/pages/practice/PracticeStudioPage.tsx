import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Ghost, Lock, Sparkles } from 'lucide-react'
import type { Template } from '@/types'
import { Studio, type StudioContext } from '@/features/drawing/ui/Studio'
import type { DrawingEngine } from '@/features/drawing/engine/Engine'
import { analyse, computeRegions, coverageOf, ghostMask, type Regions } from '@/features/drawing/analysis'
import { ScoringCeremony } from '@/features/practice/ScoringCeremony'
import { TemplateImage } from '@/features/practice/TemplateCard'
import { DIFF_LEVEL } from '@/features/practice/constants'
import { useTemplate } from '@/api/queries'
import { submitArtwork } from '@/api/artworks'
import { scoreArtwork } from '@/api/scoring'
import { recordActivity } from '@/api/progress'
import { dailyTemplateId } from '@/api/templates'
import { ApiError } from '@/api/client'
import { useCollection } from '@/store/collection'
import { useLastResult } from '@/store/ui'
import { useLevel } from '@/features/gamification/hooks'
import { useL } from '@/i18n/useL'
import { canvasToBlob, loadSvgImage, makeThumbnail, blobToDataUrl } from '@/lib/raster'
import { Button, ButtonLink } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { ProgressRing } from '@/components/Progress'
import { DifficultyDots } from '@/components/Chip'
import { EmptyState, Page } from '@/components/Layout'
import { PageLoader } from '@/components/PageLoader'
import { queryClient } from '@/app/queryClient'
import { qk } from '@/api/queries'

function PracticeStudio({ template }: { template: Template }) {
  const { t } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const [regions, setRegions] = useState<Regions | null>(null)
  const [coverage, setCoverage] = useState(0)
  const [confirm, setConfirm] = useState<{ ctx: StudioContext; preview: string } | null>(null)
  const [ceremony, setCeremony] = useState<{ preview: string; error: string | null } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<StudioContext | null>(null)
  const setLast = useLastResult((s) => s.set)
  const title = L(template.title)

  const onEngine = useCallback(
    async (engine: DrawingEngine) => {
      const img = await loadSvgImage(template.svg)
      engine.setLineArt(img)
      // default layer stack: a colour layer under a trace layer
      if (engine.layers.length === 1 && engine.isEmpty()) {
        engine.setLayerProps(engine.layers[0].id, { name: t('studio.layers.colourLayer') })
        engine.addLayer(t('studio.layers.traceLayer'))
        engine.setActive(engine.layers[0].id)
      }
      const { ink, w, h } = engine.analysisPixels()
      setRegions(computeRegions(ink?.data ?? null, w, h))
    },
    [template, t],
  )

  const measure = useCallback(
    (engine: DrawingEngine) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (!regions) return
        setCoverage(coverageOf(engine.analysisPixels().paint.data, regions))
      }, 350)
    },
    [regions],
  )

  const ghost = (engine: DrawingEngine) => {
    if (!regions) return
    const mask = ghostMask(engine.analysisPixels().paint.data, regions)
    if (!mask) return
    const c = document.createElement('canvas')
    c.width = mask.width
    c.height = mask.height
    c.getContext('2d')!.putImageData(mask, 0, 0)
    engine.flash(c)
  }

  const openConfirm = async (ctx: StudioContext) => {
    const thumb = await makeThumbnail(ctx.engine.composite(), 520)
    setConfirm({ ctx, preview: await blobToDataUrl(thumb) })
  }

  const runScoring = async (ctx: StudioContext | null) => {
    if (!ctx || !regions) return
    setCeremony((c) => (c ? { ...c, error: null } : c))
    const started = performance.now()
    try {
      const engine = ctx.engine
      const canvas = engine.composite()
      const analysis = analyse(engine.analysisPixels().paint.data, regions, template.suggestedPalette, engine.strokes)
      const previous = useCollection
        .getState()
        .artworks.filter((a) => a.templateId === template.id && a.score)
        .reduce<number | undefined>((m, a) => Math.max(m ?? 0, a.score!.overall), undefined)
      const artwork = await submitArtwork({
        title,
        templateId: template.id,
        image: await canvasToBlob(canvas, 'image/png'),
        thumbnail: await makeThumbnail(canvas),
        width: engine.width,
        height: engine.height,
        timeSpent: ctx.seconds,
        medium: t('practice.medium'),
        analysis,
      })
      const score = await scoreArtwork(artwork.id)
      const reward = await recordActivity({
        type: 'artworkScored',
        score,
        templateId: template.id,
        category: template.category,
        seconds: ctx.seconds,
        isDaily: template.id === dailyTemplateId(),
        distinctHues: analysis.distinctHues,
        previousBest: previous,
      })
      await ctx.clearDraft()
      void queryClient.invalidateQueries({ queryKey: qk.artworks })
      // keep the ceremony on screen for at least ~3.5 s — it's part of the magic
      const wait = 3500 - (performance.now() - started)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      setLast(artwork.id, reward)
      navigate(`/practice/result/${artwork.id}`)
    } catch (e) {
      setCeremony((c) => (c ? { ...c, error: e instanceof ApiError ? e.message : t('common.errorGeneric') } : c))
    }
  }

  const startScoring = () => {
    if (!confirm) return
    pending.current = confirm.ctx
    setCeremony({ preview: confirm.preview, error: null })
    setConfirm(null)
    void runScoring(confirm.ctx)
  }

  const info = (ctx: StudioContext) => {
    const la = ctx.engine.lineart
    return (
      <div className="flex flex-col gap-5">
        <section>
          <p className="eyebrow mb-2">{t('practice.studio.reference')}</p>
          <div className="overflow-hidden rounded-xl border-[6px] border-[var(--mat)] bg-white shadow-paper">
            <div className="aspect-[4/3] p-1.5">
              <TemplateImage template={template} alt={t('practice.studio.referenceAlt', { title })} />
            </div>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={la?.visible === false ? <Eye size={15} /> : <EyeOff size={15} />}
            onClick={() => la && ctx.engine.setLayerProps(la.id, { visible: !la.visible })}
          >
            {la?.visible === false ? t('practice.studio.showLines') : t('practice.studio.hideLines')}
          </Button>
          <Button size="sm" variant="outline" icon={<Ghost size={15} />} onClick={() => ghost(ctx.engine)} disabled={!regions}>
            {t('practice.studio.ghost')}
          </Button>
        </div>
        <section className="flex items-center gap-4 rounded-2xl border border-line p-3">
          <ProgressRing value={coverage} size={64} color="var(--viz-3)" label={t('practice.studio.coverage')}>
            <span className="text-sm font-bold tabular-nums">{Math.round(coverage * 100)}%</span>
          </ProgressRing>
          <div>
            <p className="font-medium">{t('practice.studio.coverage')}</p>
            <p className="text-sm text-ink-faint">
              {coverage < 0.5
                ? t('practice.studio.coverageLow')
                : coverage < 0.85
                  ? t('practice.studio.coverageMid')
                  : t('practice.studio.coverageHigh')}
            </p>
          </div>
        </section>
        <section className="space-y-2 rounded-2xl border border-line p-3 text-sm">
          <p className="flex items-center justify-between">
            <span className="text-ink-faint">{t('practice.studio.difficulty')}</span>
            <span className="inline-flex items-center gap-2">
              <DifficultyDots level={DIFF_LEVEL[template.difficulty]} label={t(`difficulty.${template.difficulty}`)} />
              {t(`difficulty.${template.difficulty}`)}
            </span>
          </p>
          <p className="flex items-center justify-between">
            <span className="text-ink-faint">{t('practice.studio.time')}</span>
            <span>{t('common.minutes', { count: template.minutes })}</span>
          </p>
          <p className="flex items-center justify-between">
            <span className="text-ink-faint">{t('practice.studio.category')}</span>
            <span>{t(`practice.categories.${template.category}`)}</span>
          </p>
        </section>
        <p className="hand -rotate-1 text-xl leading-snug text-accent-ink">{t('practice.studio.tip')}</p>
      </div>
    )
  }

  return (
    <>
      <Studio
        mode="template"
        title={title}
        subtitle={`${t(`practice.categories.${template.category}`)} · ${t(`difficulty.${template.difficulty}`)}`}
        width={1200}
        height={900}
        background="white"
        draftKey={`tpl:${template.id}`}
        backTo="/practice"
        suggestedPalette={template.suggestedPalette}
        onEngine={onEngine}
        onCommit={measure}
        infoLabel={t('practice.studio.infoTab')}
        info={info}
        description={t('practice.studio.description', { title })}
        topExtra={
          <span className="hidden md:inline-flex" title={t('practice.studio.coverage')}>
            <ProgressRing value={coverage} size={38} stroke={4} color="var(--viz-3)" label={t('practice.studio.coverage')}>
              <span className="text-[10px] font-bold tabular-nums">{Math.round(coverage * 100)}</span>
            </ProgressRing>
          </span>
        }
        primary={(ctx) => (
          <Button variant="pigment" size="sm" icon={<Sparkles size={16} />} onClick={() => void openConfirm(ctx)}>
            <span className="hidden sm:inline">{t('practice.studio.submit')}</span>
            <span className="sm:hidden">{t('practice.studio.submitShort')}</span>
          </Button>
        )}
      />
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={t('practice.confirm.title')} size="md">
        {confirm && (
          <div>
            <div className="frame mx-auto max-w-sm" style={{ '--frame-w': '9px' } as React.CSSProperties}>
              <div className="mat" style={{ '--mat-w': '9px' } as React.CSSProperties}>
                <img
                  src={confirm.preview}
                  alt={t('practice.confirm.previewAlt')}
                  className="art aspect-[4/3] w-full bg-white object-contain"
                />
              </div>
            </div>
            <p className="mt-5 text-center text-ink-soft">
              {coverage < 0.3 ? t('practice.confirm.lowCoverage', { pct: Math.round(coverage * 100) }) : t('practice.confirm.body')}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
                {t('practice.confirm.keep')}
              </Button>
              <Button variant="pigment" className="flex-1" icon={<Sparkles size={16} />} onClick={startScoring} data-autofocus>
                {t('practice.confirm.submit')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <AnimatePresence>
        {ceremony && (
          <ScoringCeremony
            image={ceremony.preview}
            error={ceremony.error}
            onRetry={() => void runScoring(pending.current)}
            onCancel={() => setCeremony(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function PracticeStudioPage() {
  const { templateId = '' } = useParams()
  const { t } = useTranslation()
  const { data: template, isLoading, isError } = useTemplate(templateId)
  const { level } = useLevel()

  if (isLoading) return <PageLoader />
  if (isError || !template)
    return (
      <Page className="paper-bg h-full overflow-auto">
        <EmptyState
          title={t('practice.studio.notFound')}
          body={t('practice.studio.notFoundBody')}
          action={<ButtonLink to="/practice">{t('practice.backToLibrary')}</ButtonLink>}
        />
      </Page>
    )
  if (template.unlockLevel > level)
    return (
      <Page className="paper-bg h-full overflow-auto">
        <EmptyState
          art={<Lock size={48} className="text-ink" />}
          title={t('practice.studio.lockedTitle', { level: template.unlockLevel })}
          body={t('practice.studio.lockedBody', { level })}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/practice" variant="ink">
                {t('practice.backToLibrary')}
              </ButtonLink>
              <Link to="/achievements" className="link-ink self-center">
                {t('practice.studio.howToLevel')}
              </Link>
            </div>
          }
        />
      </Page>
    )
  return <PracticeStudio key={template.id} template={template} />
}
