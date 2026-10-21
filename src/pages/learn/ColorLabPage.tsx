import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Code2, Copy, Send, X } from 'lucide-react'
import { Page, SectionHeading } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Tabs } from '@/components/Tabs'
import { Slider } from '@/components/Form'
import { ColourWheel } from '@/components/ColourWheel'
import { Highlight } from '@/components/art/Brush'
import { Washes } from '@/components/art/Washes'
import { contrastRatio, hexToHsl, hslToHex, mixPigments, normalizeHex, readableOn, scheme, type SchemeKind } from '@/lib/color'
import { copyText } from '@/lib/utils'
import { recordActivity } from '@/api/progress'
import { useStudio } from '@/store/studio'
import { presentReward, toast } from '@/store/ui'

const SCHEMES: SchemeKind[] = ['complementary', 'analogous', 'triadic', 'tetradic', 'split']

/** Expand a 2–4 colour scheme into 5 usable swatches (adds a light tint and a deep shade). */
function expand(colors: string[]): string[] {
  const base = colors[0]
  const { h, s } = hexToHsl(base)
  const out = [...colors]
  out.push(hslToHex({ h, s: Math.min(0.5, s), l: 0.93 }))
  if (out.length < 5) out.push(hslToHex({ h, s: Math.min(0.6, s), l: 0.18 }))
  return out.slice(0, 5)
}

function Preview({ p, label }: { p: string[]; label: string }) {
  const [a, b, c, light, dark] = [p[0], p[1] ?? p[0], p[2] ?? p[1] ?? p[0], p[p.length - 2] ?? '#f6f1e7', p[p.length - 1] ?? '#1b1a17']
  return (
    <svg viewBox="0 0 400 260" className="h-auto w-full rounded-2xl" role="img" aria-label={label}>
      <rect width="400" height="260" fill={light} />
      <circle cx="310" cy="70" r="36" fill={b} />
      <path d="M0 170 C 80 120 160 150 220 130 C 290 105 340 130 400 115 V 260 H 0 Z" fill={c} />
      <path d="M0 200 C 100 170 200 210 400 180 V 260 H 0 Z" fill={a} />
      <rect x="80" y="120" width="70" height="60" fill={light} stroke={dark} strokeWidth="3" />
      <path d="M70 124 L 115 88 L 160 124 Z" fill={b} stroke={dark} strokeWidth="3" />
      <rect x="105" y="145" width="20" height="35" fill={dark} />
      <path d="M250 200 C 250 160 280 140 300 150 C 320 140 345 165 335 200 Z" fill={dark} opacity="0.85" />
      <rect x="290" y="195" width="8" height="30" fill={dark} />
    </svg>
  )
}

export default function ColorLabPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [base, setBase] = useState('#e4572e')
  const [kind, setKind] = useState<SchemeKind>('complementary')
  const [fg, setFg] = useState('#1b1a17')
  const [bg, setBg] = useState('#f2a93b')
  const [mixA, setMixA] = useState('#1f5bb5')
  const [mixB, setMixB] = useState('#f7d116')
  const [ratio, setRatio] = useState(0.5)
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const used = useRef(false)
  const setPending = useStudio((s) => s.setPendingPalette)

  const palette = expand(scheme(base, kind))
  const mixed = mixPigments(mixA, mixB, ratio)
  const cr = contrastRatio(fg, bg)

  // first interaction earns the "Colour Curious" badge
  useEffect(() => {
    if (used.current || base === '#e4572e') return
    used.current = true
    void recordActivity({ type: 'colorLab' }).then(presentReward)
  }, [base])

  const copy = async (text: string, label: string) =>
    toast({ title: (await copyText(text)) ? t('common.copied') : t('learn.lab.copyFailed'), description: label, tone: 'success' })
  const send = async () => {
    setPending({ name: t(`learn.lab.schemes.${kind}`), colors: palette })
    presentReward(await recordActivity({ type: 'paletteSent' }))
    toast({ title: t('learn.lab.sent'), tone: 'success' })
    navigate('/free-draw')
  }

  const pass = (min: number) => (cr >= min ? <Check size={14} className="text-viridian" /> : <X size={14} className="text-accent-ink" />)

  return (
    <Page>
      <Washes
        washes={[
          { color: base, size: '40vmax', top: '-16%', left: '-12%' },
          { color: palette[1], size: '30vmax', top: '30%', right: '-12%', delay: -8 },
        ]}
      />
      <div className="container-art">
        <Link to="/learn#tools" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <SectionHeading
          className="mt-6"
          eyebrow={t('learn.lab.eyebrow')}
          title={
            <>
              {t('learn.lab.titleA')} <Highlight color={base}>{t('learn.lab.titleB')}</Highlight>
            </>
          }
          lede={t('learn.lab.lede')}
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card className="flex flex-col items-center gap-5 p-6">
            <ColourWheel value={base} onChange={setBase} size={260} />
            <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              {t('learn.lab.base')}
              <input
                value={hexDraft ?? base.toUpperCase()}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={() => {
                  const n = hexDraft && normalizeHex(hexDraft)
                  if (n) setBase(n)
                  setHexDraft(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="h-10 rounded-xl border border-line-strong bg-card px-3 font-mono text-sm normal-case tracking-normal text-ink"
                spellCheck={false}
              />
            </label>
          </Card>

          <Card className="p-6">
            <Tabs
              ariaLabel={t('learn.lab.schemeLabel')}
              value={kind}
              onChange={setKind}
              items={SCHEMES.map((s) => ({ id: s, label: t(`learn.lab.schemes.${s}`) }))}
            />
            <p className="mt-3 text-sm text-ink-soft">{t(`learn.lab.explain.${kind}`)}</p>
            <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <div>
                <div className="flex h-40 overflow-hidden rounded-2xl border border-line">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void copy(c, c.toUpperCase())}
                      className="group flex flex-1 items-end justify-center p-2 transition-[flex] duration-300 hover:flex-[1.6]"
                      style={{ background: c, color: readableOn(c) }}
                      aria-label={t('learn.copyColour', { hex: c })}
                    >
                      <span className="font-mono text-[11px] font-semibold">{c.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Copy size={15} />}
                    onClick={() => void copy(palette.join(', '), t('learn.lab.hexList'))}
                  >
                    {t('learn.lab.copyHex')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Code2 size={15} />}
                    onClick={() => void copy(palette.map((c, i) => `--colour-${i + 1}: ${c};`).join('\n'), 'CSS')}
                  >
                    {t('learn.lab.copyCss')}
                  </Button>
                  <Button size="sm" variant="pigment" icon={<Send size={15} />} onClick={() => void send()}>
                    {t('learn.sendToStudio')}
                  </Button>
                </div>
              </div>
              <div>
                <p className="eyebrow mb-2">{t('learn.lab.preview')}</p>
                <Preview p={palette} label={t('learn.lab.previewAlt')} />
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-display text-2xl">{t('learn.lab.contrast')}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t('learn.lab.contrastLede')}</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {(
                [
                  ['text', fg, setFg],
                  ['background', bg, setBg],
                ] as const
              ).map(([k, v, set]) => (
                <label key={k} className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="color"
                    value={v}
                    onChange={(e) => set(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-card"
                  />
                  {t(`learn.lab.${k}`)}
                  <span className="font-mono text-xs text-ink-faint">{v.toUpperCase()}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 rounded-2xl p-6" style={{ background: bg, color: fg }}>
              <p className="font-display text-3xl">{t('learn.lab.sample')}</p>
              <p className="mt-1 text-sm">{t('learn.lab.sampleSmall')}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-display text-3xl tabular-nums">{cr.toFixed(2)}:1</span>
              <span className="inline-flex items-center gap-1">{pass(4.5)} AA</span>
              <span className="inline-flex items-center gap-1">
                {pass(3)} AA {t('learn.lab.large')}
              </span>
              <span className="inline-flex items-center gap-1">{pass(7)} AAA</span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-2xl">{t('learn.lab.mix')}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t('learn.lab.mixLede')}</p>
            <div className="mt-6 flex items-center justify-center gap-2 sm:gap-6">
              <label className="flex flex-col items-center gap-2 text-xs text-ink-faint">
                <input
                  type="color"
                  value={mixA}
                  onChange={(e) => setMixA(e.target.value)}
                  className="sr-only"
                  aria-label={t('learn.lab.pigmentA')}
                  id="mixA"
                />
                <span
                  className="h-20 w-20 rounded-full border-4 border-card shadow-lift"
                  style={{ background: mixA, borderRadius: '58% 42% 55% 45% / 50% 60% 40% 50%' }}
                />
                {mixA.toUpperCase()}
              </label>
              <span className="font-display text-3xl text-ink-faint">+</span>
              <label className="flex flex-col items-center gap-2 text-xs text-ink-faint">
                <input
                  type="color"
                  value={mixB}
                  onChange={(e) => setMixB(e.target.value)}
                  className="sr-only"
                  aria-label={t('learn.lab.pigmentB')}
                  id="mixB"
                />
                <span
                  className="h-20 w-20 rounded-full border-4 border-card shadow-lift"
                  style={{ background: mixB, borderRadius: '45% 55% 42% 58% / 60% 45% 55% 40%' }}
                />
                {mixB.toUpperCase()}
              </label>
              <span className="font-display text-3xl text-ink-faint">=</span>
              <button
                type="button"
                onClick={() => void copy(mixed, mixed.toUpperCase())}
                className="flex flex-col items-center gap-2 text-xs text-ink-faint"
                aria-label={t('learn.copyColour', { hex: mixed })}
              >
                <span
                  className="h-28 w-28 shadow-lift transition-colors duration-300"
                  style={{ background: mixed, borderRadius: '52% 48% 60% 40% / 45% 55% 45% 55%' }}
                />
                {mixed.toUpperCase()}
              </button>
            </div>
            <Slider
              className="mt-6"
              label={t('learn.lab.ratio')}
              value={ratio}
              min={0}
              max={1}
              step={0.01}
              onChange={setRatio}
              format={(v) => `${Math.round((1 - v) * 100)} : ${Math.round(v * 100)}`}
              accent={mixed}
            />
            <p className="hand mt-3 text-lg text-accent-ink">{t('learn.lab.mixNote')}</p>
          </Card>
        </div>
      </div>
    </Page>
  )
}
