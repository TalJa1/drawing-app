import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MoveHorizontal } from 'lucide-react'
import type { RankLabel, Template } from '@/types'
import { cn, svgToDataUrl } from '@/lib/utils'
import { useSvgId } from '@/lib/hooks'

/** Draggable before/after comparison: your artwork vs the original line art. */
export function BeforeAfter({ image, template, heatmap }: { image: string; template: Template; heatmap?: ReactNode }) {
  const { t } = useTranslation()
  const [pos, setPos] = useState(100)
  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden bg-white">
      <img src={svgToDataUrl(template.svg)} alt={t('result.originalAlt')} className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={image} alt={t('result.artworkAlt')} className="absolute inset-0 h-full w-full bg-white object-contain" />
        {heatmap}
      </div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }} aria-hidden>
        <div className="absolute inset-y-0 -translate-x-1/2 border-l-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" />
        <div className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lift">
          <MoveHorizontal size={18} />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={t('result.compare')}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-paper">
        {t('result.yours')}
      </span>
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-paper">
        {t('result.original')}
      </span>
    </div>
  )
}

/** Coverage heatmap over the artwork: teal = matched, vermilion = missed. */
export function HeatmapOverlay({ grid }: { grid: number[][] }) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  return (
    <div
      className="pointer-events-none absolute inset-0 grid mix-blend-multiply"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      aria-hidden
    >
      {grid.flat().map((v, i) => (
        <div
          key={i}
          style={{
            background: v < 0 ? 'transparent' : v >= 0.6 ? 'var(--viz-3)' : v >= 0.3 ? 'var(--saffron)' : 'var(--viz-1)',
            opacity: v < 0 ? 0 : 0.42,
          }}
        />
      ))}
    </div>
  )
}

const STAMP_COLOURS: Record<RankLabel, string> = {
  starter: '#6a6358',
  rising: '#2f80c4',
  steady: '#2e8b6f',
  gallery: '#c93c6b',
  masterpiece: '#b8862b',
}

/** A wax-seal / ink-stamp rank label that slams in. */
export function RankStamp({ rank, label, ringText, big }: { rank: RankLabel; label: string; ringText: string; big?: boolean }) {
  const c = STAMP_COLOURS[rank]
  const arc = useSvgId('stamp-arc')
  return (
    <motion.div
      initial={{ scale: 2.6, rotate: -28, opacity: 0 }}
      animate={{ scale: 1, rotate: -9, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 1.6 }}
      className={cn('relative inline-flex select-none items-center justify-center rounded-full', big ? 'h-36 w-36' : 'h-28 w-28')}
      style={{ color: c }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="2 3" filter="url(#rough)" />
        <circle cx="60" cy="60" r="47" fill="none" stroke="currentColor" strokeWidth="2.5" filter="url(#rough)" />
        <path id={arc} d="M22 60 a38 38 0 0 1 76 0" fill="none" />
        <text className="fill-current text-[9px] font-bold uppercase tracking-[0.3em]">
          <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">
            {ringText}
          </textPath>
        </text>
      </svg>
      <span
        className={cn(
          'relative px-4 text-center font-display font-semibold uppercase leading-none tracking-wide',
          big ? 'text-[15px]' : 'text-[12.5px]',
        )}
        style={{ filter: 'url(#rough)' }}
      >
        {label}
      </span>
    </motion.div>
  )
}

/** Handwritten judge's note pinned on paper with washi tape. */
export function JudgeNote({ children, signature }: { children: ReactNode; signature: string }) {
  return (
    <figure className="paper relative rotate-[-1.2deg] rounded-sm p-6 pt-8 shadow-lift">
      <span
        aria-hidden
        className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[3deg] bg-saffron/60"
        style={{ clipPath: 'polygon(4% 0,100% 6%,96% 100%,0 92%)' }}
      />
      <blockquote className="hand text-[1.7rem] leading-snug text-ink">{children}</blockquote>
      <figcaption className="hand mt-3 text-right text-xl text-accent-ink">— {signature}</figcaption>
    </figure>
  )
}
