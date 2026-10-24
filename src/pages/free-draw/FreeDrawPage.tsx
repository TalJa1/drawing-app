import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Dices, Download, ImageDown, MessageCircle, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Studio, type StudioContext } from '@/features/drawing/ui/Studio'
import type { BackgroundKind } from '@/features/drawing/engine/types'
import { BACKGROUNDS } from '@/features/drawing/engine/types'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/Form'
import { canvasToBlob, makeThumbnail } from '@/lib/raster'
import { downloadBlob } from '@/lib/utils'
import { saveArtwork } from '@/api/artworks'
import { recordActivity } from '@/api/progress'
import { INSPIRATION_PROMPTS } from '@/mocks/palettes'
import { useL } from '@/i18n/useL'
import { presentReward, toast } from '@/store/ui'
import { useChat } from '@/store/chat'
import { useStudio } from '@/store/studio'
import { queryClient } from '@/app/queryClient'
import { qk } from '@/api/queries'

const PRESETS = {
  classic: [1200, 900],
  square: [1080, 1080],
  wide: [1600, 900],
  a4: [1240, 1754],
  story: [1080, 1920],
} as const
type Preset = keyof typeof PRESETS

function DownloadMenu({ ctx }: { ctx: StudioContext }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const run = async (type: 'png' | 'jpg') => {
    setOpen(false)
    const transparent = ctx.engine.background === 'transparent'
    const canvas = ctx.engine.composite({ background: true })
    let blob: Blob
    if (type === 'jpg' && transparent) {
      // JPEG has no alpha: flatten onto white
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = canvas.height
      const x = c.getContext('2d')!
      x.fillStyle = '#ffffff'
      x.fillRect(0, 0, c.width, c.height)
      x.drawImage(canvas, 0, 0)
      blob = await canvasToBlob(c, 'image/jpeg', 0.92)
    } else blob = await canvasToBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', 0.92)
    downloadBlob(blob, `art-spark-${new Date().toISOString().slice(0, 10)}.${type}`)
    toast({ title: t('studio.downloaded', { type: type.toUpperCase() }), tone: 'success' })
    presentReward(await recordActivity({ type: 'download' }))
  }
  return (
    <div className="relative">
      <Button
        variant="pigment"
        size="sm"
        icon={<Download size={16} />}
        iconRight={<ChevronDown size={14} />}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="hidden sm:inline">{t('common.download')}</span>
      </Button>
      {open && (
        <div role="menu" className="paper absolute right-0 top-[calc(100%+8px)] z-30 w-44 rounded-2xl border border-line p-1.5 shadow-lift">
          {(['png', 'jpg'] as const).map((k) => (
            <button
              key={k}
              role="menuitem"
              type="button"
              onClick={() => void run(k)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink/5"
            >
              <ImageDown size={15} /> {t(`studio.download${k === 'png' ? 'Png' : 'Jpg'}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FreeDrawPage() {
  const { t } = useTranslation()
  const L = useL()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [preset, setPreset] = useState<Preset>((params.get('size') as Preset) in PRESETS ? (params.get('size') as Preset) : 'classic')
  const [bg, setBg] = useState<BackgroundKind>('white')
  const [prompt, setPrompt] = useState(() => {
    const p = params.get('prompt')
    return p ? { en: p, vi: p } : null
  })
  const [saving, setSaving] = useState<StudioContext | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [w, h] = PRESETS[preset]
  const setDraftChat = useChat((s) => s.setDraft)
  const pending = useStudio((s) => s.pendingPalette)

  const inspire = useCallback(() => {
    const p = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)]
    setPrompt(p)
  }, [])

  const save = async () => {
    if (!saving) return
    setBusy(true)
    try {
      const canvas = saving.engine.composite()
      const image = await canvasToBlob(canvas, 'image/png')
      const thumbnail = await makeThumbnail(canvas)
      await saveArtwork({
        kind: 'free',
        title: title.trim() || (prompt ? L(prompt) : t('freeDraw.untitled')),
        image,
        thumbnail,
        width: w,
        height: h,
        timeSpent: saving.seconds,
        medium: t('freeDraw.medium'),
      })
      const reward = await recordActivity({
        type: 'artworkSaved',
        kind: 'free',
        seconds: saving.seconds,
      })
      await saving.clearDraft()
      void queryClient.invalidateQueries({ queryKey: qk.artworks })
      toast({
        title: t('freeDraw.saved'),
        description: t('freeDraw.savedXp', { xp: reward.xpGained }),
        tone: 'success',
      })
      presentReward(reward)
      setSaving(null)
      setTitle('')
    } catch {
      toast({ title: t('common.errorGeneric'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const info = (ctx: StudioContext) => (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-line bg-paper-2/50 p-4">
        <p className="eyebrow">{t('freeDraw.inspiration')}</p>
        <p className="mt-2 font-display text-xl leading-snug">{prompt ? `“${L(prompt)}”` : t('freeDraw.inspirationEmpty')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ink" icon={<Dices size={15} />} onClick={inspire}>
            {t('freeDraw.needInspiration')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<MessageCircle size={15} />}
            onClick={() => {
              setDraftChat(prompt ? t('freeDraw.chatAboutPrompt', { prompt: L(prompt) }) : t('freeDraw.chatAsk'))
              navigate('/chat')
            }}
          >
            {t('freeDraw.askMuse')}
          </Button>
        </div>
      </section>
      <section>
        <p className="eyebrow mb-2">{t('freeDraw.background')}</p>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(BACKGROUNDS) as BackgroundKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={ctx.engine.background === k}
              onClick={() => {
                setBg(k)
                ctx.engine.setBackground(k)
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10.5px] font-medium text-ink-soft',
                ctx.engine.background === k && 'bg-ink/[0.06] text-ink',
              )}
            >
              <span
                className={cn(
                  'h-10 w-full rounded-lg border border-line-strong',
                  k === 'transparent' && 'checker',
                  k === 'kraft' && 'kraft',
                )}
                style={k !== 'transparent' && k !== 'kraft' ? { background: BACKGROUNDS[k]! } : undefined}
              />
              {t(`freeDraw.bg.${k}`)}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="eyebrow mb-2">{t('freeDraw.canvasSize')}</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PRESETS) as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => {
                if (p === preset) return
                if (!ctx.engine.isEmpty() && !window.confirm(t('freeDraw.sizeConfirm'))) return
                void ctx.saveDraft()
                setPreset(p)
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm transition-colors',
                preset === p ? 'border-ink bg-card' : 'border-line hover:border-ink/40',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center" aria-hidden>
                <span
                  className="block border-2 border-ink/60"
                  style={{
                    width: (PRESETS[p][0] / Math.max(...PRESETS[p])) * 28,
                    height: (PRESETS[p][1] / Math.max(...PRESETS[p])) * 28,
                  }}
                />
              </span>
              <span>
                <span className="block font-medium">{t(`freeDraw.sizes.${p}`)}</span>
                <span className="text-xs text-ink-faint">
                  {PRESETS[p][0]} × {PRESETS[p][1]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <p className="text-sm text-ink-faint">
        {t('freeDraw.learnLink')}{' '}
        <Link to="/learn" className="link-ink">
          {t('nav.learn')}
        </Link>
      </p>
    </div>
  )

  return (
    <>
      <Studio
        key={preset}
        mode="free"
        title={t('freeDraw.title')}
        subtitle={pending ? t('freeDraw.withPalette', { name: pending.name }) : prompt ? L(prompt) : t('freeDraw.subtitle')}
        width={w}
        height={h}
        background={bg}
        draftKey={`free:${w}x${h}`}
        backTo="/"
        infoLabel={t('freeDraw.canvasTab')}
        info={info}
        description={t('freeDraw.description')}
        primary={(ctx) => (
          <>
            <Button size="sm" variant="outline" icon={<Save size={16} />} onClick={() => setSaving(ctx)} disabled={ctx.engine.isEmpty()}>
              <span className="hidden sm:inline">{t('freeDraw.saveToCollection')}</span>
            </Button>
            <DownloadMenu ctx={ctx} />
          </>
        )}
      />
      <Modal open={!!saving} onClose={() => setSaving(null)} title={t('freeDraw.saveTitle')} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="flex flex-col gap-5"
        >
          <TextField
            label={t('freeDraw.titleLabel')}
            placeholder={prompt ? L(prompt) : t('freeDraw.untitled')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            data-autofocus
          />
          <Button type="submit" variant="pigment" disabled={busy}>
            {busy ? t('common.loading') : t('freeDraw.saveToCollection')}
          </Button>
        </form>
      </Modal>
    </>
  )
}
