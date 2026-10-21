/* Scanline flood fill on raw RGBA buffers — pure and unit-tested.
   Works on any width × height buffer so it runs in tests without a DOM. */

export interface FillOptions {
  /** 0–255 per-channel tolerance (max channel difference allowed) */
  tolerance: number
  /** optional barrier: pixels where barrier[i] === 1 are walls (e.g. line art) */
  barrier?: Uint8Array
  /**
   * Grow the filled area this many pixels to hide anti-aliased gaps: into barrier
   * pixels when a barrier is given, otherwise into any neighbouring pixel.
   */
  bleed?: number
}

export interface FillResult {
  mask: Uint8Array
  count: number
  bounds: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * Returns a mask (1 = fill) of the region connected to (sx, sy) whose colour
 * in `pixels` matches the seed colour within tolerance and is not a barrier.
 */
export function floodFillMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number,
  { tolerance, barrier, bleed = 0 }: FillOptions,
): FillResult {
  const mask = new Uint8Array(width * height)
  const empty: FillResult = { mask, count: 0, bounds: { x0: 0, y0: 0, x1: -1, y1: -1 } }
  sx = Math.floor(sx)
  sy = Math.floor(sy)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return empty
  const seedIdx = sy * width + sx
  if (barrier?.[seedIdx]) return empty

  const o = seedIdx * 4
  const r0 = pixels[o]
  const g0 = pixels[o + 1]
  const b0 = pixels[o + 2]
  const a0 = pixels[o + 3]
  const tol = Math.max(0, tolerance)

  const matches = (i: number) => {
    if (mask[i] || barrier?.[i]) return false
    const k = i * 4
    const a = pixels[k + 3]
    // fully transparent pixels compare by alpha only
    if (a0 === 0 && a === 0) return true
    return (
      Math.abs(pixels[k] - r0) <= tol &&
      Math.abs(pixels[k + 1] - g0) <= tol &&
      Math.abs(pixels[k + 2] - b0) <= tol &&
      Math.abs(a - a0) <= tol
    )
  }

  let count = 0
  let x0 = sx
  let x1 = sx
  let y0 = sy
  let y1 = sy
  const stack: number[] = [sx, sy]
  while (stack.length) {
    const y = stack.pop()!
    let x = stack.pop()!
    let i = y * width + x
    // move left to the start of the span
    while (x > 0 && matches(i - 1)) {
      x--
      i--
    }
    let spanAbove = false
    let spanBelow = false
    while (x < width && matches(i)) {
      mask[i] = 1
      count++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (y > 0) {
        const up = i - width
        if (matches(up)) {
          if (!spanAbove) {
            stack.push(x, y - 1)
            spanAbove = true
          }
        } else spanAbove = false
      }
      if (y < height - 1) {
        const down = i + width
        if (matches(down)) {
          if (!spanBelow) {
            stack.push(x, y + 1)
            spanBelow = true
          }
        } else spanBelow = false
      }
      x++
      i++
    }
  }

  // Bleed under the line art so anti-aliased edges don't leave a white halo.
  if (bleed > 0 && count) {
    const canGrow = (i: number) => (barrier ? barrier[i] === 1 : true)
    for (let pass = 0; pass < bleed; pass++) {
      const grow: number[] = []
      for (let y = Math.max(0, y0 - 1); y <= Math.min(height - 1, y1 + 1); y++) {
        for (let x = Math.max(0, x0 - 1); x <= Math.min(width - 1, x1 + 1); x++) {
          const i = y * width + x
          if (mask[i] || !canGrow(i)) continue
          if (
            (x > 0 && mask[i - 1] === 1) ||
            (x < width - 1 && mask[i + 1] === 1) ||
            (y > 0 && mask[i - width] === 1) ||
            (y < height - 1 && mask[i + width] === 1)
          )
            grow.push(i)
        }
      }
      for (const i of grow) mask[i] = 1
      count += grow.length
      x0 = Math.max(0, x0 - 1)
      y0 = Math.max(0, y0 - 1)
      x1 = Math.min(width - 1, x1 + 1)
      y1 = Math.min(height - 1, y1 + 1)
    }
  }
  return { mask, count, bounds: { x0, y0, x1, y1 } }
}

/**
 * Builds a barrier mask from line-art RGBA: near-black, opaque pixels are walls.
 * Uses the brightest channel (composited on white) so saturated colours never count as ink.
 */
export function inkBarrier(pixels: Uint8ClampedArray, threshold = 130): Uint8Array {
  const n = pixels.length / 4
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const k = i * 4
    const a = pixels[k + 3] / 255
    if (a < 0.35) continue
    const max = Math.max(pixels[k], pixels[k + 1], pixels[k + 2]) * a + 255 * (1 - a)
    if (max < threshold) out[i] = 1
  }
  return out
}
