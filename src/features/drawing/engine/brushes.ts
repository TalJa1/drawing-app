/* Brush rendering: dab sprites (cached) + per-tool stamping rules.
   Every stroke is drawn into a stroke buffer; the engine composites it
   onto the layer with the tool's opacity when the stroke ends. */
import type { ToolId } from './types'

type Ctx = CanvasRenderingContext2D

const spriteCache = new Map<string, HTMLCanvasElement>()

function canvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = Math.max(2, Math.ceil(size))
  return c
}

/** Soft/hard round dab. hardness 1 = crisp edge, 0 = very soft. */
export function roundSprite(color: string, diameter: number, hardness: number): HTMLCanvasElement {
  const d = Math.max(2, Math.round(diameter))
  const key = `round|${color}|${d}|${hardness.toFixed(2)}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const c = canvas(d)
  const ctx = c.getContext('2d')!
  const r = d / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, color)
  g.addColorStop(Math.min(0.98, Math.max(0.01, hardness)), color)
  g.addColorStop(1, hexAlpha(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fill()
  remember(key, c)
  return c
}

/** Watercolour dab: transparent centre, darker pigment-pooling rim, soft bleed. */
export function watercolourSprite(color: string, diameter: number): HTMLCanvasElement {
  const d = Math.max(4, Math.round(diameter))
  const key = `wc|${color}|${d}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const c = canvas(d)
  const ctx = c.getContext('2d')!
  const r = d / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, hexAlpha(color, 0.6))
  g.addColorStop(0.6, hexAlpha(color, 0.68))
  g.addColorStop(0.84, hexAlpha(color, 0.8))
  g.addColorStop(0.94, hexAlpha(color, 0.3))
  g.addColorStop(1, hexAlpha(color, 0))
  ctx.fillStyle = g
  // slightly irregular blob instead of a perfect circle
  ctx.beginPath()
  const n = 14
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (0.86 + 0.14 * Math.sin(a * 3 + d))
    const x = r + Math.cos(a) * rr
    const y = r + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  remember(key, c)
  return c
}

/** Grainy chalk/charcoal stamps (a few random variants for texture). */
export function chalkSprite(color: string, diameter: number, variant: number): HTMLCanvasElement {
  const d = Math.max(4, Math.round(diameter))
  const key = `chalk|${color}|${d}|${variant}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const c = canvas(d)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(d, d)
  const [cr, cg, cb] = hexRgb(color)
  let seed = (variant + 1) * 9301 + d * 49297
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const r = d / 2
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dist = Math.hypot(x - r + 0.5, y - r + 0.5) / r
      if (dist > 1) continue
      const edge = 1 - Math.pow(dist, 3)
      const grain = rand()
      if (grain < 0.38 + dist * 0.3) continue
      const k = (y * d + x) * 4
      img.data[k] = cr
      img.data[k + 1] = cg
      img.data[k + 2] = cb
      img.data[k + 3] = Math.round(255 * edge * (0.45 + 0.55 * grain))
    }
  }
  ctx.putImageData(img, 0, 0)
  remember(key, c)
  return c
}

function remember(key: string, c: HTMLCanvasElement) {
  if (spriteCache.size > 160) {
    const first = spriteCache.keys().next().value
    if (first) spriteCache.delete(first)
  }
  spriteCache.set(key, c)
}

export function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function hexAlpha(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/* ---------- per-tool behaviour ---------- */

export interface ToolProfile {
  /** how the stroke is rendered */
  render: 'path' | 'dabs'
  /** distance between dabs as a fraction of size */
  spacing: number
  /** default opacity applied when the stroke is committed */
  defaultOpacity: number
  /** pressure affects size? */
  pressureSize: boolean
  /** pressure affects flow (dab alpha)? */
  pressureFlow: boolean
}

export const TOOL_PROFILES: Partial<Record<ToolId, ToolProfile>> = {
  pencil: { render: 'dabs', spacing: 0.22, defaultOpacity: 0.9, pressureSize: true, pressureFlow: true },
  pen: { render: 'path', spacing: 0, defaultOpacity: 1, pressureSize: true, pressureFlow: false },
  marker: { render: 'path', spacing: 0, defaultOpacity: 0.82, pressureSize: false, pressureFlow: false },
  watercolour: { render: 'dabs', spacing: 0.05, defaultOpacity: 0.7, pressureSize: true, pressureFlow: true },
  airbrush: { render: 'dabs', spacing: 0.08, defaultOpacity: 0.6, pressureSize: false, pressureFlow: true },
  chalk: { render: 'dabs', spacing: 0.18, defaultOpacity: 0.9, pressureSize: true, pressureFlow: true },
  eraser: { render: 'dabs', spacing: 0.12, defaultOpacity: 1, pressureSize: true, pressureFlow: false },
  smudge: { render: 'dabs', spacing: 0.15, defaultOpacity: 0.6, pressureSize: true, pressureFlow: true },
}

/** Draw one dab for the given tool into the stroke buffer. */
export function stampDab(
  ctx: Ctx,
  tool: ToolId,
  color: string,
  x: number,
  y: number,
  size: number,
  hardness: number,
  flow: number,
  rand: () => number,
): void {
  const s = Math.max(1, size)
  switch (tool) {
    case 'pencil': {
      const sprite = roundSprite(color, Math.max(2, s), 0.75)
      ctx.globalAlpha = Math.min(1, (0.45 + rand() * 0.45) * flow)
      ctx.drawImage(sprite, x - s / 2 + (rand() - 0.5) * 0.6, y - s / 2 + (rand() - 0.5) * 0.6, s, s)
      break
    }
    case 'watercolour': {
      const jitter = s * 0.05
      const ds = s * (0.9 + rand() * 0.2)
      const sprite = watercolourSprite(color, ds)
      ctx.globalAlpha = 0.035 * flow + 0.015
      ctx.drawImage(sprite, x - ds / 2 + (rand() - 0.5) * jitter, y - ds / 2 + (rand() - 0.5) * jitter, ds, ds)
      // occasional bloom that bleeds outward
      if (rand() < 0.03) {
        const bs = ds * (1.3 + rand() * 0.4)
        ctx.globalAlpha = 0.03 * flow
        ctx.drawImage(watercolourSprite(color, bs), x - bs / 2, y - bs / 2, bs, bs)
      }
      break
    }
    case 'airbrush': {
      const sprite = roundSprite(color, s, Math.min(0.6, hardness * 0.6))
      ctx.globalAlpha = 0.06 * flow + 0.02
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s)
      // speckles at the edge like a real spray
      ctx.fillStyle = color
      const n = Math.ceil(s / 6)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const r = (s / 2) * Math.sqrt(rand())
        ctx.globalAlpha = 0.25 * flow
        ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.2, 1.2)
      }
      break
    }
    case 'chalk': {
      const sprite = chalkSprite(color, s, Math.floor(rand() * 4))
      ctx.globalAlpha = Math.min(1, 0.55 + 0.4 * flow)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rand() * Math.PI * 2)
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s)
      ctx.restore()
      break
    }
    case 'eraser': {
      const sprite = roundSprite('#000000', s, Math.max(0.05, hardness))
      ctx.globalAlpha = 1
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s)
      break
    }
    default: {
      const sprite = roundSprite(color, s, hardness)
      ctx.globalAlpha = flow
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s)
    }
  }
  ctx.globalAlpha = 1
}
