import { floodFillMask, inkBarrier } from './floodFill'

/** Builds an RGBA buffer from a string grid: '.' = transparent, '#' = black, 'r' = red */
function grid(rows: string[]) {
  const h = rows.length
  const w = rows[0].length
  const px = new Uint8ClampedArray(w * h * 4)
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const k = (y * w + x) * 4
      if (c === '#') px.set([0, 0, 0, 255], k)
      if (c === 'r') px.set([255, 0, 0, 255], k)
      if (c === 'R') px.set([250, 6, 4, 255], k)
    }),
  )
  return { px, w, h }
}

const masked = (mask: Uint8Array, w: number) =>
  Array.from({ length: mask.length / w }, (_, y) => [...mask.slice(y * w, y * w + w)].map((v) => (v ? 'x' : '.')).join(''))

describe('floodFillMask', () => {
  it('fills an enclosed region and stops at walls', () => {
    const { px, w, h } = grid(['#####', '#...#', '#...#', '#####', '.....'])
    const r = floodFillMask(px, w, h, 2, 2, { tolerance: 0 })
    expect(r.count).toBe(6)
    expect(masked(r.mask, w)).toEqual(['.....', '.xxx.', '.xxx.', '.....', '.....'])
    expect(r.bounds).toEqual({ x0: 1, y0: 1, x1: 3, y1: 2 })
  })

  it('does not leak diagonally through corners (4-connected)', () => {
    const { px, w, h } = grid(['..#', '.#.', '#..'])
    const r = floodFillMask(px, w, h, 0, 0, { tolerance: 0 })
    expect(r.count).toBe(3)
  })

  it('respects tolerance', () => {
    const { px, w, h } = grid(['rRr', 'rRr'])
    expect(floodFillMask(px, w, h, 0, 0, { tolerance: 0 }).count).toBe(2)
    expect(floodFillMask(px, w, h, 0, 0, { tolerance: 10 }).count).toBe(6)
  })

  it('uses a separate barrier (line art) while reading colours from the paint layer', () => {
    const paint = grid(['.....', '.....', '.....'])
    const art = grid(['..#..', '..#..', '..#..'])
    const barrier = inkBarrier(art.px)
    const r = floodFillMask(paint.px, 5, 3, 0, 1, { tolerance: 0, barrier })
    expect(r.count).toBe(6)
    // with bleed the fill tucks one pixel under the line
    const b = floodFillMask(paint.px, 5, 3, 0, 1, { tolerance: 0, barrier, bleed: 1 })
    expect(b.count).toBe(9)
  })

  it('returns an empty result for out-of-bounds or barrier seeds', () => {
    const { px, w, h } = grid(['#.'])
    expect(floodFillMask(px, w, h, 5, 5, { tolerance: 0 }).count).toBe(0)
    expect(floodFillMask(px, w, h, 0, 0, { tolerance: 0, barrier: inkBarrier(px) }).count).toBe(0)
  })

  it('handles a large canvas quickly', () => {
    const w = 1200
    const h = 900
    const px = new Uint8ClampedArray(w * h * 4)
    const t = performance.now()
    const r = floodFillMask(px, w, h, 600, 450, { tolerance: 8 })
    expect(r.count).toBe(w * h)
    expect(performance.now() - t).toBeLessThan(1500)
  })
})

describe('inkBarrier', () => {
  it('marks dark opaque pixels only', () => {
    const { px } = grid(['#r.'])
    expect([...inkBarrier(px)]).toEqual([1, 0, 0])
  })
})
