/* ------------------------------------------------------------------
   Art Spark drawing engine — hand-written Canvas 2D.
   • Layers are offscreen canvases composited into a document canvas.
   • Strokes render into a stroke buffer (so markers don't darken where
     they overlap themselves) and are committed with the tool opacity.
   • History stores dirty-rect pixel diffs (ImageData) with a memory cap.
   • The view canvas shows the document with zoom/pan at device pixel ratio.
   ------------------------------------------------------------------ */
import { floodFillMask, inkBarrier } from './floodFill'
import { TOOL_PROFILES, hexRgb, stampDab } from './brushes'
import {
  BACKGROUNDS,
  BLEND_TO_COMPOSITE,
  BRUSH_TOOLS,
  SHAPE_TOOLS,
  type BackgroundKind,
  type BrushState,
  type Draft,
  type Layer,
  type LayerMeta,
  type Point,
  type Rect,
  type Symmetry,
  type ViewState,
} from './types'

type HistoryEntry =
  | { kind: 'pixels'; layerId: string; rect: Rect; before: ImageData; after: ImageData; bytes: number }
  | { kind: 'add'; layer: Layer; index: number; bytes: number }
  | { kind: 'remove'; layer: Layer; index: number; bytes: number }
  | { kind: 'move'; id: string; from: number; to: number; bytes: number }

export interface EngineOptions {
  width: number
  height: number
  background: BackgroundKind
  getBrush: () => BrushState
  onColorPicked?: (hex: string) => void
  /** called after each committed stroke/fill (for autosave/coverage) */
  onCommit?: () => void
  /** called when a temporary tool should be toggled (e.g. space → hand) */
  onToolHint?: (hint: string) => void
}

const MAX_LAYERS = 6
const MAX_HISTORY = 60
const MAX_HISTORY_BYTES = 180 * 1024 * 1024
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

let idCounter = 0
const newId = () => `layer_${Date.now().toString(36)}_${idCounter++}`

function makeCanvas(w: number, h: number, readback = false): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  if (readback) c.getContext('2d', { willReadFrequently: true })
  return c
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d')!

export class DrawingEngine {
  readonly width: number
  readonly height: number
  background: BackgroundKind
  layers: Layer[] = []
  lineart: Layer | null = null
  activeId = ''
  view: ViewState = { zoom: 1, panX: 0, panY: 0 }
  strokes = 0
  /** active drawing time for this session (seconds) */
  seconds = 0
  /** engine version at the last autosave */
  savedVersion = -1
  /** bumps on every observable change (for React's useSyncExternalStore) */
  version = 0

  private opts: EngineOptions
  private listeners = new Set<() => void>()
  private viewCanvas: HTMLCanvasElement | null = null
  private dpr = 1
  private cssW = 0
  private cssH = 0
  private doc: HTMLCanvasElement
  private scratch: HTMLCanvasElement
  private strokeBuf: HTMLCanvasElement
  private snapshot: HTMLCanvasElement
  private readCanvas: HTMLCanvasElement
  private smudgeBuf: HTMLCanvasElement
  private history: HistoryEntry[] = []
  private future: HistoryEntry[] = []
  private historyBytes = 0
  private dirtyDoc = true
  private dirtyView = true
  private raf = 0
  private barrier: Uint8Array | null = null
  private checker: CanvasPattern | null = null

  // stroke state
  private drawing: false | 'stroke' | 'shape' | 'smudge' = false
  private brush: BrushState | null = null
  private pts: Point[] = []
  private smoothed: Point | null = null
  /** live tip of a path stroke (visual only, never committed) */
  private tail: Point | null = null
  private stampCarry = 0
  private bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  private shapeStart: Point | null = null
  private shiftKey = false
  private seed = 1

  // navigation
  private pointers = new Map<number, { x: number; y: number; type: string }>()
  private panning: { x: number; y: number; panX: number; panY: number } | null = null
  private pinch: { dist: number; cx: number; cy: number; view: ViewState } | null = null
  private spaceHeld = false
  private penSeen = false

  // ghost hint overlay
  private ghost: { canvas: HTMLCanvasElement; until: number } | null = null

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.width = opts.width
    this.height = opts.height
    this.background = opts.background
    this.doc = makeCanvas(this.width, this.height)
    this.scratch = makeCanvas(this.width, this.height)
    this.strokeBuf = makeCanvas(this.width, this.height)
    this.snapshot = makeCanvas(this.width, this.height)
    this.readCanvas = makeCanvas(1, 1, true)
    this.smudgeBuf = makeCanvas(64, 64)
    const base = this.createLayer('Layer 1')
    this.layers.push(base)
    this.activeId = base.id
  }

  /* ================= subscription ================= */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getVersion = () => this.version

  private emit() {
    this.version++
    for (const l of this.listeners) l()
  }

  /* ================= view ================= */

  attach(canvas: HTMLCanvasElement) {
    this.viewCanvas = canvas
    this.checker = null
    this.requestRender(true)
  }

  detach() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.viewCanvas = null
  }

  resize(cssW: number, cssH: number) {
    if (!this.viewCanvas) return
    const first = this.cssW === 0
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    this.cssW = cssW
    this.cssH = cssH
    this.viewCanvas.width = Math.round(cssW * this.dpr)
    this.viewCanvas.height = Math.round(cssH * this.dpr)
    if (first) this.fit()
    this.requestRender()
  }

  fit() {
    if (!this.cssW) return
    const pad = this.cssW < 640 ? 16 : 48
    const zoom = Math.min((this.cssW - pad * 2) / this.width, (this.cssH - pad * 2) / this.height)
    this.view = {
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
      panX: 0,
      panY: 0,
    }
    this.view.panX = (this.cssW - this.width * this.view.zoom) / 2
    this.view.panY = (this.cssH - this.height * this.view.zoom) / 2
    this.requestRender()
    this.emit()
  }

  setZoom(zoom: number, cx = this.cssW / 2, cy = this.cssH / 2) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    const docX = (cx - this.view.panX) / this.view.zoom
    const docY = (cy - this.view.panY) / this.view.zoom
    this.view = { zoom: z, panX: cx - docX * z, panY: cy - docY * z }
    this.requestRender()
    this.emit()
  }

  zoomBy(factor: number, cx?: number, cy?: number) {
    this.setZoom(this.view.zoom * factor, cx, cy)
  }

  toDoc(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.viewCanvas!.getBoundingClientRect()
    return { x: (clientX - r.left - this.view.panX) / this.view.zoom, y: (clientY - r.top - this.view.panY) / this.view.zoom }
  }

  /* ================= layers ================= */

  private createLayer(name: string, kind: LayerMeta['kind'] = 'paint'): Layer {
    return {
      id: newId(),
      name,
      visible: true,
      opacity: 1,
      blend: kind === 'lineart' ? 'multiply' : 'normal',
      locked: kind === 'lineart',
      kind,
      canvas: makeCanvas(this.width, this.height),
    }
  }

  get activeLayer(): Layer | undefined {
    return this.layers.find((l) => l.id === this.activeId)
  }

  canAddLayer() {
    return this.layers.length < MAX_LAYERS
  }

  addLayer(name?: string): Layer | null {
    if (!this.canAddLayer()) return null
    const layer = this.createLayer(name ?? `Layer ${this.layers.length + 1}`)
    const idx = this.layers.findIndex((l) => l.id === this.activeId) + 1
    this.layers.splice(idx, 0, layer)
    this.activeId = layer.id
    this.pushHistory({ kind: 'add', layer, index: idx, bytes: 1024 })
    this.markDirty()
    return layer
  }

  removeLayer(id: string) {
    if (this.layers.length <= 1) return
    const index = this.layers.findIndex((l) => l.id === id)
    if (index < 0) return
    const [layer] = this.layers.splice(index, 1)
    if (this.activeId === id) this.activeId = this.layers[Math.max(0, index - 1)].id
    this.pushHistory({ kind: 'remove', layer, index, bytes: this.width * this.height * 4 })
    this.markDirty()
  }

  moveLayer(id: string, dir: 1 | -1) {
    const from = this.layers.findIndex((l) => l.id === id)
    const to = from + dir
    if (from < 0 || to < 0 || to >= this.layers.length) return
    const [l] = this.layers.splice(from, 1)
    this.layers.splice(to, 0, l)
    this.pushHistory({ kind: 'move', id, from, to, bytes: 64 })
    this.markDirty()
  }

  setLayerProps(id: string, p: Partial<Pick<LayerMeta, 'name' | 'visible' | 'opacity' | 'blend' | 'locked'>>) {
    const l = id === this.lineart?.id ? this.lineart : this.layers.find((x) => x.id === id)
    if (!l) return
    Object.assign(l, p)
    this.markDirty()
  }

  setActive(id: string) {
    if (this.layers.some((l) => l.id === id)) {
      this.activeId = id
      this.emit()
    }
  }

  /** Line art for template mode: a locked, multiplied top layer. */
  setLineArt(source: CanvasImageSource) {
    const l = this.lineart ?? this.createLayer('Line art', 'lineart')
    const c = ctx2d(l.canvas)
    c.clearRect(0, 0, this.width, this.height)
    c.drawImage(source, 0, 0, this.width, this.height)
    this.lineart = l
    this.barrier = null
    this.markDirty()
  }

  setBackground(bg: BackgroundKind) {
    this.background = bg
    this.markDirty()
  }

  /* ================= history ================= */

  private pushHistory(e: HistoryEntry) {
    this.history.push(e)
    this.historyBytes += e.bytes
    this.future = []
    while (this.history.length > MAX_HISTORY || (this.historyBytes > MAX_HISTORY_BYTES && this.history.length > 1)) {
      const old = this.history.shift()!
      this.historyBytes -= old.bytes
    }
  }

  canUndo() {
    return this.history.length > 0
  }
  canRedo() {
    return this.future.length > 0
  }

  undo() {
    if (this.drawing) return
    const e = this.history.pop()
    if (!e) return
    this.historyBytes -= e.bytes
    this.applyEntry(e, 'undo')
    this.future.push(e)
    this.markDirty()
    this.opts.onCommit?.()
  }

  redo() {
    if (this.drawing) return
    const e = this.future.pop()
    if (!e) return
    this.applyEntry(e, 'redo')
    this.history.push(e)
    this.historyBytes += e.bytes
    this.markDirty()
    this.opts.onCommit?.()
  }

  private applyEntry(e: HistoryEntry, dir: 'undo' | 'redo') {
    switch (e.kind) {
      case 'pixels': {
        const l = this.layers.find((x) => x.id === e.layerId)
        if (l) ctx2d(l.canvas).putImageData(dir === 'undo' ? e.before : e.after, e.rect.x, e.rect.y)
        break
      }
      case 'add':
        if (dir === 'undo') {
          this.layers = this.layers.filter((l) => l.id !== e.layer.id)
          if (this.activeId === e.layer.id) this.activeId = this.layers[Math.max(0, e.index - 1)].id
        } else {
          this.layers.splice(e.index, 0, e.layer)
          this.activeId = e.layer.id
        }
        break
      case 'remove':
        if (dir === 'undo') {
          this.layers.splice(e.index, 0, e.layer)
          this.activeId = e.layer.id
        } else {
          this.layers = this.layers.filter((l) => l.id !== e.layer.id)
          if (this.activeId === e.layer.id) this.activeId = this.layers[Math.max(0, e.index - 1)].id
        }
        break
      case 'move': {
        const [a, b] = dir === 'undo' ? [e.to, e.from] : [e.from, e.to]
        const [l] = this.layers.splice(a, 1)
        this.layers.splice(b, 0, l)
        break
      }
    }
  }

  /** Clear the active layer (undoable). */
  clearLayer(id = this.activeId) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    const rect = { x: 0, y: 0, w: this.width, h: this.height }
    const before = this.read(l.canvas, rect)
    ctx2d(l.canvas).clearRect(0, 0, this.width, this.height)
    const after = this.read(l.canvas, rect)
    this.pushHistory({ kind: 'pixels', layerId: l.id, rect, before, after, bytes: before.data.length * 2 })
    this.markDirty()
    this.opts.onCommit?.()
  }

  /* ================= rendering ================= */

  private markDirty() {
    this.dirtyDoc = true
    this.requestRender()
    this.emit()
  }

  requestRender(docToo = false) {
    if (docToo) this.dirtyDoc = true
    this.dirtyView = true
    if (!this.raf && this.viewCanvas) this.raf = requestAnimationFrame(this.frame)
  }

  private frame = () => {
    this.raf = 0
    if (this.dirtyDoc) {
      this.compositeDoc()
      this.dirtyDoc = false
      this.dirtyView = true
    }
    if (this.dirtyView) {
      this.renderView()
      this.dirtyView = false
    }
    if (this.ghost && performance.now() < this.ghost.until) this.requestRender()
    else if (this.ghost) {
      this.ghost = null
      this.requestRender()
    }
  }

  private strokeOpacity(): number {
    const b = this.brush
    if (!b) return 1
    return b.settings.opacity
  }

  private compositeDoc() {
    const d = ctx2d(this.doc)
    d.setTransform(1, 0, 0, 1, 0, 0)
    d.globalAlpha = 1
    d.globalCompositeOperation = 'source-over'
    d.clearRect(0, 0, this.width, this.height)
    const bg = BACKGROUNDS[this.background]
    if (bg) {
      d.fillStyle = bg
      d.fillRect(0, 0, this.width, this.height)
    }
    const showStroke = (this.drawing === 'stroke' || this.drawing === 'shape') && this.brush
    for (const l of this.layers) {
      if (!l.visible) continue
      let src: HTMLCanvasElement = l.canvas
      if (showStroke && l.id === this.activeId) {
        const s = ctx2d(this.scratch)
        s.globalCompositeOperation = 'source-over'
        s.globalAlpha = 1
        s.clearRect(0, 0, this.width, this.height)
        s.drawImage(l.canvas, 0, 0)
        s.globalAlpha = this.strokeOpacity()
        s.globalCompositeOperation = this.brush!.tool === 'eraser' ? 'destination-out' : 'source-over'
        s.drawImage(this.strokeBuf, 0, 0)
        s.globalAlpha = 1
        s.globalCompositeOperation = 'source-over'
        src = this.scratch
      }
      d.globalAlpha = l.opacity
      d.globalCompositeOperation = BLEND_TO_COMPOSITE[l.blend]
      d.drawImage(src, 0, 0)
    }
    if (this.lineart?.visible) {
      d.globalAlpha = this.lineart.opacity
      d.globalCompositeOperation = 'multiply'
      d.drawImage(this.lineart.canvas, 0, 0)
    }
    d.globalAlpha = 1
    d.globalCompositeOperation = 'source-over'
  }

  private checkerPattern(ctx: CanvasRenderingContext2D) {
    if (this.checker) return this.checker
    const c = makeCanvas(16, 16)
    const x = ctx2d(c)
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, 16, 16)
    x.fillStyle = '#e6e2da'
    x.fillRect(0, 0, 8, 8)
    x.fillRect(8, 8, 8, 8)
    this.checker = ctx.createPattern(c, 'repeat')
    return this.checker
  }

  private renderView() {
    const vc = this.viewCanvas
    if (!vc) return
    const v = ctx2d(vc)
    const { zoom, panX, panY } = this.view
    v.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    v.clearRect(0, 0, this.cssW, this.cssH)
    // soft paper shadow (cheap stacked rects)
    v.save()
    v.translate(panX, panY)
    const w = this.width * zoom
    const h = this.height * zoom
    for (let i = 4; i >= 1; i--) {
      v.fillStyle = `rgba(30,20,10,${0.035 * (5 - i)})`
      v.fillRect(-i * 2 + i, -i + i * 3, w + i * 2, h + i * 2)
    }
    if (this.background === 'transparent') {
      v.fillStyle = this.checkerPattern(v) ?? '#fff'
      v.fillRect(0, 0, w, h)
    }
    v.imageSmoothingEnabled = zoom < 3
    v.imageSmoothingQuality = 'high'
    v.drawImage(this.doc, 0, 0, w, h)
    this.drawTail(v)
    // symmetry guides
    const b = this.opts.getBrush()
    if (b.symmetry !== 'none' && (BRUSH_TOOLS.includes(b.tool) || SHAPE_TOOLS.includes(b.tool))) {
      v.save()
      v.setLineDash([6, 6])
      v.strokeStyle = 'rgba(58,63,168,0.55)'
      v.lineWidth = 1.2
      v.beginPath()
      const cx = w / 2
      const cy = h / 2
      if (b.symmetry === 'vertical' || b.symmetry === 'quad') {
        v.moveTo(cx, 0)
        v.lineTo(cx, h)
      }
      if (b.symmetry === 'horizontal' || b.symmetry === 'quad') {
        v.moveTo(0, cy)
        v.lineTo(w, cy)
      }
      if (b.symmetry === 'radial6' || b.symmetry === 'radial8') {
        const n = b.symmetry === 'radial6' ? 6 : 8
        const r = Math.hypot(w, h) / 2
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          v.moveTo(cx, cy)
          v.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
      }
      v.stroke()
      v.restore()
    }
    if (this.ghost) {
      const t = (this.ghost.until - performance.now()) / 1600
      v.globalAlpha = Math.max(0, Math.sin(t * Math.PI * 3)) * 0.85
      v.drawImage(this.ghost.canvas, 0, 0, w, h)
      v.globalAlpha = 1
    }
    v.restore()
  }

  /**
   * Path strokes (pen, marker) are drawn up to the midpoint of the last two samples,
   * so the visible line ends slightly behind the pointer. This draws the missing
   * piece up to where the pointer is now. Visual only: the next frame redraws it,
   * and it is never written to the stroke buffer.
   */
  private drawTail(v: CanvasRenderingContext2D) {
    const b = this.brush
    const t = this.tail
    if (!b || !t || this.drawing !== 'stroke' || this.pts.length < 2 || b.tool === 'eraser') return
    const profile = TOOL_PROFILES[b.tool]
    if (profile?.render !== 'path') return
    const [bb, c] = this.pts.slice(-2)
    const B = this.symmetryPoints(bb.x, bb.y)
    const C = this.symmetryPoints(c.x, c.y)
    const T = this.symmetryPoints(t.x, t.y)
    const z = this.view.zoom
    v.save()
    v.globalAlpha = b.settings.opacity
    v.strokeStyle = b.color
    v.lineCap = 'round'
    v.lineJoin = 'round'
    v.lineWidth = (profile.pressureSize ? b.settings.size * (0.2 + 0.8 * c.p) : b.settings.size) * z
    for (let i = 0; i < B.length; i++) {
      v.beginPath()
      v.moveTo(((B[i][0] + C[i][0]) / 2) * z, ((B[i][1] + C[i][1]) / 2) * z)
      v.lineTo(C[i][0] * z, C[i][1] * z)
      v.lineTo(T[i][0] * z, T[i][1] * z)
      v.stroke()
    }
    v.restore()
  }

  /** Where the pointer is now, for the live tail. Only with smoothing off, so the tail never contradicts the stabiliser. */
  private liveTail(e: PointerEvent, events: PointerEvent[]): Point | null {
    const b = this.brush
    if (!b || b.smoothing >= 0.01 || TOOL_PROFILES[b.tool]?.render !== 'path') return null
    // predicted points only for pens: for a mouse they overshoot and would leave a ghost line when the hand stops
    const predicted = e.pointerType === 'pen' ? e.getPredictedEvents?.() : undefined
    const src = predicted?.length ? predicted[predicted.length - 1] : events[events.length - 1]
    const { x, y } = this.toDoc(src.clientX, src.clientY)
    return { x, y, p: this.smoothed?.p ?? 1 }
  }

  /* ================= input ================= */

  setSpace(held: boolean) {
    this.spaceHeld = held
  }
  setShift(held: boolean) {
    this.shiftKey = held
  }
  isPanningMode() {
    return this.spaceHeld || this.opts.getBrush().tool === 'hand'
  }

  pointerDown(e: PointerEvent) {
    if (!this.viewCanvas) return
    if (e.pointerType === 'pen') this.penSeen = true
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })
    this.viewCanvas.setPointerCapture?.(e.pointerId)

    // two fingers → pinch/pan; abandon any stroke started by the first finger
    const touches = [...this.pointers.values()].filter((p) => p.type === 'touch')
    if (touches.length >= 2) {
      this.cancelStroke()
      const [a, b] = touches
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: { ...this.view } }
      return
    }
    // with a stylus around, fingers navigate instead of paint (palm rejection)
    const brush = this.opts.getBrush()
    if (e.button === 1 || this.isPanningMode() || (e.pointerType === 'touch' && this.penSeen)) {
      this.panning = { x: e.clientX, y: e.clientY, panX: this.view.panX, panY: this.view.panY }
      return
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const { x, y } = this.toDoc(e.clientX, e.clientY)
    const tool = brush.tool

    if (tool === 'zoom') {
      const r = this.viewCanvas.getBoundingClientRect()
      this.zoomBy(e.altKey ? 1 / 1.6 : 1.6, e.clientX - r.left, e.clientY - r.top)
      return
    }
    if (tool === 'eyedropper' || e.altKey) {
      this.pickColor(x, y)
      return
    }
    const layer = this.activeLayer
    if (!layer || layer.locked || !layer.visible) {
      this.opts.onToolHint?.(layer?.locked ? 'locked' : 'hidden')
      return
    }
    if (tool === 'bucket') {
      this.fill(x, y, brush)
      return
    }
    this.brush = { ...brush }
    this.seed = (Math.random() * 1e9) | 0
    this.bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    // snapshot the layer for undo
    const sn = ctx2d(this.snapshot)
    sn.clearRect(0, 0, this.width, this.height)
    sn.drawImage(layer.canvas, 0, 0)
    ctx2d(this.strokeBuf).clearRect(0, 0, this.width, this.height)
    const p = this.pressure(e)
    if (SHAPE_TOOLS.includes(tool)) {
      this.drawing = 'shape'
      this.shapeStart = { x, y, p }
      return
    }
    if (tool === 'smudge') {
      this.drawing = 'smudge'
      this.pts = [{ x, y, p }]
      this.grabSmudge(layer, x, y, brush.settings.size)
      return
    }
    this.drawing = 'stroke'
    this.smoothed = { x, y, p }
    this.pts = [{ x, y, p }]
    this.stampCarry = 0
    this.renderStrokeTo({ x, y, p }, true)
    this.dirtyDoc = true
    this.requestRender()
  }

  pointerMove(e: PointerEvent) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })
    if (this.pinch) {
      const touches = [...this.pointers.values()].filter((p) => p.type === 'touch')
      if (touches.length < 2) return
      const [a, b] = touches
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const r = this.viewCanvas!.getBoundingClientRect()
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.view.zoom * (dist / this.pinch.dist)))
      const ox = this.pinch.cx - r.left
      const oy = this.pinch.cy - r.top
      const docX = (ox - this.pinch.view.panX) / this.pinch.view.zoom
      const docY = (oy - this.pinch.view.panY) / this.pinch.view.zoom
      this.view = { zoom: z, panX: cx - r.left - docX * z, panY: cy - r.top - docY * z }
      this.requestRender()
      this.emit()
      return
    }
    if (this.panning) {
      this.view = {
        ...this.view,
        panX: this.panning.panX + (e.clientX - this.panning.x),
        panY: this.panning.panY + (e.clientY - this.panning.y),
      }
      this.requestRender()
      return
    }
    if (!this.drawing || !this.brush) return
    // use coalesced events for smooth, high-frequency pen input
    const events = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e]
    for (const ev of events) {
      const { x, y } = this.toDoc(ev.clientX, ev.clientY)
      const p = this.pressure(ev)
      if (this.drawing === 'shape') this.drawShape({ x, y, p })
      else if (this.drawing === 'smudge') this.smudgeTo({ x, y, p })
      else {
        // stabiliser: exponential smoothing towards the raw point
        const k = 1 - Math.min(0.92, this.brush.smoothing * 0.9)
        const s = this.smoothed!
        const next = { x: s.x + (x - s.x) * k, y: s.y + (y - s.y) * k, p: s.p + (p - s.p) * k }
        this.smoothed = next
        this.renderStrokeTo(next)
      }
    }
    this.tail = this.drawing === 'stroke' ? this.liveTail(e, events) : null
    this.dirtyDoc = true
    this.requestRender()
  }

  pointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId)
    if (this.pinch) {
      if ([...this.pointers.values()].filter((p) => p.type === 'touch').length < 2) this.pinch = null
      this.emit()
      return
    }
    if (this.panning) {
      this.panning = null
      this.emit()
      return
    }
    if (!this.drawing || !this.brush) return
    if (this.drawing === 'stroke') {
      const { x, y } = this.toDoc(e.clientX, e.clientY)
      // catch up to the final raw point so smoothing doesn't shorten strokes
      if (this.smoothed && Math.hypot(x - this.smoothed.x, y - this.smoothed.y) > 0.5) {
        this.renderStrokeTo({ x, y, p: this.smoothed.p })
      }
      this.finishPath()
    }
    this.commitStroke()
  }

  pointerCancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId)
    this.pinch = null
    this.panning = null
    this.cancelStroke()
  }

  wheel(e: WheelEvent) {
    e.preventDefault()
    const r = this.viewCanvas!.getBoundingClientRect()
    if (e.shiftKey && !e.ctrlKey) {
      this.view = { ...this.view, panX: this.view.panX - e.deltaY, panY: this.view.panY - e.deltaX }
      this.requestRender()
      this.emit()
      return
    }
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018))
    this.zoomBy(factor, e.clientX - r.left, e.clientY - r.top)
  }

  private pressure(e: PointerEvent): number {
    if (!this.opts.getBrush().pressure) return 1
    if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure
    return 1
  }

  /* ================= strokes ================= */

  private rand = () => {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }

  private symmetryPoints(x: number, y: number): [number, number][] {
    const sym: Symmetry = this.brush?.symmetry ?? 'none'
    const cx = this.width / 2
    const cy = this.height / 2
    switch (sym) {
      case 'none':
        return [[x, y]]
      case 'vertical':
        return [
          [x, y],
          [2 * cx - x, y],
        ]
      case 'horizontal':
        return [
          [x, y],
          [x, 2 * cy - y],
        ]
      case 'quad':
        return [
          [x, y],
          [2 * cx - x, y],
          [x, 2 * cy - y],
          [2 * cx - x, 2 * cy - y],
        ]
      case 'radial6':
      case 'radial8': {
        const n = sym === 'radial6' ? 6 : 8
        const dx = x - cx
        const dy = y - cy
        const out: [number, number][] = []
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          out.push([cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)])
        }
        return out
      }
    }
  }

  private grow(x: number, y: number, r: number) {
    this.bounds.x0 = Math.min(this.bounds.x0, x - r)
    this.bounds.y0 = Math.min(this.bounds.y0, y - r)
    this.bounds.x1 = Math.max(this.bounds.x1, x + r)
    this.bounds.y1 = Math.max(this.bounds.y1, y + r)
  }

  private renderStrokeTo(pt: Point, first = false) {
    const b = this.brush!
    const profile = TOOL_PROFILES[b.tool] ?? TOOL_PROFILES.pen!
    const ctx = ctx2d(this.strokeBuf)
    const baseSize = b.settings.size
    const sizeAt = (p: number) => (profile.pressureSize ? baseSize * (0.2 + 0.8 * p) : baseSize)
    const flowAt = (p: number) => (profile.pressureFlow ? 0.35 + 0.65 * p : 1)
    const color = b.tool === 'eraser' ? '#000000' : b.color

    if (profile.render === 'path') {
      this.pts.push(pt)
      if (first) {
        for (const [x, y] of this.symmetryPoints(pt.x, pt.y)) {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, y, sizeAt(pt.p) / 2, 0, Math.PI * 2)
          ctx.fill()
          this.grow(x, y, sizeAt(pt.p))
        }
        return
      }
      const [a, bb, c] = this.pts.slice(-3)
      const A = this.symmetryPoints(a.x, a.y)
      const B = this.symmetryPoints(bb.x, bb.y)
      const C = this.symmetryPoints(c.x, c.y)
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = sizeAt((bb.p + c.p) / 2)
      for (let i = 0; i < A.length; i++) {
        const m1x = (A[i][0] + B[i][0]) / 2
        const m1y = (A[i][1] + B[i][1]) / 2
        const m2x = (B[i][0] + C[i][0]) / 2
        const m2y = (B[i][1] + C[i][1]) / 2
        ctx.beginPath()
        ctx.moveTo(m1x, m1y)
        ctx.quadraticCurveTo(B[i][0], B[i][1], m2x, m2y)
        ctx.stroke()
        this.grow(B[i][0], B[i][1], ctx.lineWidth)
      }
      return
    }

    // dab-based brushes: walk the path at even spacing
    const last = this.pts[this.pts.length - 1]
    if (first) {
      for (const [x, y] of this.symmetryPoints(pt.x, pt.y)) {
        stampDab(ctx, b.tool, color, x, y, sizeAt(pt.p), b.settings.hardness, flowAt(pt.p), this.rand)
        this.grow(x, y, sizeAt(pt.p))
      }
      return
    }
    const dx = pt.x - last.x
    const dy = pt.y - last.y
    const dist = Math.hypot(dx, dy)
    const spacing = Math.max(0.6, sizeAt(pt.p) * profile.spacing)
    let t = spacing - this.stampCarry
    while (t <= dist) {
      const f = t / dist
      const x = last.x + dx * f
      const y = last.y + dy * f
      const p = last.p + (pt.p - last.p) * f
      for (const [sx, sy] of this.symmetryPoints(x, y)) {
        stampDab(ctx, b.tool, color, sx, sy, sizeAt(p), b.settings.hardness, flowAt(p), this.rand)
        this.grow(sx, sy, sizeAt(p))
      }
      t += spacing
    }
    this.stampCarry = dist - (t - spacing)
    this.pts.push(pt)
  }

  /** Path strokes end at the last midpoint; draw the tail to the final point. */
  private finishPath() {
    const b = this.brush!
    const profile = TOOL_PROFILES[b.tool]
    if (profile?.render !== 'path' || this.pts.length < 3) return
    const [bb, c] = this.pts.slice(-2)
    const ctx = ctx2d(this.strokeBuf)
    ctx.strokeStyle = b.color
    ctx.lineCap = 'round'
    ctx.lineWidth = profile.pressureSize ? b.settings.size * (0.2 + 0.8 * c.p) : b.settings.size
    const B = this.symmetryPoints(bb.x, bb.y)
    const C = this.symmetryPoints(c.x, c.y)
    for (let i = 0; i < B.length; i++) {
      ctx.beginPath()
      ctx.moveTo((B[i][0] + C[i][0]) / 2, (B[i][1] + C[i][1]) / 2)
      ctx.lineTo(C[i][0], C[i][1])
      ctx.stroke()
      this.grow(C[i][0], C[i][1], ctx.lineWidth)
    }
  }

  private drawShape(end: Point) {
    const b = this.brush!
    const s = this.shapeStart!
    const ctx = ctx2d(this.strokeBuf)
    ctx.clearRect(0, 0, this.width, this.height)
    let x2 = end.x
    let y2 = end.y
    if (this.shiftKey) {
      if (b.tool === 'line') {
        const ang = Math.round(Math.atan2(y2 - s.y, x2 - s.x) / (Math.PI / 4)) * (Math.PI / 4)
        const len = Math.hypot(x2 - s.x, y2 - s.y)
        x2 = s.x + Math.cos(ang) * len
        y2 = s.y + Math.sin(ang) * len
      } else {
        const d = Math.max(Math.abs(x2 - s.x), Math.abs(y2 - s.y))
        x2 = s.x + Math.sign(x2 - s.x || 1) * d
        y2 = s.y + Math.sign(y2 - s.y || 1) * d
      }
    }
    ctx.strokeStyle = b.color
    ctx.fillStyle = b.color
    ctx.lineWidth = b.settings.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const P1 = this.symmetryPoints(s.x, s.y)
    const P2 = this.symmetryPoints(x2, y2)
    this.bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (let i = 0; i < P1.length; i++) {
      const [ax, ay] = P1[i]
      const [bx, by] = P2[i]
      ctx.beginPath()
      if (b.tool === 'line') {
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      } else if (b.tool === 'rect') {
        ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay))
        if (b.shapeFill) ctx.fill()
        else ctx.stroke()
      } else {
        ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, Math.PI * 2)
        if (b.shapeFill) ctx.fill()
        else ctx.stroke()
      }
      this.grow(ax, ay, b.settings.size)
      this.grow(bx, by, b.settings.size)
    }
  }

  /* ---------- smudge ---------- */

  private grabSmudge(layer: Layer, x: number, y: number, size: number) {
    const s = Math.max(4, Math.round(size))
    if (this.smudgeBuf.width !== s) {
      this.smudgeBuf.width = s
      this.smudgeBuf.height = s
    }
    const c = ctx2d(this.smudgeBuf)
    c.clearRect(0, 0, s, s)
    c.drawImage(layer.canvas, x - s / 2, y - s / 2, s, s, 0, 0, s, s)
  }

  private smudgeTo(pt: Point) {
    const layer = this.activeLayer
    const b = this.brush!
    if (!layer) return
    const last = this.pts[this.pts.length - 1]
    const s = this.smudgeBuf.width
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y)
    const steps = Math.max(1, Math.floor(dist / Math.max(1, s * 0.15)))
    const lc = ctx2d(layer.canvas)
    const strength = b.settings.opacity * (0.5 + 0.5 * pt.p)
    for (let i = 1; i <= steps; i++) {
      const x = last.x + ((pt.x - last.x) * i) / steps
      const y = last.y + ((pt.y - last.y) * i) / steps
      lc.save()
      lc.beginPath()
      lc.arc(x, y, s / 2, 0, Math.PI * 2)
      lc.clip()
      lc.globalAlpha = strength * 0.6
      lc.drawImage(this.smudgeBuf, x - s / 2, y - s / 2)
      lc.restore()
      // pick up some of the new colour
      const sc = ctx2d(this.smudgeBuf)
      sc.globalAlpha = 0.25
      sc.drawImage(layer.canvas, x - s / 2, y - s / 2, s, s, 0, 0, s, s)
      sc.globalAlpha = 1
      this.grow(x, y, s)
    }
    this.pts.push(pt)
    this.dirtyDoc = true
  }

  /* ---------- commit / cancel ---------- */

  private boundsRect(): Rect | null {
    if (!isFinite(this.bounds.x0)) return null
    const x = Math.max(0, Math.floor(this.bounds.x0 - 2))
    const y = Math.max(0, Math.floor(this.bounds.y0 - 2))
    const x1 = Math.min(this.width, Math.ceil(this.bounds.x1 + 2))
    const y1 = Math.min(this.height, Math.ceil(this.bounds.y1 + 2))
    if (x1 <= x || y1 <= y) return null
    return { x, y, w: x1 - x, h: y1 - y }
  }

  private commitStroke() {
    const layer = this.activeLayer
    const b = this.brush
    const mode = this.drawing
    this.drawing = false
    this.tail = null
    if (!layer || !b) return
    if (mode !== 'smudge') {
      const lc = ctx2d(layer.canvas)
      lc.globalAlpha = b.settings.opacity
      lc.globalCompositeOperation = b.tool === 'eraser' ? 'destination-out' : 'source-over'
      lc.drawImage(this.strokeBuf, 0, 0)
      lc.globalAlpha = 1
      lc.globalCompositeOperation = 'source-over'
      ctx2d(this.strokeBuf).clearRect(0, 0, this.width, this.height)
    }
    const rect = this.boundsRect()
    if (rect) {
      const before = this.read(this.snapshot, rect)
      const after = this.read(layer.canvas, rect)
      this.pushHistory({ kind: 'pixels', layerId: layer.id, rect, before, after, bytes: before.data.length * 2 })
      this.strokes++
    }
    this.brush = null
    this.pts = []
    this.shapeStart = null
    this.markDirty()
    this.opts.onCommit?.()
  }

  cancelStroke() {
    if (!this.drawing) return
    const layer = this.activeLayer
    if (this.drawing === 'smudge' && layer) {
      const lc = ctx2d(layer.canvas)
      lc.clearRect(0, 0, this.width, this.height)
      lc.drawImage(this.snapshot, 0, 0)
    }
    ctx2d(this.strokeBuf).clearRect(0, 0, this.width, this.height)
    this.drawing = false
    this.tail = null
    this.brush = null
    this.pts = []
    this.markDirty()
  }

  /* ================= bucket & eyedropper ================= */

  private read(src: HTMLCanvasElement, r: Rect): ImageData {
    const rc = this.readCanvas
    if (rc.width !== r.w || rc.height !== r.h) {
      rc.width = r.w
      rc.height = r.h
    }
    const c = rc.getContext('2d', { willReadFrequently: true })!
    c.clearRect(0, 0, r.w, r.h)
    c.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
    return c.getImageData(0, 0, r.w, r.h)
  }

  private inkBarrierMask(): Uint8Array | null {
    if (!this.lineart) return null
    this.barrier ??= inkBarrier(this.read(this.lineart.canvas, { x: 0, y: 0, w: this.width, h: this.height }).data)
    return this.barrier
  }

  fill(x: number, y: number, brush: BrushState) {
    const layer = this.activeLayer
    if (!layer) return
    const full = { x: 0, y: 0, w: this.width, h: this.height }
    let sample: HTMLCanvasElement = layer.canvas
    if (brush.sampleAllLayers && this.layers.length > 1) {
      const s = ctx2d(this.scratch)
      s.clearRect(0, 0, this.width, this.height)
      for (const l of this.layers) if (l.visible) s.drawImage(l.canvas, 0, 0)
      sample = this.scratch
    }
    const px = this.read(sample, full)
    const barrier = this.lineart?.visible !== false ? this.inkBarrierMask() : null
    const tol = Math.round((brush.tolerance / 100) * 255)
    const res = floodFillMask(px.data, this.width, this.height, x, y, {
      tolerance: tol,
      barrier: barrier ?? undefined,
      bleed: barrier ? 2 : 1,
    })
    if (!res.count) {
      this.opts.onToolHint?.('fill-none')
      return
    }
    const { x0, y0, x1, y1 } = res.bounds
    const rect = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
    const before = this.read(layer.canvas, rect)
    // paint the mask through a temp canvas so opacity composites normally
    const tmp = makeCanvas(rect.w, rect.h)
    const tctx = ctx2d(tmp)
    const img = tctx.createImageData(rect.w, rect.h)
    const [r, g, b] = hexRgb(brush.color)
    for (let yy = 0; yy < rect.h; yy++) {
      for (let xx = 0; xx < rect.w; xx++) {
        if (!res.mask[(yy + y0) * this.width + (xx + x0)]) continue
        const k = (yy * rect.w + xx) * 4
        img.data[k] = r
        img.data[k + 1] = g
        img.data[k + 2] = b
        img.data[k + 3] = 255
      }
    }
    tctx.putImageData(img, 0, 0)
    const lc = ctx2d(layer.canvas)
    lc.globalAlpha = brush.settings.opacity
    lc.drawImage(tmp, rect.x, rect.y)
    lc.globalAlpha = 1
    const after = this.read(layer.canvas, rect)
    this.pushHistory({ kind: 'pixels', layerId: layer.id, rect, before, after, bytes: before.data.length * 2 })
    this.strokes++
    this.markDirty()
    this.opts.onCommit?.()
  }

  pickColor(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    if (this.dirtyDoc) this.compositeDoc()
    const d = this.read(this.doc, { x: Math.floor(x), y: Math.floor(y), w: 1, h: 1 }).data
    const a = d[3] / 255
    const mix = (c: number) => Math.round(c * a + 255 * (1 - a))
    const hex = `#${[mix(d[0]), mix(d[1]), mix(d[2])].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    this.opts.onColorPicked?.(hex)
  }

  /* ================= export & analysis ================= */

  /** Flattened image of all visible layers (+ background, + line art). */
  composite({ background = true, lineart = true }: { background?: boolean; lineart?: boolean } = {}): HTMLCanvasElement {
    const out = makeCanvas(this.width, this.height)
    const o = ctx2d(out)
    const bg = BACKGROUNDS[this.background]
    if (background && bg) {
      o.fillStyle = bg
      o.fillRect(0, 0, this.width, this.height)
    }
    for (const l of this.layers) {
      if (!l.visible) continue
      o.globalAlpha = l.opacity
      o.globalCompositeOperation = BLEND_TO_COMPOSITE[l.blend]
      o.drawImage(l.canvas, 0, 0)
    }
    if (lineart && this.lineart?.visible) {
      o.globalAlpha = this.lineart.opacity
      o.globalCompositeOperation = 'multiply'
      o.drawImage(this.lineart.canvas, 0, 0)
    }
    o.globalAlpha = 1
    o.globalCompositeOperation = 'source-over'
    return out
  }

  /** Downsampled RGBA of paint layers only + line-art barrier, for scoring/coverage. */
  analysisPixels(scale = 0.25): { paint: ImageData; ink: ImageData | null; w: number; h: number } {
    const w = Math.round(this.width * scale)
    const h = Math.round(this.height * scale)
    const paint = makeCanvas(w, h)
    const p = ctx2d(paint)
    for (const l of this.layers) {
      if (!l.visible) continue
      p.globalAlpha = l.opacity
      p.drawImage(l.canvas, 0, 0, w, h)
    }
    p.globalAlpha = 1
    const paintData = this.read(paint, { x: 0, y: 0, w, h })
    let ink: ImageData | null = null
    if (this.lineart) {
      const c = makeCanvas(w, h)
      ctx2d(c).drawImage(this.lineart.canvas, 0, 0, w, h)
      ink = this.read(c, { x: 0, y: 0, w, h })
    }
    return { paint: paintData, ink, w, h }
  }

  /** Flash a mask (doc-space canvas) over the view, e.g. ghost hints. */
  flash(mask: HTMLCanvasElement, ms = 1600) {
    this.ghost = { canvas: mask, until: performance.now() + ms }
    this.requestRender()
  }

  /* ================= drafts ================= */

  async serialize(): Promise<Draft> {
    const toBlob = (c: HTMLCanvasElement) =>
      new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
    const layers = await Promise.all(
      this.layers.map(async (l) => ({
        meta: { id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, kind: l.kind },
        image: await toBlob(l.canvas),
      })),
    )
    return {
      version: 1,
      width: this.width,
      height: this.height,
      background: this.background,
      layers,
      activeLayerId: this.activeId,
      savedAt: new Date().toISOString(),
      seconds: this.seconds,
      strokes: this.strokes,
    }
  }

  async load(d: Draft) {
    const layers: Layer[] = []
    for (const dl of d.layers) {
      const l: Layer = { ...dl.meta, canvas: makeCanvas(this.width, this.height) }
      const bmp = await createImageBitmap(dl.image)
      ctx2d(l.canvas).drawImage(bmp, 0, 0)
      bmp.close?.()
      layers.push(l)
    }
    if (layers.length) {
      this.layers = layers
      this.activeId = layers.some((l) => l.id === d.activeLayerId) ? d.activeLayerId : layers[0].id
    }
    this.background = d.background
    this.strokes = d.strokes
    this.seconds = d.seconds
    this.history = []
    this.future = []
    this.historyBytes = 0
    this.markDirty()
  }

  /** Count one second of active drawing time. */
  tick(): number {
    this.seconds += 1
    return this.seconds
  }

  markSaved() {
    this.savedVersion = this.version
  }

  isEmpty(): boolean {
    return this.strokes === 0
  }

  destroy() {
    this.detach()
    this.listeners.clear()
  }
}
