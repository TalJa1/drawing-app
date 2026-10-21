import { analyse, computeRegions, coverageOf } from './analysis'
import { buildScore } from '@/api/scoring'

const W = 40
const H = 30

/** A square outline (ink) from (10,8) to (30,22) */
function squareInk() {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let y = 8; y <= 22; y++)
    for (let x = 10; x <= 30; x++) {
      if (x === 10 || x === 30 || y === 8 || y === 22) px.set([20, 20, 20, 255], (y * W + x) * 4)
    }
  return px
}

function paintRect(x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number], into = new Uint8ClampedArray(W * H * 4)) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) into.set([...rgb, 255], (y * W + x) * 4)
  return into
}

describe('analysis', () => {
  const regions = computeRegions(squareInk(), W, H)

  it('finds the enclosed region inside the outline', () => {
    // interior of the square is 19 × 13
    expect(regions.insideCount).toBeGreaterThan(150)
    expect(regions.insideCount).toBeLessThan(19 * 13 + 1)
  })

  it('measures coverage and spill', () => {
    const inside = paintRect(11, 9, 29, 21, [228, 87, 46])
    expect(coverageOf(inside, regions)).toBeGreaterThan(0.95)
    const a = analyse(inside, regions, ['#e4572e'], 10)
    expect(a.spill).toBe(0)
    const messy = paintRect(0, 0, 39, 29, [228, 87, 46])
    expect(analyse(messy, regions, ['#e4572e'], 10).spill).toBeGreaterThan(0.9)
  })

  it('counts distinct hues and rewards harmony', () => {
    const p = paintRect(11, 9, 19, 21, [47, 128, 196])
    paintRect(20, 9, 29, 21, [242, 140, 40], p) // blue + orange = complementary
    const a = analyse(p, regions, ['#2f80c4', '#f28c28'], 20)
    expect(a.distinctHues).toBe(2)
    expect(a.harmony).toBeGreaterThan(0.8)
    expect(a.paletteMatch).toBeGreaterThan(0.8)
  })

  it('makes an empty canvas score low and a full one score high', () => {
    const empty = analyse(new Uint8ClampedArray(W * H * 4), regions, ['#e4572e'], 0)
    expect(buildScore('e', empty).overall).toBeLessThan(25)
    const p = paintRect(11, 9, 20, 21, [47, 128, 196])
    paintRect(21, 9, 29, 15, [242, 140, 40], p)
    paintRect(21, 16, 29, 21, [30, 60, 110], p)
    const full = analyse(p, regions, ['#2f80c4', '#f28c28', '#1e3c6e'], 40)
    expect(buildScore('f', full).overall).toBeGreaterThan(buildScore('e', empty).overall + 40)
  })

  it('treats an edge-to-edge drawing as all inside', () => {
    const r = computeRegions(null, W, H)
    expect(r.insideCount).toBe(W * H)
  })
})
