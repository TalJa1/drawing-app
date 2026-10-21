import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CircleQuestionMark,
  Layers,
  Maximize,
  Palette,
  Redo2,
  Save,
  SlidersHorizontal,
  Timer,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/date'
import { IconButton } from '@/components/IconButton'
import { Tabs } from '@/components/Tabs'
import { Modal, Sheet } from '@/components/Modal'
import { Button } from '@/components/Button'
import { toast } from '@/store/ui'
import { useStudio, type StudioPanel } from '@/store/studio'
import { deleteFile, getFile, putFile } from '@/api/imageStore'
import { useMediaQuery } from '@/lib/hooks'
import type { DrawingEngine } from '../engine/Engine'
import type { BackgroundKind, Draft } from '../engine/types'
import { useCreateEngine, useEngineVersion, useStudioShortcuts } from '../useEngine'
import { CanvasStage } from './CanvasStage'
import { ToolRail } from './ToolRail'
import { ToolOptions } from './ToolOptions'
import { ColourPanel } from './ColourPanel'
import { LayersPanel } from './LayersPanel'
import { OnboardingTour, RestoreDraftModal, ShortcutsModal } from './StudioChrome'

export interface StudioContext {
  engine: DrawingEngine
  seconds: number
  /** remove the autosaved draft (after submitting/saving) */
  clearDraft: () => Promise<void>
  saveDraft: () => Promise<void>
}

export interface StudioProps {
  mode: 'template' | 'free'
  title: string
  subtitle?: ReactNode
  width: number
  height: number
  background: BackgroundKind
  draftKey: string
  backTo: string
  suggestedPalette?: string[]
  /** called once the engine exists (load line art, etc.) */
  onEngine?: (engine: DrawingEngine) => void | Promise<void>
  /** called after each committed stroke */
  onCommit?: (engine: DrawingEngine) => void
  primary: (ctx: StudioContext) => ReactNode
  infoLabel: string
  info: (ctx: StudioContext) => ReactNode
  /** extra element rendered in the top bar before the primary action (e.g. coverage ring) */
  topExtra?: ReactNode
  description: string
}

export function Studio(props: StudioProps) {
  const { t } = useTranslation()
  const { mode, width, height, background, draftKey } = props
  const [hint, setHint] = useState<string | null>(null)
  const onCommitRef = useRef(props.onCommit)
  useEffect(() => {
    onCommitRef.current = props.onCommit
  })
  const engine = useCreateEngine(width, height, background, {
    onCommit: () => onCommitRef.current?.(engine),
    onToolHint: (h) => setHint(h),
  })
  useEngineVersion(engine)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const panel = useStudio((s) => s.panel)
  const setPanel = useStudio((s) => s.set)
  const color = useStudio((s) => s.color)
  const [sheet, setSheet] = useState<StudioPanel | 'options' | null>(null)
  const [shortcuts, setShortcuts] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // hints from the engine (locked layer, nothing to fill…)
  useEffect(() => {
    if (!hint) return
    toast({ title: t(`studio.hints.${hint}`), tone: 'info' })
    const id = window.setTimeout(() => setHint(null), 0)
    return () => window.clearTimeout(id)
  }, [hint, t])

  // engine setup (line art etc.) and draft restore prompt
  const onEngine = props.onEngine
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await onEngine?.(engine)
      const d = await getFile<Draft>(`draft:${draftKey}`)
      if (!cancelled && d && d.width === width && d.height === height && d.strokes > 0) setDraft(d)
    })()
    return () => {
      cancelled = true
    }
  }, [engine, onEngine, draftKey, width, height])

  // session timer (only while the tab is visible)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setSeconds(engine.tick())
    }, 1000)
    return () => window.clearInterval(id)
  }, [engine])

  const saveDraft = useCallback(async () => {
    if (engine.isEmpty()) return
    const d = await engine.serialize()
    await putFile(`draft:${draftKey}`, d)
    engine.markSaved()
    setSavedAt(d.savedAt)
  }, [engine, draftKey])

  const clearDraft = useCallback(async () => {
    await deleteFile(`draft:${draftKey}`)
  }, [draftKey])

  // autosave every 5 seconds when something changed
  useEffect(() => {
    const id = window.setInterval(() => {
      if (engine.version !== engine.savedVersion && !engine.isEmpty()) void saveDraft()
    }, 5000)
    return () => window.clearInterval(id)
  }, [engine, saveDraft])

  const toggleLineArt = useCallback(() => {
    if (engine.lineart) engine.setLayerProps(engine.lineart.id, { visible: !engine.lineart.visible })
  }, [engine])
  const handlers = useMemo(
    () => ({
      onToggleLineArt: toggleLineArt,
      onShortcuts: () => setShortcuts(true),
      onSave: () => {
        void saveDraft().then(() => toast({ title: t('studio.draftSaved'), tone: 'success' }))
      },
    }),
    [toggleLineArt, saveDraft, t],
  )
  useStudioShortcuts(engine, handlers)

  const ctx: StudioContext = { engine, seconds, clearDraft, saveDraft }
  const panelTabs = [
    { id: 'colour' as const, label: t('studio.panels.colour'), icon: <Palette size={15} /> },
    { id: 'layers' as const, label: t('studio.panels.layers'), icon: <Layers size={15} /> },
    { id: 'info' as const, label: props.infoLabel, icon: <Info size={15} /> },
  ]
  const panelBody = (p: StudioPanel) =>
    p === 'colour' ? <ColourPanel suggested={props.suggestedPalette} /> : p === 'layers' ? <LayersPanel engine={engine} /> : props.info(ctx)

  return (
    <div className="flex h-full flex-col">
      {/* ---------- top bar ---------- */}
      <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-card/85 px-2 backdrop-blur-xl sm:px-4">
        <Link
          to={props.backTo}
          aria-label={t('common.back')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1 sm:flex-none">
          <h1 className="truncate font-display text-lg leading-tight sm:text-xl">{props.title}</h1>
          {props.subtitle && <div className="hidden truncate text-xs text-ink-faint sm:block">{props.subtitle}</div>}
        </div>
        <div className="mx-auto hidden items-center gap-1 md:flex">
          <IconButton label={t('studio.undo')} shortcut="Ctrl+Z" icon={<Undo2 size={18} />} onClick={() => engine.undo()} disabled={!engine.canUndo()} />
          <IconButton label={t('studio.redo')} shortcut="Ctrl+Y" icon={<Redo2 size={18} />} onClick={() => engine.redo()} disabled={!engine.canRedo()} />
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <IconButton label={t('studio.zoomOut')} shortcut="-" icon={<ZoomOut size={18} />} onClick={() => engine.zoomBy(0.8)} />
          <button
            type="button"
            onClick={() => engine.setZoom(1)}
            className="h-8 w-14 rounded-full text-center text-xs font-semibold tabular-nums text-ink-soft hover:bg-ink/5"
            aria-label={t('studio.zoomReset')}
          >
            {Math.round(engine.view.zoom * 100)}%
          </button>
          <IconButton label={t('studio.zoomIn')} shortcut="+" icon={<ZoomIn size={18} />} onClick={() => engine.zoomBy(1.25)} />
          <IconButton label={t('studio.fit')} shortcut="0" icon={<Maximize size={17} />} onClick={() => engine.fit()} />
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <IconButton label={t('studio.clear')} icon={<Trash2 size={17} />} onClick={() => setConfirmClear(true)} />
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1.5 text-xs font-semibold tabular-nums text-ink-soft lg:inline-flex" aria-label={t('studio.timer')}>
            <Timer size={14} /> {formatDuration(seconds)}
          </span>
          {props.topExtra}
          <IconButton
            className="hidden sm:inline-flex"
            label={savedAt ? t('studio.savedAt', { time: new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t('studio.saveDraft')}
            icon={<Save size={18} />}
            onClick={() => handlers.onSave()}
          />
          <IconButton className="hidden lg:inline-flex" label={t('studio.shortcuts')} shortcut="?" icon={<CircleQuestionMark size={18} />} onClick={() => setShortcuts(true)} />
          <div data-tour="primary" className="flex items-center gap-2">
            {props.primary(ctx)}
          </div>
        </div>
      </header>

      {/* ---------- options bar ---------- */}
      <div className="relative z-10 hidden h-12 shrink-0 items-center border-b border-line bg-card/70 px-4 backdrop-blur md:flex">
        <ToolOptions />
      </div>

      {/* ---------- workspace ---------- */}
      <div className="relative flex min-h-0 flex-1">
        {desktop && (
          <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
            <ToolRail />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <CanvasStage engine={engine} description={props.description} />
        </div>
        {desktop && (
          <aside className="paper relative z-10 flex w-[340px] shrink-0 flex-col border-l border-line" aria-label={t('studio.panels.label')}>
            <Tabs className="border-b border-line px-3 pt-2" items={panelTabs} value={panel} onChange={(p) => setPanel({ panel: p })} size="sm" ariaLabel={t('studio.panels.label')} />
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">{panelBody(panel)}</div>
          </aside>
        )}
      </div>

      {/* ---------- mobile dock ---------- */}
      {!desktop && (
        <div className="relative z-20 shrink-0 border-t border-line bg-card/90 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-1.5">
            <IconButton size="md" label={t('studio.undo')} icon={<Undo2 size={18} />} onClick={() => engine.undo()} disabled={!engine.canUndo()} noTooltip />
            <IconButton size="md" label={t('studio.redo')} icon={<Redo2 size={18} />} onClick={() => engine.redo()} disabled={!engine.canRedo()} noTooltip />
            <IconButton size="md" label={t('studio.fit')} icon={<Maximize size={17} />} onClick={() => engine.fit()} noTooltip />
            <span className="ml-1 rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-soft">{formatDuration(seconds)}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <IconButton size="md" label={t('studio.toolOptions')} icon={<SlidersHorizontal size={18} />} onClick={() => setSheet('options')} noTooltip />
              <button
                type="button"
                onClick={() => setSheet('colour')}
                aria-label={t('studio.panels.colour')}
                className="h-10 w-10 rounded-full border-2 border-card shadow-[0_0_0_1px_var(--line-strong)]"
                style={{ background: color }}
              />
              <IconButton size="md" label={t('studio.panels.layers')} icon={<Layers size={18} />} onClick={() => setSheet('layers')} noTooltip />
              <IconButton size="md" label={props.infoLabel} icon={<Info size={18} />} onClick={() => setSheet('info')} noTooltip />
            </div>
          </div>
          <ToolRail orientation="horizontal" className="!rounded-2xl !shadow-none" />
        </div>
      )}

      {!desktop && (
        <Sheet
          open={sheet !== null}
          onClose={() => setSheet(null)}
          title={sheet === 'options' ? t('studio.toolOptions') : sheet === 'info' ? props.infoLabel : sheet ? t(`studio.panels.${sheet}`) : ''}
        >
          {sheet === 'options' ? (
            <div className="flex flex-col gap-4 [&_label]:min-w-0">
              <ToolOptions className="!flex-col !items-stretch !gap-4" />
              <Button variant="outline" icon={<Trash2 size={16} />} onClick={() => setConfirmClear(true)}>
                {t('studio.clear')}
              </Button>
            </div>
          ) : (
            sheet && panelBody(sheet)
          )}
        </Sheet>
      )}

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title={t('studio.clearTitle')} description={t('studio.clearBody')} size="sm">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmClear(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="pigment"
            className="flex-1"
            onClick={() => {
              engine.clearLayer()
              setConfirmClear(false)
            }}
          >
            {t('studio.clear')}
          </Button>
        </div>
      </Modal>
      <ShortcutsModal open={shortcuts} onClose={() => setShortcuts(false)} />
      <RestoreDraftModal
        open={!!draft}
        savedAt={draft?.savedAt}
        onRestore={() => {
          if (!draft) return
          void engine.load(draft).then(() => {
            setSeconds(engine.seconds)
            engine.markSaved()
            setDraft(null)
          })
        }}
        onFresh={() => {
          setDraft(null)
          void clearDraft()
        }}
      />
      {!draft && <OnboardingTour mode={mode} />}
      <div className={cn('sr-only')} aria-live="polite">
        {engine.activeLayer?.name}
      </div>
    </div>
  )
}
