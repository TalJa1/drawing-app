/**
 * Calligraphic brush cursor + fast-drying watercolour stamps.
 *
 * Ported from `art_spark_custom_calligraphic_brush_cursor_testbed.html`.
 * The cursor is a canvas sprite whose bristle tip is the hotspot; it is drawn at
 * CURSOR_SCALE (1.5x the 34px testbed brush). Differences from the testbed, all
 * deliberate:
 *  - pressing leaves one bloom + one bristle stamp, but moving while pressed leaves NO ink trail
 *    (the testbed's drag stamps were removed on request);
 *  - the bristle tip never trails the pointer while pressed (DRAG_TIP_LAG = false), so
 *    the cursor has no inertia (flip the flag to get the testbed's 6.5px lag back);
 *  - frames only run while something moves or fades (the testbed redraws forever);
 *  - pointer events (mouse + pen), touch is ignored; releases outside the window and
 *    window blur never leave the brush "stuck down";
 *  - stamps are capped, polygon shapes are pooled, spawn rates are frame-rate independent;
 *  - the native cursor is hidden only once the sprite is visible, and restored on destroy;
 *  - the sprite lives in a small canvas (SPRITE_BOX) that is moved with a CSS transform, and it is repainted only when
 *    its look changes (tool, colour, press, hover): moving the pointer costs a style change, not a 5-megapixel repaint;
 *  - the ink layer is allocated on first use, cleared and redrawn only inside the area its marks cover;
 *  - the sprite follows the tool: an element can ask for another sprite with `data-cursor-kind` and for a pigment with
 *    `data-cursor-color` (the drawing canvas names its tool, the home page's doodle pad names the colour its next stroke gets).
 */

import { createSpriteStore, rasterizeSprite, type SpriteStoreOptions } from './spriteStore'
import { drawToolSprite, isCursorKind, type CursorKind } from './toolCursors'
import { SPRITE_HOTSPOT, SPRITE_SCALE, SPRITE_VIEW, isSpriteKind, type SpriteState } from './toolSprites'

interface Rgb {
  r: number
  g: number
  b: number
}
interface Vert {
  cos: number
  sin: number
}
interface Dab {
  x: number
  y: number
  rx: number
  ry: number
  angle: number
  verts: Vert[]
  rgb: Rgb
  bornAt: number
}
interface Droplet {
  dx: number
  dy: number
  r: number
  stretch: number
  angle: number
}
interface Bloom {
  x: number
  y: number
  maxRadius: number
  rgb: Rgb
  verts: Vert[]
  droplets: Droplet[]
  bornAt: number
  rotation: number
}
interface Bristle {
  offsetPerp: number
  offsetAlong: number
  rx: number
  ry: number
  alphaBoost: number
}
interface Stamp {
  x: number
  y: number
  angle: number
  brushWidth: number
  brushLength: number
  bristles: Bristle[]
  verts: Vert[]
  rgb: Rgb
  bornAt: number
}

export interface BrushCursorOptions {
  /** Pigment colour, `#rgb` / `#rrggbb` / `#rrggbbaa`. */
  color: string
  /** false = sprite only: no watercolour effects, no sprite animation (reduced motion). */
  effects: boolean
  /** CSS selector; ink effects are not spawned when the pointer is over a match. Default: none. */
  noInkSelector?: string
  /** Renders a tool picture (SVG) into a canvas. Default: the browser's own; tests hand in a stand-in. */
  loadSprite?: SpriteStoreOptions['load']
}

export interface BrushCursorHandle {
  setColor: (hex: string) => void
  /** Hands the engine a pointer event it missed (the one that made the caller start it): shows the sprite at once. */
  feed: (e: PointerEvent) => void
  destroy: () => void
}

/** The testbed brush is 34px long; the app uses it 0.5x larger. */
export const CURSOR_SCALE = 1.5
export const FALLBACK_PIGMENT = '#D8573A'

const HOVER_DAB_MS = 350
const CLICK_BLOOM_MS = 700
const DRAG_STAMP_MS = 800
const FIXED_HANDLE_ANGLE = (-42 * Math.PI) / 180
/** Testbed behaviour: while pressed the bristle tip lags up to 6.5px behind the pointer. */
const DRAG_TIP_LAG = false
const MAX_BEND_LAG = 6.5
const MAX_DABS = 120
const MAX_BLOOMS = 80
const MAX_STAMPS = 40
/** Side of the sprite's own canvas in CSS px; the longest sprite (the brush at 1.5x, with its ripple) reaches ~60px. */
const SPRITE_BOX = 128
/** Where the hotspot sits inside that box: most sprites extend up and to the right of it. */
const TIP = { x: 40, y: 88 }
/** The watercolour marks are soft and short-lived, so they do not need the full density of a retina screen. */
const INK_MAX_DPR = 1.5
const HINT_SELECTOR = '[data-cursor-kind],[data-cursor-color]'
const Z_INK = 9998
const Z_CURSOR = 9999
const INTERACTIVE =
  'a[href],button,[role="button"],[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="option"],[role="combobox"],summary,label,select,input,textarea,[data-cursor-interactive]'

// ---------- pure helpers (exported for tests) ----------

/** Which picture of a tool to show: pressed, lifting on the rebound after the release, or floating over the paper. */
export function spriteStateOf(s: { isDown: boolean; elevation: number }): SpriteState {
  if (s.isDown) return 'down'
  return s.elevation < 0.98 ? 'up' : 'idle'
}

/** Parses `#rgb`, `#rrggbb` or `#rrggbbaa`; anything else yields the fallback pigment. */
export function parsePigment(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim())
  if (!m) return parsePigment(FALLBACK_PIGMENT)
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h.slice(0, 6), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Removes entries older than `ttl` ms in place (single pass, order kept). */
export function pruneExpired(list: { bornAt: number }[], now: number, ttl: number): void {
  let w = 0
  for (let i = 0; i < list.length; i++) {
    if (now - list[i].bornAt < ttl) list[w++] = list[i]
  }
  list.length = w
}

/** Drops the oldest entries so that at most `max` remain. */
export function capOldest<T>(list: T[], max: number): void {
  if (list.length > max) list.splice(0, list.length - max)
}

function rgba(c: Rgb, a: number): string {
  const s = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${s.toFixed(3)})`
}
function darken(c: Rgb, f: number): Rgb {
  return { r: Math.round(c.r * f), g: Math.round(c.g * f), b: Math.round(c.b * f) }
}
function lighten(c: Rgb, m: number): Rgb {
  return {
    r: Math.min(255, Math.round(c.r + (255 - c.r) * m)),
    g: Math.min(255, Math.round(c.g + (255 - c.g) * m)),
    b: Math.min(255, Math.round(c.b + (255 - c.b) * m)),
  }
}

function polygonTemplate(vertexCount: number, irregularity: number): Vert[] {
  const p1 = Math.random() * Math.PI * 2
  const p2 = Math.random() * Math.PI * 2
  const verts: Vert[] = []
  for (let i = 0; i < vertexCount; i++) {
    const t = (i / vertexCount) * Math.PI * 2
    const f = 1 + irregularity * Math.sin(t * 3 + p1) + irregularity * 0.65 * Math.cos(t * 5 + p2)
    verts.push({ cos: Math.cos(t) * f, sin: Math.sin(t) * f })
  }
  return verts
}
const pool = (n: number, vertexCount: number, irregularity: number) =>
  Array.from({ length: n }, () => polygonTemplate(vertexCount, irregularity))
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

// ---------- engine ----------

export function startBrushCursor(opts: BrushCursorOptions): BrushCursorHandle {
  const noop: BrushCursorHandle = { setColor: () => {}, feed: () => {}, destroy: () => {} }
  if (typeof document === 'undefined') return noop

  const inkCanvas = document.createElement('canvas')
  const cursorCanvas = document.createElement('canvas')
  const ink = inkCanvas.getContext('2d')
  const cur = cursorCanvas.getContext('2d')
  if (!ink || !cur) return noop

  const effects = opts.effects
  const root = document.documentElement

  for (const [c, cls, z] of [
    [inkCanvas, 'art-brush-ink', Z_INK],
    [cursorCanvas, 'art-brush-cursor', Z_CURSOR],
  ] as const) {
    c.className = cls
    c.setAttribute('aria-hidden', 'true')
    Object.assign(c.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: String(z),
    })
  }
  Object.assign(inkCanvas.style, { inset: '0', width: '100vw', height: '100vh', display: 'none' })
  Object.assign(cursorCanvas.style, {
    left: '0',
    top: '0',
    width: `${SPRITE_BOX}px`,
    height: `${SPRITE_BOX}px`,
    willChange: 'transform',
    visibility: 'hidden',
  })
  document.body.append(inkCanvas, cursorCanvas)

  // the tool pictures: rendered one at a time, off to the side, then only blitted (nothing is created before a tool asks)
  const sprites = createSpriteStore({
    load: opts.loadSprite ?? rasterizeSprite,
    onReady: () => {
      if (destroyed) return
      lastKey = '' // a stand-in was on screen: paint the real picture
      dirty = true
      schedule()
    },
  })

  const dabShapes = pool(24, 14, 0.18)
  const bloomShapes = pool(12, 28, 0.16)
  const stampShapes = pool(24, 16, 0.14)

  let width = window.innerWidth
  let height = window.innerHeight
  let dprCur = 1
  /** The ink layer is only allocated (and later only resized) once there is ink to draw. */
  let inkAllocated = false
  function sizeInk() {
    const dprInk = Math.min(window.devicePixelRatio || 1, INK_MAX_DPR)
    inkCanvas.width = Math.round(width * dprInk)
    inkCanvas.height = Math.round(height * dprInk)
    ink!.setTransform(dprInk, 0, 0, dprInk, 0, 0)
    inkBox = null
  }
  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    dprCur = Math.min(window.devicePixelRatio || 1, 2.5)
    cursorCanvas.width = Math.round(SPRITE_BOX * dprCur)
    cursorCanvas.height = Math.round(SPRITE_BOX * dprCur)
    cur!.setTransform(dprCur, 0, 0, dprCur, 0, 0)
    lastKey = ''
    placedAt = { x: NaN, y: NaN }
    if (inkAllocated) sizeInk()
    dirty = true
    schedule()
  }

  const b = {
    mouseX: 0,
    mouseY: 0,
    tipX: 0,
    tipY: 0,
    lastHoverDabX: 0,
    lastHoverDabY: 0,
    isDown: false,
    isHoveringUI: false,
    pressStartTime: 0,
    elevation: 1,
    targetElevation: 1,
    pressure: 0,
    targetPressure: 0,
    splayPop: 0,
    strokeAngle: FIXED_HANDLE_ANGLE,
    bendDist: 0,
    /** the pigment of the page's colour picker; `rgb` is the one in use (a `data-cursor-color` hint can override it) */
    baseRgb: parsePigment(opts.color),
    rgb: parsePigment(opts.color),
    kind: 'brush' as CursorKind,
    dipRipple: 0,
  }
  const dabs: Dab[] = []
  const blooms: Bloom[] = []
  const stamps: Stamp[] = []

  let visible = false
  let dirty = false
  let inkVisible = false
  let destroyed = false
  let raf = 0
  let lastFrame = 0
  let spriteShown = false
  /** true while the element under the pointer asks for its own pigment (`data-cursor-color`) */
  let hinted = false
  let lastKey = ''
  let placedAt = { x: NaN, y: NaN }
  /** the area the ink marks covered at the last frame (CSS px), so only that is cleared */
  let inkBox: { x0: number; y0: number; x1: number; y1: number } | null = null
  /** false while the pointer is over a `noInkSelector` area (e.g. the drawing canvas) */
  let inkOk = true

  // ----- spawning -----
  function spawnDab(x: number, y: number, vx: number, vy: number, speed: number) {
    const rx = Math.max(2.2, Math.min(5.2, 3.2 + speed * 0.06))
    dabs.push({
      x: x + (Math.random() - 0.5) * 1.8,
      y: y + (Math.random() - 0.5) * 1.8,
      rx,
      ry: Math.max(1.4, rx * 0.58),
      angle: Math.atan2(vy, vx) + (Math.random() - 0.5) * 0.35,
      verts: pick(dabShapes),
      rgb: b.rgb,
      bornAt: performance.now(),
    })
    capOldest(dabs, MAX_DABS)
  }

  function spawnBloom(x: number, y: number, baseRadius: number, withSpatter: boolean) {
    if (!effects) return
    const droplets: Droplet[] = []
    if (withSpatter) {
      const count = 3 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2
        const dist = baseRadius * (1.1 + Math.random() * 1.1)
        droplets.push({
          dx: Math.cos(ang) * dist,
          dy: Math.sin(ang) * dist,
          r: 0.8 + Math.random() * 1.6,
          stretch: 1.1 + Math.random() * 0.5,
          angle: ang,
        })
      }
    }
    blooms.push({
      x,
      y,
      maxRadius: baseRadius * (1.2 + Math.random() * 0.25),
      rgb: b.rgb,
      verts: pick(bloomShapes),
      droplets,
      bornAt: performance.now(),
      rotation: Math.random() * Math.PI * 2,
    })
    capOldest(blooms, MAX_BLOOMS)
  }

  function spawnStamp(x: number, y: number, angle: number, pressure: number) {
    if (!effects) return
    const brushWidth = Math.max(3.6, 10.5 * pressure * 1.08)
    const brushLength = Math.max(3.0, brushWidth * 0.75)
    const bristles: Bristle[] = []
    const count = 5
    for (let i = 0; i < count; i++) {
      const norm = (i / (count - 1)) * 2 - 1
      bristles.push({
        offsetPerp: norm * brushWidth * 0.44 + (Math.random() - 0.5) * 0.6,
        offsetAlong: -Math.abs(norm) * 1.4 + (Math.random() - 0.5) * 0.8,
        rx: brushLength * (0.55 - Math.abs(norm) * 0.15),
        ry: (brushWidth / count) * (0.95 + Math.random() * 0.35),
        alphaBoost: 1 - Math.abs(norm) * 0.3,
      })
    }
    stamps.push({
      x,
      y,
      angle,
      brushWidth,
      brushLength,
      bristles,
      verts: pick(stampShapes),
      rgb: b.rgb,
      bornAt: performance.now(),
    })
    capOldest(stamps, MAX_STAMPS)
  }

  // ----- input -----
  const noInk = opts.noInkSelector
  function inkAllowed(target: EventTarget | null): boolean {
    return !noInk || !(target instanceof Element) || target.closest(noInk) === null
  }

  const hex2 = (n: number) => n.toString(16).padStart(2, '0')
  /** Takes the sprite and pigment that the element under the pointer asks for (default: the brush, the picker's colour). */
  function readHints(t: EventTarget | null) {
    let kind: CursorKind = 'brush'
    let colour: string | null = null
    const el = t instanceof Element ? t.closest(HINT_SELECTOR) : null
    if (el) {
      const k = el.getAttribute('data-cursor-kind')
      if (isCursorKind(k)) kind = k
      colour = el.getAttribute('data-cursor-color')
    }
    if (kind !== b.kind) {
      b.kind = kind
      cursorCanvas.dataset.kind = kind
    }
    hinted = colour !== null
    const next = colour ? parsePigment(colour) : b.baseRgb
    if (next.r !== b.rgb.r || next.g !== b.rgb.g || next.b !== b.rgb.b) {
      b.rgb = next
      cursorCanvas.dataset.color = `#${hex2(next.r)}${hex2(next.g)}${hex2(next.b)}`
    }
  }

  function show(x: number, y: number) {
    visible = true
    b.mouseX = b.tipX = b.lastHoverDabX = x
    b.mouseY = b.tipY = b.lastHoverDabY = y
    root.classList.add('art-cursor')
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    const wasVisible = visible
    if (!wasVisible) show(e.clientX, e.clientY)
    const px = b.mouseX
    const py = b.mouseY
    b.mouseX = e.clientX
    b.mouseY = e.clientY
    if (b.isDown && e.buttons === 0) release() // button released outside the window
    const t = e.target
    inkOk = inkAllowed(t)
    readHints(t)
    b.isHoveringUI = t instanceof Element && t.closest(INTERACTIVE) !== null
    if (effects && !b.isDown && !b.isHoveringUI && wasVisible && inkOk) {
      const speed = Math.hypot(b.mouseX - px, b.mouseY - py)
      const away = Math.hypot(b.mouseX - b.lastHoverDabX, b.mouseY - b.lastHoverDabY)
      if (away > 13 + Math.min(10, speed * 0.35)) {
        spawnDab(b.mouseX, b.mouseY, b.mouseX - px, b.mouseY - py, speed)
        b.lastHoverDabX = b.mouseX
        b.lastHoverDabY = b.mouseY
      }
    }
    dirty = true
    schedule()
  }

  function onDown(e: PointerEvent) {
    if (e.pointerType === 'touch' || e.button !== 0) return
    if (!visible) show(e.clientX, e.clientY)
    b.mouseX = e.clientX
    b.mouseY = e.clientY
    if (!DRAG_TIP_LAG) {
      b.tipX = e.clientX
      b.tipY = e.clientY
    }
    b.isDown = true
    b.pressStartTime = performance.now()
    b.targetElevation = 0
    b.targetPressure = 0.9
    b.splayPop = 1
    if (!effects) {
      b.elevation = 0
      b.pressure = 0.9
    }
    inkOk = inkAllowed(e.target)
    readHints(e.target)
    if (effects && inkOk) {
      spawnBloom(b.tipX, b.tipY, 10 + Math.random() * 3.5, true)
      spawnStamp(b.tipX, b.tipY, b.strokeAngle, 0.88)
    }
    dirty = true
    schedule()
  }

  function release() {
    if (!b.isDown) return
    b.isDown = false
    b.targetElevation = 1
    b.targetPressure = 0
    if (!effects) {
      b.elevation = 1
      b.pressure = 0
    }
    dirty = true
    schedule()
  }

  function onOut(e: PointerEvent) {
    if (e.relatedTarget) return // still inside the page
    visible = false
    dirty = true
    schedule()
  }
  const onBlur = () => release()
  const onVisibility = () => {
    if (document.hidden) release()
  }

  window.addEventListener('pointermove', onMove, { passive: true, capture: true })
  window.addEventListener('pointerdown', onDown, { passive: true, capture: true })
  window.addEventListener('pointerup', release, { capture: true })
  window.addEventListener('pointercancel', release, { capture: true })
  window.addEventListener('pointerout', onOut, { passive: true })
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVisibility)

  // ----- simulation -----
  function update(now: number, dt: number) {
    const prevTipX = b.tipX
    const prevTipY = b.tipY

    if (!b.isDown) {
      b.tipX = b.mouseX
      b.tipY = b.mouseY
      b.bendDist = 0
    } else if (!DRAG_TIP_LAG) {
      b.tipX = b.mouseX
      b.tipY = b.mouseY
      b.bendDist = 0
    } else {
      const dx = b.mouseX - b.tipX
      const dy = b.mouseY - b.tipY
      const d = Math.hypot(dx, dy)
      if (d > MAX_BEND_LAG && d > 0.001) {
        const pull = (d - MAX_BEND_LAG) / d
        b.tipX += dx * pull * 0.88
        b.tipY += dy * pull * 0.88
      }
      b.tipX += (b.mouseX - b.tipX) * 0.38 * dt
      b.tipY += (b.mouseY - b.tipY) * 0.38 * dt
      b.bendDist = Math.hypot(b.mouseX - b.tipX, b.mouseY - b.tipY)
      if (b.bendDist > 0.4) {
        const target = Math.atan2(b.mouseY - b.tipY, b.mouseX - b.tipX)
        const diff = Math.atan2(Math.sin(target - b.strokeAngle), Math.cos(target - b.strokeAngle))
        b.strokeAngle += diff * 0.42
      }
    }

    if (b.isDown && effects) {
      // holding still: a slow capillary bleed. Moving while pressed leaves no ink.
      const moved = Math.hypot(b.tipX - prevTipX, b.tipY - prevTipY)
      if (inkOk && moved <= 0.6 && now - b.pressStartTime > 120 && Math.random() < 1 - Math.pow(0.82, dt)) {
        spawnBloom(b.tipX + (Math.random() - 0.5) * 2.2, b.tipY + (Math.random() - 0.5) * 2.2, 7.5, false)
      }
    }

    if (effects) {
      b.elevation += (b.targetElevation - b.elevation) * Math.min(1, 0.34 * dt)
      b.pressure += (b.targetPressure - b.pressure) * Math.min(1, 0.32 * dt)
      if (Math.abs(b.targetElevation - b.elevation) < 0.004) b.elevation = b.targetElevation
      if (Math.abs(b.targetPressure - b.pressure) < 0.004) b.pressure = b.targetPressure
      b.splayPop *= Math.pow(0.82, dt)
      if (b.splayPop < 0.01) b.splayPop = 0
      b.dipRipple = b.dipRipple > 0.01 ? b.dipRipple * Math.pow(0.86, dt) : 0
    }
  }

  // ----- rendering: ink layer -----
  /** A box (CSS px, 2px margin) that holds every mark: the largest a dab, bloom (with its droplets) or stamp can reach. */
  function inkExtent() {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    const grow = (x: number, y: number, r: number) => {
      x0 = Math.min(x0, x - r)
      y0 = Math.min(y0, y - r)
      x1 = Math.max(x1, x + r)
      y1 = Math.max(y1, y + r)
    }
    for (const d of dabs) grow(d.x, d.y, d.rx * 1.6 + 2)
    for (const m of blooms) grow(m.x, m.y, m.maxRadius * 1.9 + 6)
    for (const st of stamps) grow(st.x, st.y, st.brushLength + st.brushWidth + 4)
    return {
      x0: Math.max(0, Math.floor(x0) - 2),
      y0: Math.max(0, Math.floor(y0) - 2),
      x1: Math.min(width, Math.ceil(x1) + 2),
      y1: Math.min(height, Math.ceil(y1) + 2),
    }
  }

  function renderInk(now: number) {
    pruneExpired(dabs, now, HOVER_DAB_MS)
    pruneExpired(blooms, now, CLICK_BLOOM_MS)
    pruneExpired(stamps, now, DRAG_STAMP_MS)
    const any = dabs.length + blooms.length + stamps.length > 0
    if (!any) {
      if (inkVisible) {
        if (inkBox) ink!.clearRect(inkBox.x0, inkBox.y0, inkBox.x1 - inkBox.x0, inkBox.y1 - inkBox.y0)
        inkBox = null
        inkCanvas.style.display = 'none'
        inkVisible = false
      }
      return
    }
    if (!inkAllocated) {
      sizeInk()
      inkAllocated = true
    }
    if (!inkVisible) {
      inkCanvas.style.display = 'block'
      inkVisible = true
    }
    // clear only where marks were and where they are now: the layer is a whole screen, the marks are a few dozen px
    const box = inkExtent()
    const wipe = inkBox
      ? {
          x0: Math.min(inkBox.x0, box.x0),
          y0: Math.min(inkBox.y0, box.y0),
          x1: Math.max(inkBox.x1, box.x1),
          y1: Math.max(inkBox.y1, box.y1),
        }
      : box
    ink!.clearRect(wipe.x0, wipe.y0, wipe.x1 - wipe.x0, wipe.y1 - wipe.y0)
    inkBox = box

    for (const dab of dabs) {
      const p = Math.min(1, (now - dab.bornAt) / HOVER_DAB_MS)
      const alpha = (1 - p) * (1 - p) * 0.28
      const scale = 0.85 + p * 0.35
      ink!.save()
      ink!.translate(dab.x, dab.y)
      ink!.rotate(dab.angle)
      ink!.beginPath()
      dab.verts.forEach((v, k) => {
        const x = v.cos * dab.rx * scale
        const y = v.sin * dab.ry * scale
        if (k === 0) ink!.moveTo(x, y)
        else ink!.lineTo(x, y)
      })
      ink!.closePath()
      ink!.fillStyle = rgba(dab.rgb, alpha)
      ink!.fill()
      ink!.restore()
    }

    for (const bloom of blooms) {
      const age = now - bloom.bornAt
      const p = Math.min(1, age / CLICK_BLOOM_MS)
      const ease = 1 - Math.pow(1 - Math.min(1, age / 240), 3)
      const r = Math.max(0.5, bloom.maxRadius * (0.35 + 0.65 * ease))
      const alpha = (1 - Math.pow(p, 1.4)) * 0.54
      ink!.save()
      ink!.translate(bloom.x, bloom.y)
      ink!.rotate(bloom.rotation)
      ink!.beginPath()
      bloom.verts.forEach((v, k) => {
        if (k === 0) ink!.moveTo(v.cos * r, v.sin * r)
        else ink!.lineTo(v.cos * r, v.sin * r)
      })
      ink!.closePath()
      const edge = darken(bloom.rgb, 0.72)
      const grad = ink!.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.15)
      grad.addColorStop(0, rgba(bloom.rgb, alpha * 0.85))
      grad.addColorStop(0.7, rgba(bloom.rgb, alpha * 0.5))
      grad.addColorStop(0.95, rgba(edge, alpha * 0.9))
      grad.addColorStop(1, rgba(edge, 0))
      ink!.fillStyle = grad
      ink!.fill()
      for (const d of bloom.droplets) {
        ink!.save()
        ink!.translate(d.dx * ease, d.dy * ease)
        ink!.rotate(d.angle)
        ink!.fillStyle = rgba(edge, alpha * 0.75)
        ink!.beginPath()
        ink!.ellipse(0, 0, d.r * d.stretch, d.r, 0, 0, Math.PI * 2)
        ink!.fill()
        ink!.restore()
      }
      ink!.restore()
    }

    for (const s of stamps) {
      const p = Math.min(1, (now - s.bornAt) / DRAG_STAMP_MS)
      const alpha = (1 - Math.pow(p, 1.5)) * 0.34
      const dark = darken(s.rgb, 0.78)
      ink!.save()
      ink!.translate(s.x, s.y)
      ink!.rotate(s.angle)
      ink!.beginPath()
      s.verts.forEach((v, k) => {
        const x = v.cos * s.brushLength * 0.65
        const y = v.sin * s.brushWidth * 0.52
        if (k === 0) ink!.moveTo(x, y)
        else ink!.lineTo(x, y)
      })
      ink!.closePath()
      ink!.fillStyle = rgba(s.rgb, alpha * 0.55)
      ink!.fill()
      for (const br of s.bristles) {
        ink!.fillStyle = rgba(dark, alpha * br.alphaBoost)
        ink!.beginPath()
        ink!.ellipse(br.offsetAlong, br.offsetPerp, br.rx, br.ry, 0, 0, Math.PI * 2)
        ink!.fill()
      }
      ink!.restore()
    }
  }

  // ----- rendering: sprite (hotspot = bristle tip) -----
  /** The sprite's look as one string: it is repainted only when this changes, not on every pointer move. */
  function spriteKey() {
    return [
      b.kind,
      b.rgb.r,
      b.rgb.g,
      b.rgb.b,
      b.isDown ? 1 : 0,
      b.isHoveringUI ? 1 : 0,
      b.elevation.toFixed(3),
      b.pressure.toFixed(3),
      b.splayPop.toFixed(3),
      b.dipRipple.toFixed(3),
      b.bendDist.toFixed(2),
      b.strokeAngle.toFixed(3),
    ].join('|')
  }

  function renderSprite() {
    if (!visible) {
      if (spriteShown) {
        cursorCanvas.style.visibility = 'hidden'
        spriteShown = false
      }
      return
    }
    // the whole canvas moves, rounded to a device pixel so the sprite stays sharp
    const px = Math.round((b.tipX - TIP.x) * dprCur) / dprCur
    const py = Math.round((b.tipY - TIP.y) * dprCur) / dprCur
    if (px !== placedAt.x || py !== placedAt.y) {
      cursorCanvas.style.transform = `translate3d(${px}px, ${py}px, 0)`
      placedAt = { x: px, y: py }
    }
    if (!spriteShown) {
      cursorCanvas.style.visibility = 'visible'
      spriteShown = true
    }
    const key = spriteKey()
    if (key === lastKey) return
    lastKey = key
    cur!.clearRect(0, 0, SPRITE_BOX, SPRITE_BOX)
    paintSprite()
  }

  /** `data-look` says what the sprite shows: the engine's brush, a tool's picture, or the icon standing in for it. */
  function setLook(look: 'brush' | 'picture' | 'icon') {
    if (cursorCanvas.dataset.look !== look) cursorCanvas.dataset.look = look
  }

  function paintSprite() {
    const tipX = TIP.x
    const tipY = TIP.y
    // the pointer is where the tip is, except while DRAG_TIP_LAG pulls the tip behind it
    const mouseX = tipX + (b.mouseX - b.tipX)
    const mouseY = tipY + (b.mouseY - b.tipY)
    const elev = b.elevation

    if (b.dipRipple > 0.02) {
      cur!.save()
      cur!.translate(tipX, tipY)
      cur!.scale(CURSOR_SCALE, CURSOR_SCALE)
      cur!.beginPath()
      cur!.arc(0, 0, (1 - b.dipRipple) * 14 + 2, 0, Math.PI * 2)
      cur!.strokeStyle = rgba(b.rgb, b.dipRipple * 0.85)
      cur!.lineWidth = 1.5
      cur!.stroke()
      cur!.restore()
    }

    if (b.kind !== 'brush') {
      const kind = b.kind
      const picture = isSpriteKind(kind) ? sprites.get(kind, spriteStateOf(b), b.rgb, dprCur) : null
      setLook(picture ? 'picture' : 'icon')
      if (picture && isSpriteKind(kind)) {
        // the picture's tip goes on the hotspot; snapped to a device pixel so the blit stays sharp
        const [hx, hy] = SPRITE_HOTSPOT[kind]
        const x = Math.round((tipX - (hx - SPRITE_VIEW[0]) * SPRITE_SCALE) * dprCur) / dprCur
        const y = Math.round((tipY - (hy - SPRITE_VIEW[1]) * SPRITE_SCALE) * dprCur) / dprCur
        // 1:1 with the device pixels it was rendered in, so the blit does not resample
        cur!.drawImage(picture, x, y, picture.width / dprCur, picture.height / dprCur)
      } else {
        // until the picture is ready (or when it cannot be rendered) the icon stands in
        drawToolSprite(cur!, kind, tipX, tipY, b.rgb, CURSOR_SCALE, b.isDown)
      }
      return
    }

    setLook('brush')
    const handleAngle = FIXED_HANDLE_ANGLE + (1 - elev) * 0.09
    const bristleLen = 9.5 - (1 - elev) * 1.4
    const fx = mouseX + Math.cos(handleAngle) * bristleLen
    const fy = mouseY + Math.sin(handleAngle) * bristleLen

    cur!.save()
    // scale the whole sprite about the hotspot so the tip stays exactly under the pointer
    cur!.translate(tipX, tipY)
    cur!.scale(CURSOR_SCALE, CURSOR_SCALE)
    cur!.translate(-tipX, -tipY)

    if (b.isHoveringUI && !b.isDown) {
      cur!.beginPath()
      cur!.arc(tipX, tipY, 6.5, 0, Math.PI * 2)
      cur!.strokeStyle = rgba(b.rgb, 0.6)
      cur!.lineWidth = 1.1
      cur!.stroke()
    }

    const shX = 1.5 + elev * 3.8
    const shY = 2.0 + elev * 4.5
    cur!.save()
    cur!.beginPath()
    cur!.moveTo(tipX + shX * 0.3, tipY + shY * 0.3)
    cur!.quadraticCurveTo(fx + shX * 0.7, fy + shY * 0.7, fx + Math.cos(handleAngle) * 24.5 + shX, fy + Math.sin(handleAngle) * 24.5 + shY)
    cur!.strokeStyle = `rgba(28, 22, 16, ${(0.22 - elev * 0.07).toFixed(3)})`
    cur!.lineWidth = 3.6 + elev * 1.6
    cur!.lineCap = 'round'
    cur!.stroke()
    cur!.restore()

    if (b.isDown) {
      const puddleR = 2.6 + b.pressure * 2.4
      const g = cur!.createRadialGradient(tipX, tipY, 0.2, tipX, tipY, puddleR * 1.35)
      g.addColorStop(0, rgba(darken(b.rgb, 0.72), 0.82))
      g.addColorStop(0.65, rgba(b.rgb, 0.45))
      g.addColorStop(1, rgba(b.rgb, 0))
      cur!.fillStyle = g
      cur!.beginPath()
      cur!.ellipse(tipX, tipY, puddleR * (1 + Math.min(0.45, b.bendDist * 0.08)), puddleR * 0.82, b.strokeAngle, 0, Math.PI * 2)
      cur!.fill()
    }

    // bristle tuft: ferrule -> belly -> tip
    const axis = Math.atan2(tipY - fy, tipX - fx)
    const perpX = -Math.sin(axis)
    const perpY = Math.cos(axis)
    const ferruleR = 2.35
    const belly = 2.6 + (b.isDown ? b.pressure * 2.4 + b.splayPop * 1.4 : 0)
    const tipSplay = b.isDown ? b.pressure * 1.45 + b.splayPop * 0.9 : 0.25
    const midX = (fx + tipX) * 0.5 + (mouseX - tipX) * 0.28
    const midY = (fy + tipY) * 0.5 + (mouseY - tipY) * 0.28

    cur!.beginPath()
    cur!.moveTo(fx + perpX * ferruleR, fy + perpY * ferruleR)
    cur!.quadraticCurveTo(midX + perpX * belly, midY + perpY * belly, tipX + perpX * tipSplay, tipY + perpY * tipSplay)
    cur!.quadraticCurveTo(tipX, tipY, tipX - perpX * tipSplay, tipY - perpY * tipSplay)
    cur!.quadraticCurveTo(midX - perpX * belly, midY - perpY * belly, fx - perpX * ferruleR, fy - perpY * ferruleR)
    cur!.closePath()
    const bg = cur!.createLinearGradient(fx, fy, tipX, tipY)
    bg.addColorStop(0, '#E5DAC6')
    bg.addColorStop(0.38, '#EFE6D5')
    bg.addColorStop(0.68, rgba(lighten(b.rgb, 0.1), 0.98))
    bg.addColorStop(1, rgba(b.rgb, 1))
    cur!.fillStyle = bg
    cur!.fill()
    cur!.strokeStyle = 'rgba(28, 22, 17, 0.55)'
    cur!.lineWidth = 0.65
    cur!.stroke()

    if (b.isDown || b.pressure > 0.15) {
      for (let h = -1; h <= 1; h++) {
        const t = h * 0.55
        cur!.beginPath()
        cur!.moveTo(fx + perpX * ferruleR * t, fy + perpY * ferruleR * t)
        cur!.quadraticCurveTo(
          midX + perpX * belly * t,
          midY + perpY * belly * t,
          tipX + perpX * tipSplay * 1.15 * t,
          tipY + perpY * tipSplay * 1.15 * t,
        )
        cur!.strokeStyle = rgba(darken(b.rgb, 0.55), 0.5)
        cur!.lineWidth = 0.55
        cur!.stroke()
      }
    }

    // brass ferrule + walnut handle (drawn along handleAngle from the ferrule base)
    cur!.save()
    cur!.translate(fx, fy)
    cur!.rotate(handleAngle)

    const fg = cur!.createLinearGradient(0, -2.8, 0, 2.8)
    fg.addColorStop(0, '#9E782F')
    fg.addColorStop(0.32, '#F7DF9C')
    fg.addColorStop(0.6, '#D4A84F')
    fg.addColorStop(1, '#6E5019')
    cur!.fillStyle = fg
    cur!.beginPath()
    cur!.moveTo(0, -2.4)
    cur!.lineTo(5.5, -2.75)
    cur!.lineTo(5.5, 2.75)
    cur!.lineTo(0, 2.4)
    cur!.closePath()
    cur!.fill()
    cur!.strokeStyle = '#2B1F0E'
    cur!.lineWidth = 0.65
    cur!.stroke()

    cur!.fillStyle = '#D8573A'
    cur!.fillRect(3.6, -2.65, 1.1, 5.3)

    const hg = cur!.createLinearGradient(5.5, -3, 5.5, 3)
    hg.addColorStop(0, '#3D2B22')
    hg.addColorStop(0.3, '#6B4D3E')
    hg.addColorStop(0.65, '#2A1D17')
    hg.addColorStop(1, '#140E0B')
    cur!.fillStyle = hg
    cur!.beginPath()
    cur!.moveTo(5.5, -2.75)
    cur!.bezierCurveTo(12, -2.95, 18.5, -2.1, 23.8, -0.95)
    cur!.arc(23.8, 0, 0.95, -Math.PI / 2, Math.PI / 2)
    cur!.bezierCurveTo(18.5, 2.1, 12, 2.95, 5.5, 2.75)
    cur!.closePath()
    cur!.fill()
    cur!.strokeStyle = '#120C09'
    cur!.lineWidth = 0.65
    cur!.stroke()

    cur!.fillStyle = '#E0A33E'
    cur!.beginPath()
    cur!.moveTo(20, -1.45)
    cur!.quadraticCurveTo(22.2, -1.15, 23.8, -0.95)
    cur!.arc(23.8, 0, 0.95, -Math.PI / 2, Math.PI / 2)
    cur!.quadraticCurveTo(22.2, 1.15, 20, 1.45)
    cur!.closePath()
    cur!.fill()

    cur!.beginPath()
    cur!.moveTo(6.8, -1.15)
    cur!.lineTo(19.2, -0.65)
    cur!.strokeStyle = 'rgba(255, 246, 232, 0.28)'
    cur!.lineWidth = 0.7
    cur!.lineCap = 'round'
    cur!.stroke()

    cur!.restore()
    cur!.restore()
  }

  // ----- loop (runs only while something changes) -----
  function animating(): boolean {
    return (
      b.isDown ||
      dirty ||
      dabs.length + blooms.length + stamps.length > 0 ||
      b.elevation !== b.targetElevation ||
      b.pressure !== b.targetPressure ||
      b.splayPop > 0 ||
      b.dipRipple > 0
    )
  }

  function frame(ts: number) {
    raf = 0
    if (destroyed) return
    const now = Number.isFinite(ts) ? ts : performance.now()
    const dt = lastFrame ? Math.max(0.05, Math.min(1.92, (now - lastFrame) / 16.667)) : 1
    lastFrame = now
    if (visible) update(now, dt)
    renderInk(now)
    renderSprite()
    dirty = false
    if (animating()) schedule()
    else lastFrame = 0
  }

  function schedule() {
    if (!raf && !destroyed) raf = requestAnimationFrame(frame)
  }

  cursorCanvas.dataset.kind = b.kind
  cursorCanvas.dataset.color = `#${hex2(b.rgb.r)}${hex2(b.rgb.g)}${hex2(b.rgb.b)}`
  resize()

  return {
    setColor(hex: string) {
      const next = parsePigment(hex)
      const base = b.baseRgb
      if (next.r === base.r && next.g === base.g && next.b === base.b) return
      const following = !hinted // no `data-cursor-color` hint is overriding the picker's colour right now
      b.baseRgb = next
      if (following) {
        b.rgb = next
        cursorCanvas.dataset.color = `#${hex2(next.r)}${hex2(next.g)}${hex2(next.b)}`
        if (effects) b.dipRipple = 1
      }
      dirty = true
      schedule()
    },
    feed(e: PointerEvent) {
      if (!destroyed) onMove(e)
    },
    destroy() {
      destroyed = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointerup', release, { capture: true })
      window.removeEventListener('pointercancel', release, { capture: true })
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      sprites.dispose()
      inkCanvas.remove()
      cursorCanvas.remove()
      root.classList.remove('art-cursor')
    },
  }
}
