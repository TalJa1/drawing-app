/* Image heuristics for the mock AI judge, the coverage ring and hints.
   Pure functions over RGBA arrays (downsampled ~4×) so they are fast and testable. */
import type { ArtworkAnalysis } from '@/types'
import { hexToRgb, hueBucket, hueDistance, rgbToHex, rgbToHsv } from '@/lib/color'
import { floodFillMask, inkBarrier } from './engine/floodFill'

export interface Regions {
  w: number
  h: number
  ink: Uint8Array
  /** 1 = fillable area inside the drawing */
  inside: Uint8Array
  /** 1 = background outside the drawing (where paint counts as spill) */
  outside: Uint8Array
  insideCount: number
  outsideCount: number
}

/** Work out which pixels are "inside" the template (enclosed by line art). */
export function computeRegions(inkRgba: Uint8ClampedArray | null, w: number, h: number): Regions {
  const n = w * h
  if (!inkRgba) {
    const inside = new Uint8Array(n).fill(1)
    return { w, h, ink: new Uint8Array(n), inside, outside: new Uint8Array(n), insideCount: n, outsideCount: 0 }
  }
  const ink = inkBarrier(inkRgba, 170)
  // close tiny gaps in downsampled lines by dilating the ink once
  const walls = new Uint8Array(ink)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (ink[i]) walls[i - 1] = walls[i + 1] = walls[i - w] = walls[i + w] = 1
    }
  // flood from every border pixel to find the outside
  const outside = new Uint8Array(n)
  const empty = new Uint8ClampedArray(n * 4)
  const seeds: [number, number][] = []
  for (let x = 0; x < w; x += 3) seeds.push([x, 0], [x, h - 1])
  for (let y = 0; y < h; y += 3) seeds.push([0, y], [w - 1, y])
  for (const [sx, sy] of seeds) {
    const i = sy * w + sx
    if (outside[i] || walls[i]) continue
    const r = floodFillMask(empty, w, h, sx, sy, { tolerance: 0, barrier: walls })
    for (let k = 0; k < n; k++) if (r.mask[k]) outside[k] = 1
  }
  let inside = new Uint8Array(n)
  let insideCount = 0
  let outsideMask = outside
  // the 1px rim along the lines (dilated walls) is ambiguous, so it counts as neither
  for (let i = 0; i < n; i++) {
    if (!outside[i] && !walls[i]) {
      inside[i] = 1
      insideCount++
    }
  }
  // drawings that touch the edges (no enclosing frame) → treat all non-ink as inside
  if (insideCount < n * 0.08) {
    inside = new Uint8Array(n)
    insideCount = 0
    outsideMask = new Uint8Array(n)
    for (let i = 0; i < n; i++)
      if (!ink[i]) {
        inside[i] = 1
        insideCount++
      }
  }
  const outsideCount = outsideMask.reduce((s, v) => s + v, 0)
  return { w, h, ink, inside, outside: outsideMask, insideCount, outsideCount }
}

const PAINTED_ALPHA = 40

/** Fraction of inside area that has paint (fast, for the live progress ring). */
export function coverageOf(paint: Uint8ClampedArray, regions: Regions): number {
  if (!regions.insideCount) return 0
  let covered = 0
  for (let i = 0; i < regions.inside.length; i++) if (regions.inside[i] && paint[i * 4 + 3] > PAINTED_ALPHA) covered++
  return covered / regions.insideCount
}

/** Mask (RGBA, same size as regions) of inside pixels with no paint — for the ghost hint. */
export function ghostMask(paint: Uint8ClampedArray, regions: Regions, rgb: [number, number, number] = [242, 169, 59]): ImageData | null {
  if (typeof ImageData === 'undefined') return null
  const img = new ImageData(regions.w, regions.h)
  for (let i = 0; i < regions.inside.length; i++) {
    if (regions.inside[i] && paint[i * 4 + 3] <= PAINTED_ALPHA) {
      img.data[i * 4] = rgb[0]
      img.data[i * 4 + 1] = rgb[1]
      img.data[i * 4 + 2] = rgb[2]
      img.data[i * 4 + 3] = 150
    }
  }
  return img
}

function pairHarmony(d: number): number {
  // analogous, triad, split-complementary and complementary relationships score high
  const targets = [0, 30, 120, 150, 180]
  const best = Math.min(...targets.map((t) => Math.abs(d - t)))
  return Math.max(0, 1 - best / 28)
}

export function analyse(paint: Uint8ClampedArray, regions: Regions, suggestedPalette: string[], strokes: number): ArtworkAnalysis {
  const { w, h, inside, outside, ink } = regions
  const n = w * h
  let painted = 0
  let insidePainted = 0
  let outsidePainted = 0
  let outsideTotal = 0
  let nearInk = 0
  let inkTotal = 0
  const buckets = new Array(12).fill(0)
  const bucketRgb = Array.from({ length: 13 }, () => [0, 0, 0, 0])
  let satSum = 0
  const lums: number[] = []
  const rows = 9
  const cols = 12
  const cellInside = Array.from({ length: rows }, () => new Array(cols).fill(0))
  const cellPainted = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let i = 0; i < n; i++) {
    const k = i * 4
    const a = paint[k + 3]
    const isPainted = a > PAINTED_ALPHA
    const y = Math.floor(i / w)
    const x = i - y * w
    if (ink[i]) {
      inkTotal++
      if (isPainted || (x > 0 && paint[k - 4 + 3] > PAINTED_ALPHA) || (x < w - 1 && paint[k + 4 + 3] > PAINTED_ALPHA)) nearInk++
      continue
    }
    const r = Math.floor((y / h) * rows)
    const c = Math.floor((x / w) * cols)
    if (inside[i]) cellInside[r][c]++
    else if (outside[i]) outsideTotal++
    if (!isPainted) continue
    painted++
    if (inside[i]) {
      insidePainted++
      cellPainted[r][c]++
    } else if (outside[i]) outsidePainted++
    const R = paint[k]
    const G = paint[k + 1]
    const B = paint[k + 2]
    const hb = hueBucket(R, G, B)
    const slot = hb < 0 ? 12 : hb
    if (hb >= 0) buckets[hb]++
    const acc = bucketRgb[slot]
    acc[0] += R
    acc[1] += G
    acc[2] += B
    acc[3]++
    const hsv = rgbToHsv({ r: R, g: G, b: B })
    satSum += hsv.s
    if ((i & 3) === 0) lums.push(0.2126 * R + 0.7152 * G + 0.0722 * B)
  }

  const coverage = regions.insideCount ? insidePainted / regions.insideCount : 0
  const spill = outsideTotal > n * 0.02 ? outsidePainted / outsideTotal : 0
  const hueTotal = buckets.reduce((s, v) => s + v, 0)
  const significant = buckets.map((v, i) => ({ i, share: hueTotal ? v / hueTotal : 0 })).filter((b) => b.share >= 0.04)
  const distinctHues = significant.length

  // harmony: weighted average over pairs of significant hues
  let harmony = distinctHues === 0 ? 0 : 0.72
  if (distinctHues >= 2) {
    let sum = 0
    let wsum = 0
    for (let a = 0; a < significant.length; a++)
      for (let b = a + 1; b < significant.length; b++) {
        const d = hueDistance(significant[a].i * 30 + 15, significant[b].i * 30 + 15)
        const wt = significant[a].share * significant[b].share
        sum += pairHarmony(d) * wt
        wsum += wt
      }
    harmony = wsum ? 0.35 + 0.65 * (sum / wsum) : 0.6
    // too many competing hues reduces harmony
    if (distinctHues > 6) harmony *= 0.85
  }

  const dominant = bucketRgb
    .map((acc, slot) => ({
      slot,
      count: acc[3],
      hex: acc[3] ? rgbToHex({ r: acc[0] / acc[3], g: acc[1] / acc[3], b: acc[2] / acc[3] }) : '',
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((d) => d.hex)

  // palette match: how close dominant colours sit to the suggested palette
  let paletteMatch = 0
  if (dominant.length && suggestedPalette.length) {
    const pal = suggestedPalette.map(hexToRgb)
    const dist = dominant.map((hex) => {
      const c = hexToRgb(hex)
      return Math.min(...pal.map((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) / 441))
    })
    paletteMatch = Math.max(0, 1 - (dist.reduce((s, v) => s + v, 0) / dist.length) * 2.2)
  } else if (dominant.length) paletteMatch = 0.6

  lums.sort((a, b) => a - b)
  const pct = (q: number) => (lums.length ? lums[Math.min(lums.length - 1, Math.floor(q * lums.length))] : 0)
  const valueRange = Math.min(1, ((pct(0.92) - pct(0.08)) / 255) * 1.5)

  const grid = cellInside.map((row, r) => row.map((cnt, c) => (cnt < 4 ? -1 : cellPainted[r][c] / cnt)))

  return {
    coverage,
    spill,
    lineTrace: inkTotal ? nearInk / inkTotal : 0,
    distinctHues,
    dominant,
    harmony,
    paletteMatch,
    valueRange,
    saturation: painted ? satSum / painted : 0,
    inkAmount: painted / n,
    grid,
    strokes,
  }
}
