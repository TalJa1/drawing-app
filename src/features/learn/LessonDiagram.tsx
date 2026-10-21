import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiagramKind } from '@/types'
import { scheme } from '@/lib/color'

const INK = 'var(--ink)'
const LINE = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const GUIDE = { stroke: 'var(--vermilion)', strokeWidth: 1.6, strokeDasharray: '5 5', fill: 'none' }

function Label({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-ink-soft" style={{ font: '500 12px var(--font-sans)' }}>
      {children}
    </text>
  )
}

/** Illustrated diagrams used inside lessons (inline SVG, theme-aware). */
export function LessonDiagram({ kind }: { kind: DiagramKind }) {
  const { t } = useTranslation()
  const L = (k: string) => t(`learn.diagram.${k}`)
  let body: ReactNode
  switch (kind) {
    case 'thirds':
      body = (
        <>
          <rect x="20" y="20" width="360" height="200" fill="var(--paper-2)" />
          <path d="M20 160 C 120 140 220 170 380 150 L 380 220 L 20 220 Z" fill="var(--viridian)" opacity="0.55" />
          <path d="M140 20 V220 M260 20 V220 M20 87 H380 M20 153 H380" {...GUIDE} />
          {[
            [140, 87],
            [260, 87],
            [140, 153],
            [260, 153],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="var(--saffron)" stroke={INK} strokeWidth="2" />
          ))}
          <path d="M240 150 L 262 120 L 284 150 Z" fill="var(--vermilion)" stroke={INK} strokeWidth="2" />
          <path d="M262 120 V 100" stroke={INK} strokeWidth="2" />
          <rect x="20" y="20" width="360" height="200" {...LINE} />
        </>
      )
      break
    case 'golden': {
      const rects: ReactNode[] = []
      let x = 40
      let y = 20
      let w = 323.6
      let h = 200
      let d = 0
      let path = ''
      for (let i = 0; i < 7; i++) {
        rects.push(<rect key={i} x={x} y={y} width={w} height={h} fill="none" stroke="var(--line-strong)" />)
        const s = Math.min(w, h)
        if (d === 0) {
          path += `${i === 0 ? `M${x} ${y + s}` : ''} A ${s} ${s} 0 0 1 ${x + s} ${y} `
          x += s
          w -= s
        } else if (d === 1) {
          path += `A ${s} ${s} 0 0 1 ${x + w} ${y + s} `
          y += s
          h -= s
        } else if (d === 2) {
          path += `A ${s} ${s} 0 0 1 ${x + w - s} ${y + h} `
          w -= s
        } else {
          path += `A ${s} ${s} 0 0 1 ${x} ${y + h - s} `
          h -= s
        }
        d = (d + 1) % 4
      }
      body = (
        <>
          {rects}
          <path d={path} fill="none" stroke="var(--vermilion)" strokeWidth="3" />
          <circle cx="272" cy="96" r="7" fill="var(--saffron)" stroke={INK} strokeWidth="2" />
        </>
      )
      break
    }
    case 'leading':
      body = (
        <>
          <rect x="20" y="20" width="360" height="200" fill="var(--paper-2)" />
          <path d="M60 220 C 150 170 120 110 205 85 L 215 85 C 150 115 200 170 150 220 Z" fill="var(--ochre)" opacity="0.7" />
          <path d="M60 220 C 150 170 120 110 205 85 M150 220 C 200 170 150 115 215 85" {...LINE} />
          <rect x="196" y="58" width="30" height="26" fill="var(--vermilion)" stroke={INK} strokeWidth="2" />
          <path d="M192 60 L 211 44 L 230 60" {...LINE} />
          <path d="M300 200 L 230 100" stroke="var(--cerulean)" strokeWidth="2" strokeDasharray="4 6" markerEnd="url(#arrow)" />
          <rect x="20" y="20" width="360" height="200" {...LINE} />
        </>
      )
      break
    case 'wheel': {
      const segs = 12
      body = (
        <>
          {Array.from({ length: segs }, (_, i) => {
            const a0 = (i / segs) * Math.PI * 2 - Math.PI / 2
            const a1 = ((i + 1) / segs) * Math.PI * 2 - Math.PI / 2
            const R = 95
            const r = 45
            const p = (a: number, rad: number) => `${200 + Math.cos(a) * rad} ${120 + Math.sin(a) * rad}`
            return (
              <path
                key={i}
                d={`M${p(a0, r)} L ${p(a0, R)} A ${R} ${R} 0 0 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 0 0 ${p(a0, r)} Z`}
                fill={`hsl(${i * 30} 70% 52%)`}
                stroke="var(--card)"
                strokeWidth="2"
              />
            )
          })}
          <circle cx="200" cy="120" r="40" fill="var(--card)" />
          <Label x={200} y={124} anchor="middle">
            {L('hue')}
          </Label>
        </>
      )
      break
    }
    case 'value':
      body = (
        <>
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={30 + i * 49}
              y="50"
              width="47"
              height="90"
              fill={`hsl(25 10% ${95 - i * 14}%)`}
              stroke={INK}
              strokeWidth="1.5"
            />
          ))}
          <Label x={30} y={165}>
            {L('light')}
          </Label>
          <Label x={370} y={165} anchor="end">
            {L('dark')}
          </Label>
          <path d="M60 195 H 340" {...LINE} markerEnd="url(#arrow)" />
        </>
      )
      break
    case 'warmcool':
      body = (
        <>
          {['#e8433c', '#f0802e', '#f2c14e', '#e4572e'].map((c, i) => (
            <circle key={c} cx={70 + (i % 2) * 60} cy={70 + Math.floor(i / 2) * 70} r="28" fill={c} />
          ))}
          {['#2f80c4', '#2e8b6f', '#3a3fa8', '#2aa5a1'].map((c, i) => (
            <circle key={c} cx={270 + (i % 2) * 60} cy={70 + Math.floor(i / 2) * 70} r="28" fill={c} />
          ))}
          <Label x={100} y={200} anchor="middle">
            {L('warm')}
          </Label>
          <Label x={300} y={200} anchor="middle">
            {L('cool')}
          </Label>
          <path d="M200 30 V 210" stroke="var(--line-strong)" strokeDasharray="4 4" />
        </>
      )
      break
    case 'schemes': {
      const kinds = ['complementary', 'analogous', 'triadic', 'split'] as const
      body = (
        <>
          {kinds.map((k, i) => (
            <g key={k} transform={`translate(${20 + i * 92} 30)`}>
              {scheme('#e4572e', k).map((c, j) => (
                <rect key={j} x="0" y={j * 38} width="80" height="34" rx="6" fill={c} />
              ))}
              <Label x={40} y={180} anchor="middle">
                {L(k)}
              </Label>
            </g>
          ))}
        </>
      )
      break
    }
    case 'psychology':
      body = (
        <>
          {[
            ['#e4572e', 'energy'],
            ['#2f80c4', 'calm'],
            ['#f2c14e', 'joy'],
            ['#2e8b6f', 'nature'],
            ['#7b4bb5', 'mystery'],
          ].map(([c, k], i) => (
            <g key={k}>
              <rect x={20 + i * 73} y="40" width="66" height="110" rx="10" fill={c} />
              <Label x={53 + i * 73} y={175} anchor="middle">
                {L(k)}
              </Label>
            </g>
          ))}
        </>
      )
      break
    case 'shadow':
      body = (
        <>
          <defs>
            <radialGradient id="ld-sphere" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#c9c1b0" />
              <stop offset="0.75" stopColor="#5a5650" />
              <stop offset="0.9" stopColor="#3a3632" />
              <stop offset="1" stopColor="#6a655c" />
            </radialGradient>
          </defs>
          <ellipse cx="225" cy="190" rx="95" ry="18" fill="#000" opacity="0.35" />
          <circle cx="170" cy="120" r="70" fill="url(#ld-sphere)" />
          <circle cx="45" cy="35" r="12" fill="var(--saffron)" />
          <path d="M57 45 L 120 80" stroke="var(--saffron)" strokeWidth="2" strokeDasharray="4 4" />
          {[
            [140, 88, 255, 50, 'highlight'],
            [205, 150, 275, 110, 'core'],
            [215, 175, 300, 150, 'reflected'],
            [260, 196, 300, 222, 'cast'],
          ].map(([x1, y1, x2, y2, k]) => (
            <g key={k as string}>
              <line x1={x1} y1={y1} x2={x2 as number} y2={y2 as number} stroke={INK} strokeWidth="1" />
              <Label x={(x2 as number) + 4} y={(y2 as number) + 4}>
                {L(k as string)}
              </Label>
            </g>
          ))}
        </>
      )
      break
    case 'onepoint':
      body = (
        <>
          <path d="M20 110 H 380" stroke="var(--cerulean)" strokeWidth="1.6" />
          <circle cx="200" cy="110" r="5" fill="var(--vermilion)" />
          {[
            [20, 220],
            [380, 220],
            [20, 20],
            [380, 20],
          ].map(([x, y]) => (
            <line key={`${x}${y}`} x1={x} y1={y} x2="200" y2="110" {...GUIDE} />
          ))}
          <rect x="70" y="150" width="70" height="55" {...LINE} fill="var(--paper-2)" />
          <path d="M70 150 L 133 128 L 175 128 L 140 150 M140 205 L 175 170 L 175 128" {...LINE} />
          <path d="M150 220 L 190 120 M250 220 L 210 120" {...LINE} />
          <Label x={210} y={102}>
            {L('vp')}
          </Label>
          <Label x={300} y={102}>
            {L('horizon')}
          </Label>
        </>
      )
      break
    case 'twopoint':
      body = (
        <>
          <path d="M10 90 H 390" stroke="var(--cerulean)" strokeWidth="1.6" />
          <circle cx="20" cy="90" r="5" fill="var(--vermilion)" />
          <circle cx="380" cy="90" r="5" fill="var(--vermilion)" />
          <path d="M200 40 L 20 90 M200 190 L 20 90 M200 40 L 380 90 M200 190 L 380 90" {...GUIDE} />
          <path d="M200 40 V 190 M120 64 V 150 M300 66 V 158" {...LINE} />
          <path d="M120 64 L 200 40 L 300 66 M120 150 L 200 190 L 300 158" {...LINE} />
          <path d="M215 95 V 140 L 245 145 V 98 Z" {...LINE} fill="var(--saffron)" />
        </>
      )
      break
    case 'proportion':
      body = (
        <>
          <path d="M170 40 C 150 40 140 60 140 90 L 140 200 L 220 200 L 220 90 C 220 60 210 40 190 40 Z" {...LINE} fill="var(--paper-2)" />
          <path d="M220 110 C 260 110 260 170 220 170" {...LINE} />
          <line x1="60" y1="40" x2="60" y2="200" stroke="var(--vermilion)" strokeWidth="3" />
          <line x1="48" y1="40" x2="72" y2="40" stroke="var(--vermilion)" strokeWidth="3" />
          <line x1="48" y1="200" x2="72" y2="200" stroke="var(--vermilion)" strokeWidth="3" />
          <path d="M290 30 L 300 210" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <circle cx="294" cy="110" r="9" fill="var(--saffron)" />
          <Label x={74} y={124}>
            {L('unit')}
          </Label>
        </>
      )
      break
    case 'line':
      body = (
        <>
          <path d="M30 70 C 120 30 260 110 370 60" fill="none" stroke={INK} strokeWidth="2" />
          <path d="M30 130 C 120 90 260 170 370 120" fill="none" stroke={INK} strokeWidth="2" />
          <path d="M30 130 C 120 92 260 172 370 120" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" opacity="0.08" />
          <path d="M30 200 C 80 175 130 185 200 195 S 320 205 370 180" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M30 200 C 80 177 130 189 200 197 S 320 211 370 180" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <Label x={30} y={50}>
            {L('uniform')}
          </Label>
          <Label x={30} y={170}>
            {L('varied')}
          </Label>
        </>
      )
      break
    case 'contour':
      body = (
        <path
          d="M80 200 C 70 160 90 120 110 90 C 115 60 140 50 150 80 C 155 40 180 30 190 70 C 200 35 230 40 225 85 C 240 60 265 70 255 110 C 275 120 280 160 250 200 Z"
          {...LINE}
          strokeWidth="3"
          strokeDasharray="0"
        />
      )
      break
    case 'hatching':
      body = (
        <>
          {Array.from({ length: 5 }, (_, b) => (
            <g key={b}>
              <rect x={20 + b * 74} y="50" width="66" height="110" fill="var(--card)" stroke={INK} strokeWidth="1.5" />
              {Array.from({ length: b * 6 }, (_, i) => (
                <line
                  key={i}
                  x1={20 + b * 74}
                  y1={50 + (i % 12) * 10 + (b > 2 ? 3 : 0)}
                  x2={86 + b * 74}
                  y2={50 + (i % 12) * 10 + (b > 2 ? 3 : 0) + (i >= 12 ? -30 : 0)}
                  stroke={INK}
                  strokeWidth="1"
                  opacity="0.8"
                />
              ))}
              {b >= 3 &&
                Array.from({ length: 8 }, (_, i) => (
                  <line key={`v${i}`} x1={24 + b * 74 + i * 8} y1="50" x2={24 + b * 74 + i * 8} y2="160" stroke={INK} strokeWidth="1" />
                ))}
            </g>
          ))}
        </>
      )
      break
    case 'blending':
      body = (
        <>
          <defs>
            <linearGradient id="ld-blend" x1="0" x2="1">
              <stop offset="0" stopColor="#3a3fa8" />
              <stop offset="0.5" stopColor="#c93c6b" />
              <stop offset="1" stopColor="#f2a93b" />
            </linearGradient>
          </defs>
          <rect x="30" y="50" width="340" height="60" rx="12" fill="url(#ld-blend)" />
          {['#3a3fa8', '#c93c6b', '#f2a93b'].map((c, i) => (
            <rect key={c} x={30 + i * 116} y="140" width="108" height="60" rx="12" fill={c} />
          ))}
          <Label x={30} y={40}>
            {L('smooth')}
          </Label>
          <Label x={30} y={225}>
            {L('steps')}
          </Label>
        </>
      )
      break
    case 'texture':
      body = (
        <>
          <rect x="20" y="40" width="110" height="140" rx="8" fill="var(--paper-2)" stroke={INK} />
          {Array.from({ length: 50 }, (_, i) => (
            <path
              key={i}
              d={`M${30 + (i % 10) * 10} ${55 + Math.floor(i / 10) * 25} q 4 -8 8 -14`}
              fill="none"
              stroke="var(--umber)"
              strokeWidth="1.5"
            />
          ))}
          <rect x="145" y="40" width="110" height="140" rx="8" fill="#c9a77c" stroke={INK} />
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              d={`M${152 + i * 15} 45 C ${160 + i * 15} 90 ${145 + i * 15} 130 ${155 + i * 15} 175`}
              fill="none"
              stroke="var(--umber)"
              strokeWidth="2"
            />
          ))}
          <rect x="270" y="40" width="110" height="140" rx="8" fill="#a9c2d4" stroke={INK} />
          <path d="M290 60 L 320 50 M300 80 L 360 60" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <Label x={75} y={205} anchor="middle">
            {L('fur')}
          </Label>
          <Label x={200} y={205} anchor="middle">
            {L('wood')}
          </Label>
          <Label x={325} y={205} anchor="middle">
            {L('glass')}
          </Label>
        </>
      )
      break
    case 'gesture':
      body = (
        <>
          <path d="M150 40 C 220 70 160 140 230 200" fill="none" stroke="var(--vermilion)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="155" cy="45" r="18" {...LINE} />
          <path d="M162 70 C 190 100 175 130 200 150 M168 85 L 120 70 M175 95 L 230 70 M200 150 L 170 205 M200 150 L 240 200" {...LINE} />
          <path d="M260 60 C 300 90 290 150 320 200" fill="none" stroke="var(--cerulean)" strokeWidth="3" strokeDasharray="5 5" />
          <Label x={250} y={40}>
            {L('lineOfAction')}
          </Label>
        </>
      )
      break
    case 'face':
      body = (
        <>
          <ellipse cx="200" cy="120" rx="70" ry="95" {...LINE} fill="var(--paper-2)" />
          <path d="M130 120 H 270 M200 25 V 215 M150 168 H 250" {...GUIDE} />
          <path d="M140 72 H 260" stroke="var(--line-strong)" strokeDasharray="3 4" />
          <path d="M165 113 Q 175 104 185 113 Q 175 120 165 113 Z M215 113 Q 225 104 235 113 Q 225 120 215 113 Z" {...LINE} />
          <path d="M200 125 L 193 165 L 207 165" {...LINE} />
          <path d="M184 185 Q 200 195 216 185" {...LINE} />
          <Label x={280} y={124}>
            {L('eyeLine')}
          </Label>
        </>
      )
      break
    case 'hand':
      body = (
        <>
          <rect x="150" y="110" width="90" height="90" rx="22" {...LINE} fill="var(--paper-2)" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={152 + i * 23}
              y={[46, 30, 38, 56][i]}
              width="20"
              height={[70, 86, 78, 60][i]}
              rx="10"
              {...LINE}
              fill="var(--paper-2)"
            />
          ))}
          <rect x="118" y="120" width="22" height="64" rx="11" transform="rotate(-35 129 152)" {...LINE} fill="var(--paper-2)" />
          <path d="M152 110 Q 197 92 244 112" {...GUIDE} />
          <Label x={260} y={100}>
            {L('arc')}
          </Label>
        </>
      )
      break
    case 'anatomy':
      body = (
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="120" x2="280" y1={14 + i * 24} y2={14 + i * 24} stroke="var(--line-strong)" strokeDasharray="3 4" />
          ))}
          <circle cx="200" cy="26" r="12" {...LINE} />
          <ellipse cx="200" cy="72" rx="22" ry="30" {...LINE} />
          <path d="M180 110 Q 200 130 220 110 L 216 98 L 184 98 Z" {...LINE} />
          <path d="M190 120 L 186 206 M210 120 L 214 206 M178 52 L 168 120 M222 52 L 232 120" {...LINE} />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Label key={n} x={290} y={30 + (n - 1) * 24}>
              {n}
            </Label>
          ))}
        </>
      )
      break
    case 'stilllife':
      body = (
        <>
          <rect x="20" y="170" width="360" height="40" fill="var(--paper-3)" />
          <ellipse cx="240" cy="172" rx="70" ry="8" fill="#000" opacity="0.15" />
          <path
            d="M150 170 C 120 120 130 80 150 70 L 150 55 L 180 55 L 180 70 C 200 80 210 120 180 170 Z"
            fill="var(--cerulean)"
            {...{ stroke: INK, strokeWidth: 2.5 }}
          />
          <circle cx="240" cy="148" r="24" fill="var(--vermilion)" stroke={INK} strokeWidth="2.5" />
          <circle cx="285" cy="152" r="20" fill="var(--saffron)" stroke={INK} strokeWidth="2.5" />
          <circle cx="60" cy="40" r="12" fill="var(--saffron)" />
        </>
      )
      break
    case 'landscape':
      body = (
        <>
          <rect x="20" y="20" width="360" height="200" fill="#dce8f2" />
          <path d="M20 120 L 90 70 L 150 110 L 220 60 L 300 115 L 380 85 L 380 220 L 20 220 Z" fill="#a9c2d4" />
          <path d="M20 160 C 120 130 240 170 380 140 L 380 220 L 20 220 Z" fill="#7fb28f" />
          <path d="M20 200 C 140 185 260 205 380 190 L 380 220 L 20 220 Z" fill="#2e8b6f" />
          <Label x={320} y={80}>
            {L('background')}
          </Label>
          <Label x={300} y={150}>
            {L('middle')}
          </Label>
          <Label x={40} y={214}>
            {L('foreground')}
          </Label>
        </>
      )
      break
    case 'watercolour':
      body = (
        <>
          <circle cx="160" cy="110" r="60" fill="#2f80c4" opacity="0.45" />
          <circle cx="240" cy="110" r="60" fill="#f2c14e" opacity="0.5" />
          <circle cx="200" cy="160" r="60" fill="#c93c6b" opacity="0.4" />
        </>
      )
      break
    case 'negative':
      body = (
        <>
          <rect x="20" y="20" width="360" height="200" fill="var(--ink)" />
          <path
            d="M200 220 V 120 M200 150 C 150 140 120 100 130 70 C 170 80 195 110 200 150 M200 130 C 250 120 280 80 270 50 C 230 60 205 90 200 130"
            fill="var(--card)"
            stroke="var(--card)"
            strokeWidth="6"
          />
        </>
      )
      break
    case 'atmos':
      body = (
        <>
          <rect x="20" y="20" width="360" height="200" fill="#e8eef2" />
          <path d="M20 110 L 100 60 L 180 100 L 270 50 L 380 95 V 220 H 20 Z" fill="#c9d6e0" />
          <path d="M20 140 L 120 95 L 210 135 L 300 90 L 380 130 V 220 H 20 Z" fill="#8fa9bd" />
          <path d="M20 170 L 90 135 L 190 165 L 290 125 L 380 160 V 220 H 20 Z" fill="#5f7f99" />
          <path d="M20 200 L 140 165 L 260 195 L 380 170 V 220 H 20 Z" fill="#2c3e50" />
        </>
      )
      break
    default:
      body = null
  }
  return (
    <svg viewBox="0 0 400 240" className="h-auto w-full" aria-hidden>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
        </marker>
      </defs>
      {body}
    </svg>
  )
}
