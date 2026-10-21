/* Helpers for hand-authored line art (viewBox 1200 × 900).
   Shapes are filled white and layered back-to-front like paper cut-outs:
   on the canvas the line-art layer is multiplied over the paint, so white
   disappears while the ink outlines stay crisp and every region is closed. */

export const W = 1200
export const H = 900

export function wrap(body: string, strokeWidth = 7): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g fill="#fff" stroke="#1b1a17" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
}

export const frame = () => `<rect x="60" y="60" width="1080" height="780" fill="none"/>`

const f = (n: number) => Math.round(n * 10) / 10

/** A pointed petal from radius r1 to r2 at angle a (radians), half-width w (radians). */
export function petal(cx: number, cy: number, a: number, r1: number, r2: number, w: number): string {
  const p = (r: number, ang: number) => `${f(cx + Math.cos(ang) * r)} ${f(cy + Math.sin(ang) * r)}`
  const mid = r1 + (r2 - r1) * 0.55
  return `<path d="M${p(r1, a - w * 0.6)} Q${p(mid, a - w * 1.25)} ${p(r2, a)} Q${p(mid, a + w * 1.25)} ${p(r1, a + w * 0.6)} Z"/>`
}

/** A rounded petal (more like a teardrop). */
export function roundPetal(cx: number, cy: number, a: number, r1: number, r2: number, w: number): string {
  const p = (r: number, ang: number) => `${f(cx + Math.cos(ang) * r)} ${f(cy + Math.sin(ang) * r)}`
  return `<path d="M${p(r1, a - w * 0.5)} C${p(r2 * 0.95, a - w * 1.3)} ${p(r2 * 1.08, a - w * 0.25)} ${p(r2, a)} C${p(r2 * 1.08, a + w * 0.25)} ${p(r2 * 0.95, a + w * 1.3)} ${p(r1, a + w * 0.5)} Z"/>`
}

export function ring(n: number, offset: number, fn: (a: number) => string): string {
  let s = ''
  for (let i = 0; i < n; i++) s += fn(offset + (i / n) * Math.PI * 2)
  return s
}

export function circle(cx: number, cy: number, r: number, extra = ''): string {
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${extra ? ' ' + extra : ''}/>`
}

export function dotsRing(cx: number, cy: number, n: number, r: number, size: number, extra = ''): string {
  return ring(n, 0, (a) => circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, extra))
}

export function star(cx: number, cy: number, points: number, r1: number, r2: number, rot = -Math.PI / 2): string {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1
    const a = rot + (i / (points * 2)) * Math.PI * 2
    pts.push(`${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`)
  }
  return `<polygon points="${pts.join(' ')}"/>`
}

export const INK = 'fill="#1b1a17"'
export const NONE = 'fill="none"'
