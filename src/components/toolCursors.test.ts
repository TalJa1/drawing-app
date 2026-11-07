import { describe, expect, it, vi } from 'vitest'
import { CURSOR_KINDS, drawToolSprite, hasSwatch, isCursorKind, type CursorKind } from './toolCursors'

describe('cursor kinds', () => {
  it('knows its own names and nothing else', () => {
    for (const k of CURSOR_KINDS) expect(isCursorKind(k)).toBe(true)
    for (const bad of ['', 'Brush', 'rocket', 7, null, undefined]) expect(isCursorKind(bad)).toBe(false)
  })

  it('has a distinct name for every tool of the tool rail (brush covers watercolour), plus the crosshair fallback', () => {
    expect(new Set(CURSOR_KINDS).size).toBe(CURSOR_KINDS.length)
    for (const k of ['ruler', 'square', 'compass', 'crosshair'] as CursorKind[]) expect(CURSOR_KINDS, k).toContain(k)
    expect(CURSOR_KINDS.length).toBe(16)
  })

  it('shows the colour swatch only for the kinds that put ink on the page', () => {
    for (const k of [
      'pencil',
      'pen',
      'marker',
      'airbrush',
      'chalk',
      'bucket',
      'eyedropper',
      'crosshair',
      'ruler',
      'square',
      'compass',
    ] as CursorKind[])
      expect(hasSwatch(k), k).toBe(true)
    for (const k of ['eraser', 'smudge', 'hand', 'zoom', 'brush'] as CursorKind[]) expect(hasSwatch(k), k).toBe(false)
  })
})

describe('drawToolSprite', () => {
  function recorder() {
    const calls: string[] = []
    const fills: string[] = []
    const target = {
      set fillStyle(v: string) {
        fills.push(String(v))
      },
    } as Record<string, unknown>
    const ctx = new Proxy(target, {
      get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => void calls.push(`${k}(${a.length})`)),
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D
    return { ctx, calls, fills }
  }
  vi.stubGlobal('Path2D', class {})

  it('paints every kind but the brush without throwing, with its pigment on the swatch of ink kinds', () => {
    for (const k of CURSOR_KINDS.filter((x) => x !== 'brush')) {
      const { ctx, calls, fills } = recorder()
      drawToolSprite(ctx, k as Exclude<CursorKind, 'brush'>, 40, 88, { r: 10, g: 20, b: 30 }, 1.5, false)
      expect(
        calls.some((c) => c.startsWith('stroke')),
        `${k} strokes its outline`,
      ).toBe(true)
      if (hasSwatch(k)) expect(fills, `${k} shows the exact pigment`).toContain('rgb(10, 20, 30)')
      else expect(fills.join('|'), `${k} carries no pigment`).not.toContain('rgb(10, 20, 30)')
    }
  })

  it('a pressed ink tool shows a bigger swatch (the press is visible)', () => {
    const radii: number[] = []
    const mk = () => {
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, k: string) => (k === 'arc' ? (_x: number, _y: number, r: number) => radii.push(r) : (t[k] ?? (() => undefined))),
        set: (t, k: string, v) => ((t[k] = v), true),
      }) as unknown as CanvasRenderingContext2D
      return ctx
    }
    drawToolSprite(mk(), 'pencil', 0, 0, { r: 1, g: 2, b: 3 }, 1.5, false)
    drawToolSprite(mk(), 'pencil', 0, 0, { r: 1, g: 2, b: 3 }, 1.5, true)
    expect(radii[1]).toBeGreaterThan(radii[0])
  })
})
