import { memo, useMemo, type ReactNode } from 'react'
import type { GenStyle } from '@/types'
import { pick, seeded } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useSvgId } from '@/lib/hooks'
import { STYLE_PALETTES } from './stylePalettes'

/* ------------------------------------------------------------------
   Procedural "paintings". Every artwork placeholder in Art Spark is
   generated here from (style, seed, palette) — no copyrighted images.
   Swap for licensed images later via the `imageUrl` fields in mocks.
   ------------------------------------------------------------------ */

type Rng = () => number
interface Ctx {
  rng: Rng
  p: string[]
  W: number
  H: number
  id: string
}

const r = (rng: Rng, a: number, b: number) => a + rng() * (b - a)

function impressionist({ rng, p, W, H }: Ctx) {
  const horizon = H * r(rng, 0.45, 0.6)
  const out: ReactNode[] = [
    <rect key="sky" width={W} height={horizon} fill={p[0]} />,
    <rect key="ground" y={horizon} width={W} height={H - horizon} fill={p[3]} />,
    <circle key="sun" cx={W * r(rng, 0.2, 0.8)} cy={horizon * 0.45} r={W * 0.07} fill={p[4]} opacity="0.85" />,
  ]
  for (let i = 0; i < 380; i++) {
    const y = rng() * H
    const sky = y < horizon
    const col = sky ? pick(rng, [p[0], p[1], p[2], p[5], '#ffffff']) : pick(rng, [p[3], p[4], p[2], p[5], p[1]])
    out.push(
      <ellipse
        key={i}
        cx={rng() * W}
        cy={y}
        rx={r(rng, 4, 11)}
        ry={r(rng, 1.5, 3.5)}
        fill={col}
        opacity={r(rng, 0.45, 0.85)}
        transform={`rotate(${r(rng, -25, 25)})`}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />,
    )
  }
  return out
}

function pointillist({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill="#fbf7ee" />]
  const horizon = H * 0.55
  for (let i = 0; i < 950; i++) {
    const x = rng() * W
    const y = rng() * H
    const zone = y < horizon ? [p[0], p[5], p[1]] : y < horizon + 40 ? [p[2], p[1], p[3]] : [p[2], p[3], p[4], p[1]]
    out.push(<circle key={i} cx={x} cy={y} r={r(rng, 1.8, 3.8)} fill={pick(rng, zone)} />)
  }
  return out
}

function cubist({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[1]} />]
  for (let i = 0; i < 26; i++) {
    const cx = r(rng, 0, W)
    const cy = r(rng, 0, H)
    const s = r(rng, 30, 120)
    const n = rng() > 0.5 ? 3 : 4
    const pts = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + rng()
      return `${cx + Math.cos(a) * s},${cy + Math.sin(a) * s * r(rng, 0.6, 1.2)}`
    }).join(' ')
    out.push(
      <polygon key={i} points={pts} fill={pick(rng, p)} opacity={r(rng, 0.7, 0.95)} stroke="#2a2522" strokeWidth={r(rng, 1, 3)} />,
    )
  }
  out.push(<circle key="eye" cx={W * 0.55} cy={H * 0.4} r={10} fill="none" stroke="#2a2522" strokeWidth="3" />)
  out.push(<path key="g" d={`M${W * 0.35} ${H * 0.2} L${W * 0.5} ${H * 0.8}`} stroke="#2a2522" strokeWidth="3" />)
  return out
}

function abstract({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[0]} />]
  for (let i = 0; i < 7; i++) {
    const rr = r(rng, 10, 60)
    const cx = rng() * W
    const cy = rng() * H
    const c = pick(rng, p.slice(1))
    out.push(<circle key={`c${i}`} cx={cx} cy={cy} r={rr} fill={c} opacity="0.88" />)
    if (rng() > 0.5) out.push(<circle key={`ci${i}`} cx={cx} cy={cy} r={rr * 0.45} fill={pick(rng, p)} />)
  }
  for (let i = 0; i < 9; i++) {
    out.push(
      <line
        key={`l${i}`}
        x1={rng() * W}
        y1={rng() * H}
        x2={rng() * W}
        y2={rng() * H}
        stroke={p[4]}
        strokeWidth={r(rng, 1, 4)}
        strokeLinecap="round"
      />,
    )
  }
  for (let i = 0; i < 3; i++) {
    const x = rng() * W
    const y = rng() * H
    out.push(
      <path
        key={`a${i}`}
        d={`M${x} ${y} q ${r(rng, 20, 80)} ${r(rng, -60, 60)} ${r(rng, 40, 120)} 0`}
        fill="none"
        stroke={pick(rng, p.slice(1))}
        strokeWidth="5"
      />,
    )
  }
  const gx = rng() * (W - 60)
  const gy = rng() * (H - 60)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if ((i + j) % 2 === 0) out.push(<rect key={`g${i}${j}`} x={gx + i * 12} y={gy + j * 12} width="12" height="12" fill={p[4]} />)
  return out
}

function pop({ rng, p, W, H, id }: Ctx) {
  const bg = pick(rng, [p[0], p[2], p[1]])
  const shape = pick(rng, [p[1], p[0], p[5]].filter((c) => c !== bg))
  const cx = W / 2
  const cy = H / 2
  const pts = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2
    const rad = (k % 2 ? 0.22 : 0.42) * Math.min(W, H)
    return `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`
  }).join(' ')
  return [
    <defs key="d">
      <pattern id={`${id}-dots`} width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="5" r="2.6" fill="#1B1A17" opacity="0.18" />
      </pattern>
    </defs>,
    <rect key="bg" width={W} height={H} fill={bg} />,
    <rect key="dots" width={W} height={H} fill={`url(#${id}-dots)`} />,
    <polygon key="burst" points={pts} fill={shape} stroke="#1B1A17" strokeWidth="6" strokeLinejoin="round" />,
    <circle key="c" cx={cx} cy={cy} r={Math.min(W, H) * 0.12} fill="#fff" stroke="#1B1A17" strokeWidth="5" />,
    <text key="t" x={cx} y={cy + 9} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="26" fill="#1B1A17">
      {pick(rng, ['POW!', 'WOW', 'ZAP!', 'POP'])}
    </text>,
  ]
}

function minimal({ rng, p, W, H, id }: Ctx) {
  const top = pick(rng, p)
  const bottom = pick(rng, p.filter((c) => c !== top))
  return [
    <defs key="d">
      <filter id={`${id}-soft`}>
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>,
    <rect key="bg" width={W} height={H} fill={pick(rng, [p[2], '#2a1e1e', p[4]])} />,
    <rect key="a" x={W * 0.1} y={H * 0.08} width={W * 0.8} height={H * 0.48} fill={top} filter={`url(#${id}-soft)`} opacity="0.95" />,
    <rect key="b" x={W * 0.1} y={H * 0.62} width={W * 0.8} height={H * 0.3} fill={bottom} filter={`url(#${id}-soft)`} opacity="0.95" />,
  ]
}

function surreal({ rng, p, W, H, id }: Ctx) {
  const hz = H * 0.62
  const cx = W * r(rng, 0.3, 0.7)
  return [
    <defs key="d">
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p[2]} />
        <stop offset="1" stopColor={p[1]} />
      </linearGradient>
    </defs>,
    <rect key="sky" width={W} height={hz} fill={`url(#${id}-sky)`} />,
    <rect key="sand" y={hz} width={W} height={H - hz} fill={p[0]} />,
    <ellipse key="sh" cx={cx + 50} cy={hz + 36} rx="70" ry="8" fill={p[5]} opacity="0.45" />,
    <ellipse key="egg" cx={cx} cy={hz - 50} rx="28" ry="38" fill={p[4]} />,
    <ellipse key="egg-s" cx={cx + 8} cy={hz - 44} rx="18" ry="30" fill="#000" opacity="0.08" />,
    <path key="ladder" d={`M${W * 0.15} ${H} L${W * 0.22} ${hz - 90} M${W * 0.2} ${H} L${W * 0.27} ${hz - 90}`} stroke={p[5]} strokeWidth="3" />,
    ...Array.from({ length: 8 }, (_, i) => (
      <line key={`r${i}`} x1={W * 0.155 + i * 0.009 * W} y1={H - i * 22} x2={W * 0.205 + i * 0.009 * W} y2={H - i * 22} stroke={p[5]} strokeWidth="2" />
    )),
    <path key="clock" d={`M${W * 0.72} ${hz + 10} q 30 -20 50 0 q 6 30 -6 60 q -10 -30 -44 -60z`} fill={p[3]} opacity="0.9" />,
    <circle key="moon" cx={W * 0.82} cy={H * 0.2} r="16" fill={p[4]} opacity="0.9" />,
  ]
}

function ukiyoe({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[0]} />]
  out.push(<polygon key="fuji" points={`${W * 0.55},${H * 0.62} ${W * 0.7},${H * 0.36} ${W * 0.85},${H * 0.62}`} fill={p[2]} />)
  out.push(<polygon key="snow" points={`${W * 0.66},${H * 0.43} ${W * 0.7},${H * 0.36} ${W * 0.74},${H * 0.43} ${W * 0.71},${H * 0.41} ${W * 0.69},${H * 0.44}`} fill="#fff" />)
  for (let k = 0; k < 4; k++) {
    const base = H * (0.62 + k * 0.1)
    const amp = 26 - k * 4
    let d = `M0 ${H} L0 ${base}`
    for (let x = 0; x <= W; x += 40) d += ` Q ${x + 20} ${base - amp - rng() * 10} ${x + 40} ${base}`
    d += ` L${W} ${H}Z`
    out.push(<path key={`w${k}`} d={d} fill={k % 2 ? p[2] : p[1]} stroke="#fff" strokeWidth="2" />)
  }
  // the big curling wave
  out.push(
    <path
      key="curl"
      d={`M${W * 0.05} ${H * 0.75} C ${W * 0.1} ${H * 0.2}, ${W * 0.45} ${H * 0.1}, ${W * 0.48} ${H * 0.38} C ${W * 0.4} ${H * 0.28}, ${W * 0.3} ${H * 0.42}, ${W * 0.34} ${H * 0.52} L ${W * 0.4} ${H * 0.8} Z`}
      fill={p[1]}
      stroke="#fff"
      strokeWidth="3"
    />,
  )
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    out.push(
      <circle key={`f${i}`} cx={W * (0.12 + t * 0.36)} cy={H * (0.3 - Math.sin(t * Math.PI) * 0.1) + rng() * 8} r={r(rng, 2, 5)} fill="#fff" />,
    )
  }
  out.push(<rect key="seal" x={W - 34} y={14} width="18" height="26" fill={p[4]} />)
  return out
}

function expressionist({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = []
  for (let k = 0; k < 9; k++) {
    let d = `M -20 ${(k / 9) * H}`
    for (let x = 0; x <= W + 40; x += 40) d += ` Q ${x + 20} ${(k / 9) * H + r(rng, -30, 30)} ${x + 40} ${(k / 9) * H + r(rng, -10, 10)}`
    out.push(<path key={k} d={d} fill="none" stroke={pick(rng, p)} strokeWidth={r(rng, 18, 34)} strokeLinecap="round" opacity="0.92" />)
  }
  out.push(<path key="fig" d={`M${W * 0.45} ${H} C ${W * 0.42} ${H * 0.7}, ${W * 0.4} ${H * 0.55}, ${W * 0.5} ${H * 0.5} C ${W * 0.6} ${H * 0.55}, ${W * 0.58} ${H * 0.7}, ${W * 0.56} ${H}Z`} fill="#1b1a17" opacity="0.85" />)
  out.push(<ellipse key="head" cx={W * 0.5} cy={H * 0.43} rx="20" ry="28" fill={p[5]} />)
  out.push(<ellipse key="m" cx={W * 0.5} cy={H * 0.48} rx="5" ry="8" fill="#1b1a17" />)
  return out
}

function renaissance({ p, W, H, id }: Ctx) {
  return [
    <defs key="d">
      <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p[5]} />
        <stop offset="0.5" stopColor={p[3]} />
        <stop offset="1" stopColor={p[4]} />
      </linearGradient>
      <radialGradient id={`${id}-f`} cx="0.5" cy="0.35" r="0.6">
        <stop offset="0" stopColor={p[2]} />
        <stop offset="1" stopColor={p[1]} />
      </radialGradient>
    </defs>,
    <rect key="bg" width={W} height={H} fill={p[0]} />,
    <path key="arch" d={`M${W * 0.18} ${H} V${H * 0.35} A ${W * 0.32} ${W * 0.32} 0 0 1 ${W * 0.82} ${H * 0.35} V${H}Z`} fill={`url(#${id}-l)`} />,
    <path key="hills" d={`M${W * 0.18} ${H * 0.6} q ${W * 0.15} -40 ${W * 0.3} 0 t ${W * 0.34} 0 V${H} H${W * 0.18}Z`} fill={p[3]} opacity="0.8" />,
    <path key="robe" d={`M${W * 0.32} ${H} C ${W * 0.34} ${H * 0.6}, ${W * 0.4} ${H * 0.5}, ${W * 0.5} ${H * 0.5} C ${W * 0.6} ${H * 0.5}, ${W * 0.66} ${H * 0.6}, ${W * 0.68} ${H}Z`} fill={p[4]} />,
    <path key="cloak" d={`M${W * 0.4} ${H} C ${W * 0.42} ${H * 0.7}, ${W * 0.46} ${H * 0.55}, ${W * 0.5} ${H * 0.55} C ${W * 0.56} ${H * 0.6}, ${W * 0.58} ${H * 0.75}, ${W * 0.6} ${H}Z`} fill="#8c2f2f" />,
    <ellipse key="face" cx={W * 0.5} cy={H * 0.4} rx={W * 0.06} ry={W * 0.075} fill={`url(#${id}-f)`} />,
    <circle key="halo" cx={W * 0.5} cy={H * 0.38} r={W * 0.1} fill="none" stroke="#d4af37" strokeWidth="3" opacity="0.8" />,
  ]
}

function geometric({ p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[0]} />]
  const s = 60
  const star = (cx: number, cy: number, rad: number) =>
    Array.from({ length: 16 }, (_, k) => {
      const a = (k / 16) * Math.PI * 2 + Math.PI / 16
      const rr = k % 2 ? rad * 0.55 : rad
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
    }).join(' ')
  let i = 0
  for (let y = 0; y <= H + s; y += s)
    for (let x = 0; x <= W + s; x += s) {
      out.push(<polygon key={i++} points={star(x, y, s * 0.48)} fill={p[1]} stroke={p[2]} strokeWidth="2" />)
      out.push(<polygon key={i++} points={star(x, y, s * 0.24)} fill={(x / s + y / s) % 2 ? p[4] : p[3]} />)
      out.push(<rect key={i++} x={x + s / 2 - 6} y={y + s / 2 - 6} width="12" height="12" transform={`rotate(45 ${x + s / 2} ${y + s / 2})`} fill={p[2]} />)
    }
  return out
}

function dots({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[0]} />]
  let k = 0
  const centres = Array.from({ length: 4 }, () => ({ x: r(rng, 50, W - 50), y: r(rng, 50, H - 50) }))
  centres.forEach((c, ci) => {
    for (let ring = 1; ring <= 5; ring++) {
      const rad = ring * 9
      const n = Math.round((2 * Math.PI * rad) / 7)
      const col = p[1 + ((ring + ci) % (p.length - 1))]
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2
        out.push(<circle key={k++} cx={c.x + Math.cos(a) * rad} cy={c.y + Math.sin(a) * rad} r="2.4" fill={col} />)
      }
    }
  })
  for (let i = 0; i < centres.length - 1; i++) {
    const a = centres[i]
    const b = centres[i + 1]
    for (let t = 0; t <= 1; t += 0.03) {
      out.push(<circle key={k++} cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t + Math.sin(t * 9) * 8} r="2" fill={p[3]} />)
    }
  }
  for (let i = 0; i < 260; i++) out.push(<circle key={k++} cx={rng() * W} cy={rng() * H} r="1.4" fill={pick(rng, p.slice(1))} opacity="0.7" />)
  return out
}

function ink({ rng, p, W, H, id }: Ctx) {
  const out: ReactNode[] = [
    <defs key="d">
      <filter id={`${id}-mist`}>
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>,
    <rect key="bg" width={W} height={H} fill={p[0]} />,
  ]
  for (let k = 0; k < 4; k++) {
    const base = H * (0.45 + k * 0.14)
    let d = `M0 ${H} L0 ${base}`
    for (let x = 0; x <= W; x += 30) d += ` L ${x} ${base - Math.abs(Math.sin(x / 50 + k)) * r(rng, 30, 90)}`
    d += ` L${W} ${H}Z`
    out.push(<path key={k} d={d} fill={p[1]} opacity={0.12 + k * 0.17} filter={`url(#${id}-mist)`} />)
  }
  const bx = W * 0.15
  out.push(<path key="branch" d={`M${bx} ${H * 0.12} q 60 20 120 6 q 40 -8 70 10`} stroke={p[1]} strokeWidth="5" fill="none" strokeLinecap="round" />)
  for (let i = 0; i < 18; i++) {
    const x = bx + 20 + i * 9
    out.push(<line key={`n${i}`} x1={x} y1={H * 0.14} x2={x + r(rng, -8, 8)} y2={H * 0.14 + r(rng, 10, 22)} stroke={p[1]} strokeWidth="1.6" />)
  }
  out.push(<rect key="seal" x={W - 40} y={H - 56} width="20" height="20" fill={p[4]} />)
  return out
}

function lacquer({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill={p[0]} />]
  for (let i = 0; i < 6; i++) {
    const cx = rng() * W
    const cy = rng() * H
    out.push(<ellipse key={`r${i}`} cx={cx} cy={cy} rx={r(rng, 30, 90)} ry={r(rng, 20, 60)} fill={pick(rng, [p[1], p[4]])} opacity="0.85" />)
  }
  for (let i = 0; i < 120; i++) {
    const x = rng() * W
    const y = rng() * H
    const s = r(rng, 2, 9)
    out.push(
      <polygon
        key={`e${i}`}
        points={`${x},${y} ${x + s},${y + r(rng, -2, 3)} ${x + s * 0.7},${y + s} ${x - 1},${y + s * 0.8}`}
        fill={rng() > 0.4 ? p[3] : p[2]}
        opacity={r(rng, 0.6, 1)}
      />,
    )
  }
  out.push(<path key="gold" d={`M0 ${H * 0.7} C ${W * 0.3} ${H * 0.55}, ${W * 0.6} ${H * 0.85}, ${W} ${H * 0.65}`} stroke={p[2]} strokeWidth="6" fill="none" />)
  out.push(<circle key="moon" cx={W * 0.78} cy={H * 0.25} r="26" fill={p[2]} opacity="0.9" />)
  return out
}

function folk({ p, W, H }: Ctx) {
  const cx = W * 0.5
  const cy = H * 0.56
  return [
    <rect key="bg" width={W} height={H} fill={p[0]} />,
    <rect key="border" x="8" y="8" width={W - 16} height={H - 16} fill="none" stroke={p[4]} strokeWidth="4" />,
    <ellipse key="body" cx={cx} cy={cy} rx={W * 0.24} ry={H * 0.22} fill={p[1]} stroke={p[4]} strokeWidth="5" />,
    <circle key="head" cx={cx + W * 0.22} cy={cy - H * 0.16} r={H * 0.1} fill={p[1]} stroke={p[4]} strokeWidth="5" />,
    <path key="comb" d={`M${cx + W * 0.19} ${cy - H * 0.26} q 10 -18 18 0 q 8 -16 16 2`} fill={p[1]} stroke={p[4]} strokeWidth="4" />,
    <path key="tail" d={`M${cx - W * 0.22} ${cy - 10} C ${cx - W * 0.4} ${cy - H * 0.4}, ${cx - W * 0.1} ${cy - H * 0.45}, ${cx - W * 0.12} ${cy - H * 0.12}`} fill={p[2]} stroke={p[4]} strokeWidth="5" />,
    <path key="swirl" d={`M${cx - 30} ${cy} a 20 20 0 1 1 30 18 a 10 10 0 1 1 -12 -14`} fill="none" stroke={p[3]} strokeWidth="6" />,
    <circle key="eye" cx={cx + W * 0.24} cy={cy - H * 0.17} r="4" fill={p[4]} />,
    <path key="legs" d={`M${cx - 20} ${cy + H * 0.2} v 36 M${cx + 20} ${cy + H * 0.2} v 36`} stroke={p[4]} strokeWidth="5" />,
    <path key="ground" d={`M20 ${H - 30} H ${W - 20}`} stroke={p[5]} strokeWidth="4" strokeDasharray="10 8" />,
  ]
}

function baroque({ rng, p, W, H, id }: Ctx) {
  const out: ReactNode[] = [
    <defs key="d">
      <radialGradient id={`${id}-spot`} cx="0.45" cy="0.4" r="0.55">
        <stop offset="0" stopColor={p[3]} stopOpacity="0.55" />
        <stop offset="0.5" stopColor={p[2]} stopOpacity="0.15" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>,
    <rect key="bg" width={W} height={H} fill={p[0]} />,
    <rect key="spot" width={W} height={H} fill={`url(#${id}-spot)`} />,
    <path key="cloth" d={`M${W * 0.1} ${H} C ${W * 0.25} ${H * 0.7}, ${W * 0.7} ${H * 0.75}, ${W * 0.9} ${H}`} fill={p[4]} />,
    <ellipse key="bowl" cx={W * 0.48} cy={H * 0.72} rx={W * 0.2} ry={H * 0.06} fill={p[1]} />,
  ]
  for (let i = 0; i < 7; i++) {
    out.push(
      <circle key={`f${i}`} cx={W * (0.36 + rng() * 0.24)} cy={H * (0.58 + rng() * 0.1)} r={r(rng, 14, 24)} fill={pick(rng, [p[2], p[4], p[5], p[3]])} />,
    )
  }
  out.push(<ellipse key="hl" cx={W * 0.44} cy={H * 0.58} rx="6" ry="4" fill="#fff" opacity="0.5" />)
  return out
}

function cave({ rng, p, W, H, id }: Ctx) {
  const animal = (x: number, y: number, s: number, c: string, k: string) => (
    <path
      key={k}
      d={`M${x} ${y} c ${10 * s} ${-18 * s} ${40 * s} ${-26 * s} ${70 * s} ${-14 * s} c ${12 * s} ${-10 * s} ${22 * s} ${-6 * s} ${26 * s} ${4 * s} c ${-4 * s} ${10 * s} ${-10 * s} ${12 * s} ${-14 * s} ${14 * s} l ${2 * s} ${22 * s} l ${-8 * s} 0 l ${-4 * s} ${-16 * s} c ${-16 * s} ${4 * s} ${-36 * s} ${4 * s} ${-50 * s} 0 l ${-4 * s} ${18 * s} l ${-8 * s} 0 z`}
      fill={c}
      opacity="0.85"
    />
  )
  const out: ReactNode[] = [
    <defs key="d">
      <filter id={`${id}-rock`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="3" />
        <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.38  0 0 0 0 0.22  0 0 0 0.5 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>,
    <rect key="bg" width={W} height={H} fill={p[0]} />,
    <rect key="tex" width={W} height={H} fill="#000" filter={`url(#${id}-rock)`} />,
    animal(W * 0.15, H * 0.45, 1.6, p[1], 'a1'),
    animal(W * 0.5, H * 0.75, 1.1, p[3], 'a2'),
  ]
  for (let i = 0; i < 3; i++) {
    const x = r(rng, W * 0.6, W * 0.9)
    const y = r(rng, H * 0.15, H * 0.4)
    out.push(
      <g key={`h${i}`} opacity="0.75" fill={p[2]}>
        <ellipse cx={x} cy={y + 14} rx="11" ry="13" />
        {[-10, -4, 2, 8].map((dx, j) => (
          <rect key={j} x={x + dx - 2} y={y - 12} width="5" height="18" rx="2.5" />
        ))}
        <rect x={x + 10} y={y + 2} width="5" height="14" rx="2.5" transform={`rotate(-35 ${x + 12} ${y + 9})`} />
      </g>,
    )
  }
  return out
}

function mosaic({ rng, p, W, H }: Ctx) {
  const out: ReactNode[] = [<rect key="bg" width={W} height={H} fill="#e8e0d0" />]
  const s = 14
  let k = 0
  for (let y = 0; y < H; y += s)
    for (let x = 0; x < W; x += s) {
      const dx = x - W / 2
      const dy = y - H / 2
      const d = Math.sqrt(dx * dx + dy * dy)
      const band = Math.floor(d / 34) % p.length
      out.push(
        <rect
          key={k++}
          x={x + rng() * 2}
          y={y + rng() * 2}
          width={s - 3}
          height={s - 3}
          rx="1.5"
          fill={p[band]}
          transform={`rotate(${r(rng, -6, 6)} ${x + s / 2} ${y + s / 2})`}
        />,
      )
    }
  return out
}

function fauve({ rng, p, W, H }: Ctx) {
  return [
    <rect key="bg" width={W} height={H} fill={p[1]} />,
    <path key="hill" d={`M0 ${H * 0.6} Q ${W * 0.3} ${H * 0.4} ${W * 0.6} ${H * 0.6} T ${W} ${H * 0.55} V${H} H0Z`} fill={p[3]} />,
    <path key="field" d={`M0 ${H * 0.78} Q ${W * 0.5} ${H * 0.65} ${W} ${H * 0.8} V${H} H0Z`} fill={p[0]} />,
    <rect key="house" x={W * 0.6} y={H * 0.48} width={W * 0.16} height={H * 0.18} fill={p[2]} />,
    <polygon key="roof" points={`${W * 0.58},${H * 0.48} ${W * 0.68},${H * 0.38} ${W * 0.78},${H * 0.48}`} fill={p[5]} />,
    <rect key="trunk" x={W * 0.24} y={H * 0.4} width="12" height={H * 0.4} fill={p[4]} />,
    <circle key="crown" cx={W * 0.25} cy={H * 0.35} r={W * 0.1} fill={pick(rng, [p[2], p[0], p[5]])} />,
    <circle key="sun" cx={W * 0.85} cy={H * 0.18} r="24" fill={p[2]} />,
  ]
}

function digital({ rng, p, W, H, id }: Ctx) {
  const out: ReactNode[] = [
    <defs key="d">
      <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p[4]} />
        <stop offset="1" stopColor={p[1]} />
      </linearGradient>
    </defs>,
    <rect key="bg" width={W} height={H} fill={p[0]} />,
    <circle key="sun" cx={W / 2} cy={H * 0.5} r={H * 0.24} fill={`url(#${id}-sun)`} />,
  ]
  for (let i = 0; i < 5; i++) out.push(<rect key={`cut${i}`} x={W / 2 - H * 0.25} y={H * 0.5 + i * 9} width={H * 0.5} height={2 + i} fill={p[0]} />)
  const hz = H * 0.62
  out.push(<rect key="floor" y={hz} width={W} height={H - hz} fill={p[0]} />)
  for (let i = 0; i < 8; i++) out.push(<line key={`h${i}`} x1="0" x2={W} y1={hz + i * i * 2.4} y2={hz + i * i * 2.4} stroke={p[2]} strokeWidth="1" opacity="0.8" />)
  for (let i = -8; i <= 8; i++) out.push(<line key={`v${i}`} x1={W / 2 + i * 12} y1={hz} x2={W / 2 + i * 60} y2={H} stroke={p[2]} strokeWidth="1" opacity="0.8" />)
  for (let i = 0; i < 10; i++) out.push(<rect key={`g${i}`} x={rng() * W} y={rng() * hz} width={r(rng, 10, 60)} height={r(rng, 2, 6)} fill={pick(rng, [p[1], p[2], p[5]])} opacity="0.7" />)
  return out
}

const RENDERERS: Record<GenStyle, (c: Ctx) => ReactNode[]> = {
  impressionist,
  pointillist,
  cubist,
  abstract,
  pop,
  minimal,
  surreal,
  ukiyoe,
  expressionist,
  renaissance,
  geometric,
  dots,
  ink,
  lacquer,
  folk,
  baroque,
  cave,
  mosaic,
  fauve,
  digital,
}

export type ArtAspect = 'landscape' | 'portrait' | 'square'
const DIMS: Record<ArtAspect, [number, number]> = {
  landscape: [400, 300],
  portrait: [300, 400],
  square: [360, 360],
}

export const GenerativeArt = memo(function GenerativeArt({
  style,
  seed,
  palette,
  aspect = 'landscape',
  className,
  title,
  grain = true,
}: {
  style: GenStyle
  seed: string
  palette?: string[]
  aspect?: ArtAspect
  className?: string
  title?: string
  grain?: boolean
}) {
  const id = useSvgId('ga')
  const [W, H] = DIMS[aspect]
  const nodes = useMemo(() => {
    const rng = seeded(`${style}:${seed}`)
    const p = palette && palette.length >= 3 ? [...palette, ...STYLE_PALETTES[style]].slice(0, 6) : STYLE_PALETTES[style]
    return RENDERERS[style]({ rng, p, W, H, id })
  }, [style, seed, palette, W, H, id])
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('h-full w-full', className)}
      preserveAspectRatio="xMidYMid slice"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g filter={grain ? 'url(#canvas-grain)' : undefined}>{nodes}</g>
    </svg>
  )
})
