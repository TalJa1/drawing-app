import { memo, useMemo, type ReactNode } from 'react'
import type { CoverStyle, GenStyle } from '@/types'
import { seeded } from '@/lib/random'
import { cn } from '@/lib/utils'
import { GenerativeArt } from '@/components/art/GenerativeArt'

/** Covers that reuse a generative painting style. */
const VIA_GEN: Partial<Record<CoverStyle, GenStyle>> = {
  impasto: 'expressionist',
  ink: 'ink',
  print: 'folk',
  dots: 'dots',
  geometry: 'geometric',
  lacquer: 'lacquer',
  pixels: 'digital',
}

/** Procedural cover art in the "feel" of each medium. */
export const ArtFormCover = memo(function ArtFormCover({
  style,
  palette,
  seed,
  className,
}: {
  style: CoverStyle
  palette: string[]
  seed: string
  className?: string
}) {
  const gen = VIA_GEN[style]
  const nodes = useMemo(() => (gen ? null : render(style, palette, seed)), [gen, style, palette, seed])
  if (gen) return <GenerativeArt style={gen} seed={seed} palette={palette.length >= 3 ? palette : undefined} className={className} />
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden>
      <g filter="url(#canvas-grain)">{nodes}</g>
    </svg>
  )
})

function render(style: CoverStyle, p: string[], seed: string): ReactNode[] {
  const rng = seeded(seed)
  const r = (a: number, b: number) => a + rng() * (b - a)
  const c = (i: number) => p[i % p.length]
  const out: ReactNode[] = []
  let k = 0
  switch (style) {
    case 'hatching': {
      out.push(<rect key={k++} width="400" height="300" fill="#f6f1e7" />)
      // a hatched sphere and a cube
      for (let i = 0; i < 46; i++) out.push(<line key={k++} x1={120 + i * 3} y1={90 + Math.abs(23 - i) * 2} x2={60 + i * 3} y2={220 - Math.abs(23 - i) * 1.4} stroke="#1b1a17" strokeWidth="1.1" opacity={0.25 + (i / 46) * 0.6} />)
      out.push(<circle key={k++} cx="150" cy="160" r="72" fill="none" stroke="#1b1a17" strokeWidth="2.5" />)
      for (let i = 0; i < 26; i++) out.push(<line key={k++} x1={250 + i * 4} y1="130" x2={250 + i * 4} y2="230" stroke="#1b1a17" strokeWidth="1" opacity="0.6" />)
      for (let i = 0; i < 20; i++) out.push(<line key={k++} x1="250" y1={130 + i * 5} x2="352" y2={130 + i * 5} stroke="#1b1a17" strokeWidth="0.8" opacity="0.35" />)
      out.push(<rect key={k++} x="250" y="130" width="102" height="100" fill="none" stroke="#1b1a17" strokeWidth="2.5" />)
      out.push(<path key={k++} d="M250 130 L 285 100 L 387 100 L 352 130 Z M352 230 L 387 200 L 387 100" fill="none" stroke="#1b1a17" strokeWidth="2.5" />)
      break
    }
    case 'washes': {
      out.push(<rect key={k++} width="400" height="300" fill="#fbf8f1" />)
      for (let i = 0; i < 7; i++)
        out.push(<ellipse key={k++} cx={r(40, 360)} cy={r(40, 260)} rx={r(60, 140)} ry={r(40, 90)} fill={c(i)} opacity="0.35" filter="url(#soft-blur)" />)
      out.push(<path key={k++} d="M0 210 C 100 180 200 240 400 200 L 400 300 L 0 300 Z" fill={c(2)} opacity="0.4" filter="url(#soft-blur)" />)
      break
    }
    case 'blocks': {
      out.push(<rect key={k++} width="400" height="300" fill={c(0)} />)
      for (let i = 0; i < 5; i++) out.push(<rect key={k++} x={i * 80} y="0" width="80" height="300" fill={c(i)} opacity={0.75 + rng() * 0.25} />)
      out.push(<circle key={k++} cx="270" cy="110" r="56" fill="#f6f1e7" />)
      out.push(<path key={k++} d="M0 240 L 120 170 L 210 230 L 320 160 L 400 210 L 400 300 L 0 300 Z" fill="#1b1a17" opacity="0.85" />)
      break
    }
    case 'stone': {
      out.push(<rect key={k++} width="400" height="300" fill="#2a2520" />)
      out.push(<ellipse key={k++} cx="200" cy="290" rx="150" ry="22" fill="#000" opacity="0.4" />)
      out.push(<path key={k++} d="M150 280 C 140 210 150 150 175 120 C 165 95 175 60 200 58 C 225 60 235 95 225 120 C 250 150 260 210 250 280 Z" fill="#e8e2d6" />)
      out.push(<path key={k++} d="M200 58 C 225 60 235 95 225 120 C 250 150 260 210 250 280 L 215 280 C 225 210 220 150 205 120 C 215 95 212 70 200 58 Z" fill="#b8b0a1" />)
      out.push(<rect key={k++} x="120" y="276" width="160" height="22" fill="#8a8478" />)
      break
    }
    case 'clay': {
      out.push(<rect key={k++} width="400" height="300" fill="#efe2cf" />)
      const vase = (x: number, s: number, col: string) => (
        <g key={k++} transform={`translate(${x} 0) scale(${s})`}>
          <path d="M-40 260 C -70 200 -60 150 -20 120 L -18 90 L 18 90 L 20 120 C 60 150 70 200 40 260 Z" fill={col} />
          <path d="M-52 185 L 52 185 L 50 200 L -50 200 Z" fill="#f6f1e7" opacity="0.7" />
          <ellipse cx="0" cy="90" rx="20" ry="5" fill="#00000033" />
        </g>
      )
      out.push(vase(120, 1, c(1)), vase(230, 1.25, c(0)), vase(320, 0.8, c(3) ?? c(2)))
      out.push(<rect key={k++} y="258" width="400" height="42" fill="#c9a77c" />)
      break
    }
    case 'lens': {
      out.push(<rect key={k++} width="400" height="300" fill="#141210" />)
      for (let i = 6; i >= 1; i--) out.push(<circle key={k++} cx="200" cy="150" r={i * 20} fill="none" stroke={i % 2 ? '#3a3530' : '#5a5650'} strokeWidth="10" />)
      out.push(<circle key={k++} cx="200" cy="150" r="22" fill="#0b0a09" />)
      out.push(<ellipse key={k++} cx="175" cy="125" rx="26" ry="12" fill="#ffffff" opacity="0.18" transform="rotate(-30 175 125)" />)
      for (let i = 0; i < 6; i++) out.push(<circle key={k++} cx={60 + i * 55} cy={40 + (i % 2) * 220} r={r(6, 16)} fill={c(3)} opacity="0.5" />)
      break
    }
    case 'panels': {
      out.push(<rect key={k++} width="400" height="300" fill="#ffffff" />)
      const panels: [number, number, number, number][] = [
        [12, 12, 180, 130],
        [204, 12, 184, 130],
        [12, 154, 120, 134],
        [144, 154, 244, 134],
      ]
      panels.forEach(([x, y, w, h], i) => {
        out.push(<rect key={k++} x={x} y={y} width={w} height={h} fill={i === 3 ? c(1) : '#fff'} stroke="#1b1a17" strokeWidth="4" />)
      })
      out.push(<ellipse key={k++} cx="110" cy="60" rx="56" ry="26" fill="#fff" stroke="#1b1a17" strokeWidth="3" />)
      out.push(<path key={k++} d="M90 84 L 80 104 L 106 86" fill="#fff" stroke="#1b1a17" strokeWidth="3" />)
      out.push(<circle key={k++} cx="290" cy="80" r="34" fill={c(3)} stroke="#1b1a17" strokeWidth="3" />)
      for (let i = 0; i < 9; i++) out.push(<line key={k++} x1={170 + i * 25} y1="170" x2={160 + i * 25} y2="280" stroke="#1b1a17" strokeWidth="2" opacity="0.5" />)
      out.push(<text key={k++} x="270" y="235" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="34" fill="#1b1a17">WHOOSH</text>)
      break
    }
    case 'letters': {
      out.push(<rect key={k++} width="400" height="300" fill="#f4efe4" />)
      out.push(<text key={k++} x="200" y="190" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="150" fill="#1b1a17">Aa</text>)
      out.push(<path key={k++} d="M60 240 C 120 200 160 260 220 230 S 330 200 350 240" fill="none" stroke={c(2)} strokeWidth="7" strokeLinecap="round" />)
      out.push(<rect key={k++} x="330" y="40" width="34" height="34" fill={c(2)} />)
      break
    }
    case 'spray': {
      out.push(<rect key={k++} width="400" height="300" fill="#2b2b2b" />)
      for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) out.push(<rect key={k++} x={i * 46 - 4} y={j * 62} width="44" height="60" fill="#3a3a3a" stroke="#222" strokeWidth="2" />)
      for (let i = 0; i < 900; i++) {
        const a = rng() * Math.PI * 2
        const d = Math.pow(rng(), 0.6) * 110
        out.push(<circle key={k++} cx={200 + Math.cos(a) * d * 1.5} cy={150 + Math.sin(a) * d} r={r(0.8, 2.6)} fill={c(i % 3)} opacity={0.8} />)
      }
      out.push(<text key={k++} x="200" y="170" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="64" fill="#fff" stroke="#1b1a17" strokeWidth="5" paintOrder="stroke">ART!</text>)
      break
    }
    case 'collage': {
      out.push(<rect key={k++} width="400" height="300" fill="#f2e3c6" />)
      for (let i = 0; i < 9; i++) {
        const x = r(-20, 340)
        const y = r(-20, 240)
        const w = r(70, 150)
        const h = r(50, 110)
        out.push(<rect key={k++} x={x} y={y} width={w} height={h} fill={c(i)} transform={`rotate(${r(-14, 14)} ${x + w / 2} ${y + h / 2})`} opacity="0.92" />)
      }
      for (let i = 0; i < 6; i++) out.push(<line key={k++} x1="30" y1={60 + i * 10} x2="160" y2={60 + i * 10} stroke="#1b1a17" strokeWidth="2" opacity="0.4" />)
      out.push(<circle key={k++} cx="260" cy="150" r="50" fill="#1b1a17" />)
      break
    }
    case 'columns': {
      out.push(<rect key={k++} width="400" height="300" fill={c(4) ?? '#1f3b4d'} />)
      out.push(<polygon key={k++} points="40,110 200,40 360,110" fill="#e8d5b5" />)
      out.push(<rect key={k++} x="40" y="110" width="320" height="18" fill="#c9b79c" />)
      for (let i = 0; i < 6; i++) {
        const x = 60 + i * 56
        out.push(<rect key={k++} x={x} y="128" width="26" height="140" fill="#f2e6c9" />)
        out.push(<line key={k++} x1={x + 9} y1="130" x2={x + 9} y2="266" stroke="#c9b79c" strokeWidth="2" />)
        out.push(<line key={k++} x1={x + 17} y1="130" x2={x + 17} y2="266" stroke="#c9b79c" strokeWidth="2" />)
      }
      out.push(<rect key={k++} x="30" y="266" width="340" height="20" fill="#c9b79c" />)
      break
    }
    case 'weave': {
      out.push(<rect key={k++} width="400" height="300" fill={c(3)} />)
      for (let y = 0; y < 300; y += 20)
        for (let x = 0; x < 400; x += 20) {
          const over = (x / 20 + y / 20) % 2 === 0
          out.push(<rect key={k++} x={x + 1} y={y + 1} width="18" height="18" rx="3" fill={over ? c(Math.floor(y / 60)) : c(Math.floor(x / 80) + 1)} />)
        }
      for (let i = 0; i < 4; i++) out.push(<path key={k++} d={`M0 ${60 + i * 60} l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14 l 20 -14 l 20 14`} fill="none" stroke="#f4e9d8" strokeWidth="3" />)
      break
    }
    case 'space': {
      out.push(<rect key={k++} width="400" height="300" fill="#0b0f2a" />)
      out.push(<polygon key={k++} points="0,300 80,120 320,120 400,300" fill="#141a3a" />)
      for (let i = 0; i < 7; i++) out.push(<line key={k++} x1={80 + i * 40} y1="120" x2={i * 66.6} y2="300" stroke="#2a3366" strokeWidth="1.5" />)
      for (let i = 0; i < 5; i++) out.push(<line key={k++} x1={80 - i * 16} y1={120 + i * 36} x2={320 + i * 16} y2={120 + i * 36} stroke="#2a3366" strokeWidth="1.5" />)
      out.push(<polygon key={k++} points="200,40 140,300 260,300" fill={c(1)} opacity="0.25" />)
      out.push(<circle key={k++} cx="200" cy="195" r="26" fill={c(1)} opacity="0.9" />)
      out.push(<circle key={k++} cx="200" cy="195" r="44" fill="none" stroke={c(3)} strokeWidth="3" opacity="0.7" />)
      break
    }
    default:
      out.push(<rect key={k++} width="400" height="300" fill={c(0)} />)
  }
  return out
}
