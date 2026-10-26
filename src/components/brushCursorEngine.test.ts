import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURSOR_SCALE, FALLBACK_PIGMENT, capOldest, parsePigment, pruneExpired, startBrushCursor } from './brushCursorEngine'

describe('parsePigment', () => {
  it('parses #rrggbb, #rgb and #rrggbbaa (alpha ignored)', () => {
    expect(parsePigment('#2e8b6f')).toEqual({ r: 46, g: 139, b: 111 })
    expect(parsePigment('#f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parsePigment('#0000ffcc')).toEqual({ r: 0, g: 0, b: 255 })
  })
  it('falls back to the vermilion pigment on anything else', () => {
    const fallback = parsePigment(FALLBACK_PIGMENT)
    expect(parsePigment('red;} body{display:none')).toEqual(fallback)
    expect(parsePigment('')).toEqual(fallback)
    expect(parsePigment('#12')).toEqual(fallback)
  })
})

describe('pruneExpired', () => {
  it('keeps only entries younger than ttl, preserving order, in place', () => {
    const list = [
      { bornAt: 0, id: 'old' },
      { bornAt: 900, id: 'a' },
      { bornAt: 950, id: 'b' },
    ]
    const same = list
    pruneExpired(list, 1000, 200)
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
    expect(list).toBe(same)
  })
})

describe('capOldest', () => {
  it('drops the oldest entries beyond max', () => {
    const list = [1, 2, 3, 4, 5]
    capOldest(list, 3)
    expect(list).toEqual([3, 4, 5])
    capOldest(list, 10)
    expect(list).toEqual([3, 4, 5])
  })
})

describe('CURSOR_SCALE', () => {
  it('is the testbed brush made 0.5x larger', () => {
    expect(CURSOR_SCALE).toBe(1.5)
  })
})

describe('startBrushCursor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    document.documentElement.className = ''
  })

  it('returns an inert handle and adds nothing when canvas 2D is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    expect(document.querySelectorAll('canvas')).toHaveLength(0)
    expect(() => {
      h.setColor('#00ff00')
      h.destroy()
    }).not.toThrow()
    expect(document.documentElement.classList.contains('art-cursor')).toBe(false)
  })
})
