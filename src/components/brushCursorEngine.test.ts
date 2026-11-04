import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

/*
 * What the engine does with a sprite and a pigment: the element under the pointer can ask for another sprite
 * (`data-cursor-kind`) and for its own colour (`data-cursor-color`); the sprite lives in a small canvas; the ink layer
 * costs nothing until there is ink.
 */
function fakeContext() {
  const gradient = { addColorStop: vi.fn() }
  const store: Record<string, unknown> = {}
  return new Proxy(store, {
    get: (t, k: string) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : (t[k] ?? vi.fn())),
    set: (t, k: string, v) => {
      t[k] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

const move = (target: Element | Document, x = 50, y = 60) => {
  const e = new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true })
  ;(target === document ? document.body : (target as Element)).dispatchEvent(e)
}

function mount(html: string) {
  document.body.innerHTML = html
}

describe('sprite and pigment hints', () => {
  const canvases = () => ({
    sprite: document.querySelector<HTMLCanvasElement>('canvas.art-brush-cursor')!,
    ink: document.querySelector<HTMLCanvasElement>('canvas.art-brush-ink')!,
  })
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as never)
    vi.stubGlobal('Path2D', class {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    document.documentElement.className = ''
  })

  it('draws the sprite in a small canvas of its own, not on a canvas as big as the window', () => {
    const h = startBrushCursor({ color: '#e4572e', effects: true })
    const { sprite, ink } = canvases()
    expect(sprite.style.width).toBe('128px')
    expect(sprite.style.height).toBe('128px')
    // one device pixel per css pixel here (jsdom); the sprite's backing store is that box, not the window
    expect(sprite.width * sprite.height).toBeLessThan(200 * 200)
    // the ink layer has not been given a backing store yet: it keeps the default 300x150 until there is ink
    expect(ink.width).toBe(300)
    h.destroy()
  })

  it('shows the brush, in the picker’s colour, until an element asks for something else', () => {
    mount('<main><p id="plain">hi</p></main>')
    const h = startBrushCursor({ color: '#e4572e', effects: true })
    move(document.getElementById('plain')!)
    const { sprite } = canvases()
    expect(sprite.dataset.kind).toBe('brush')
    expect(sprite.dataset.color).toBe('#e4572e')
    h.destroy()
  })

  it('switches to the sprite named by data-cursor-kind while over that element, and back after', () => {
    mount('<div id="pad" data-cursor-kind="eraser"><span id="inner">x</span></div><p id="plain">y</p>')
    const h = startBrushCursor({ color: '#e4572e', effects: true })
    const { sprite } = canvases()
    move(document.getElementById('inner')!) // a child inherits the sprite of the nearest ancestor that names one
    expect(sprite.dataset.kind).toBe('eraser')
    move(document.getElementById('plain')!)
    expect(sprite.dataset.kind).toBe('brush')
    h.destroy()
  })

  it('ignores a sprite name it does not know', () => {
    mount('<div id="pad" data-cursor-kind="rocket-launcher"></div>')
    const h = startBrushCursor({ color: '#e4572e', effects: true })
    move(document.getElementById('pad')!)
    expect(canvases().sprite.dataset.kind).toBe('brush')
    h.destroy()
  })

  it('uses the colour named by data-cursor-color while over that element', () => {
    mount('<canvas id="doodle" data-cursor-color="#2F80C4"></canvas><p id="plain">y</p>')
    const h = startBrushCursor({ color: '#e4572e', effects: true })
    const { sprite } = canvases()
    move(document.getElementById('doodle')!)
    expect(sprite.dataset.color).toBe('#2f80c4')
    move(document.getElementById('plain')!)
    expect(sprite.dataset.color).toBe('#e4572e')
    h.destroy()
  })

  it('keeps the picker’s new colour for later while a hint is in force, and shows it once the hint is gone', () => {
    mount('<canvas id="doodle" data-cursor-color="#00ff00"></canvas><p id="plain">y</p>')
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    const { sprite } = canvases()
    move(document.getElementById('doodle')!)
    h.setColor('#0000ff')
    expect(sprite.dataset.color, 'the pad still decides').toBe('#00ff00')
    move(document.getElementById('plain')!)
    expect(sprite.dataset.color).toBe('#0000ff')
    h.destroy()
  })

  it('follows the picker at once when no hint is in force', () => {
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    h.setColor('#00ff00')
    expect(canvases().sprite.dataset.color).toBe('#00ff00')
    h.destroy()
  })

  it('feed() shows the sprite for a pointer event that arrived before the engine existed', () => {
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    expect(document.documentElement.classList.contains('art-cursor')).toBe(false)
    h.feed(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }) as PointerEvent)
    expect(document.documentElement.classList.contains('art-cursor')).toBe(true)
    h.destroy()
    expect(document.documentElement.classList.contains('art-cursor')).toBe(false)
  })

  it('gives the ink layer its memory only when ink is drawn, and hides it again when the ink has dried', () => {
    vi.useFakeTimers()
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    const { ink } = canvases()
    h.feed(new MouseEvent('pointermove', { clientX: 30, clientY: 30 }) as PointerEvent)
    vi.advanceTimersByTime(100)
    expect(ink.width, 'moving the pointer alone allocates nothing').toBe(300)

    document.body.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, clientY: 30, button: 0, bubbles: true }))
    vi.advanceTimersByTime(100)
    expect(ink.width).toBeGreaterThan(300)
    expect(ink.style.display).toBe('block')

    document.body.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    vi.advanceTimersByTime(2500)
    expect(ink.style.display).toBe('none')
    h.destroy()
  })

  it('a sprite that is not in use is hidden: nothing of the cursor is left on screen without a pointer', () => {
    const h = startBrushCursor({ color: '#ff0000', effects: true })
    expect(canvases().sprite.style.visibility).toBe('hidden')
    h.destroy()
  })
})
