import { DrawingEngine } from '@/features/drawing/engine/Engine'
import type { BrushState } from '@/features/drawing/engine/types'

/* jsdom has no 2D canvas. This fake context records every call and which canvas
   was drawn into which, so the tests can prove where the guide pixels can reach. */
type Op = { target: HTMLCanvasElement; name: string; args: unknown[] }
let ops: Op[] = []
const ids = new WeakMap<object, number>()
let nextId = 0
const idOf = (value: object) => {
  if (!ids.has(value)) ids.set(value, nextId++)
  return ids.get(value)!
}

function fakeContext(target: HTMLCanvasElement) {
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over' }
  return new Proxy(state, {
    get(store, key: string) {
      if (key in store) return store[key]
      if (key === 'getImageData')
        return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
      if (key === 'createPattern') return () => ({})
      return (...args: unknown[]) => {
        ops.push({ target, name: key, args })
      }
    },
    set(store, key: string, value) {
      store[key] = value
      ops.push({ target, name: `set:${key}`, args: [value] })
      return true
    },
  })
}

const brush = { tool: 'pencil', symmetry: 'none' } as unknown as BrushState
let frame: FrameRequestCallback | null = null

beforeEach(() => {
  ops = []
  const contexts = new WeakMap<HTMLCanvasElement, unknown>()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    if (!contexts.has(this)) contexts.set(this, fakeContext(this))
    return contexts.get(this) as never
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, done) {
    ops.push({ target: this, name: 'toBlob', args: [] })
    done(new Blob([String(idOf(this))]))
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frame = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function source(width = 1200, height = 900) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function setup(width = 1200, height = 900, onColorPicked?: (hex: string) => void) {
  const engine = new DrawingEngine({ width, height, background: 'white', getBrush: () => brush, onColorPicked })
  const view = document.createElement('canvas')
  engine.attach(view)
  engine.resize(800, 600)
  runFrame()
  return { engine, view }
}

function runFrame() {
  const cb = frame
  frame = null
  cb?.(0)
}

/** Canvases the guide pixels reach, following drawImage from source to target. */
function reachedFrom(start: HTMLCanvasElement) {
  const reached = new Set<HTMLCanvasElement>([start])
  for (let changed = true; changed;) {
    changed = false
    for (const op of ops)
      if (op.name === 'drawImage' && reached.has(op.args[0] as HTMLCanvasElement) && !reached.has(op.target)) {
        reached.add(op.target)
        changed = true
      }
  }
  reached.delete(start)
  return reached
}

const shape = (log: Op[]) => JSON.stringify(log.map((op) => [op.name, op.args.map((a) => (a instanceof HTMLCanvasElement ? 'canvas' : a))]))

const guideCanvas = (src: HTMLCanvasElement) => ops.find((op) => op.name === 'drawImage' && op.args[0] === src)?.target

it('the guide reaches only the on-screen view, never the document, exports, analysis or drafts', async () => {
  const picked: string[] = []
  const { engine, view } = setup(1200, 900, (hex) => picked.push(hex))
  const src = source()
  engine.setGuide(src)
  runFrame()
  const guide = guideCanvas(src)!
  expect(guide).toBeDefined()

  // recompose the document (as after a stroke) before reading it
  engine.setBackground('cream')
  runFrame()
  engine.composite()
  engine.composite({ background: false })
  engine.analysisPixels()
  engine.pickColor(10, 10)
  const draft = await engine.serialize()
  runFrame()

  expect([...reachedFrom(guide)]).toEqual([view])
  expect(draft.layers).toHaveLength(1)
  expect(picked).toEqual(['#ffffff'])
})

it('composite, pickColor and serialize do the same work with the guide shown or hidden', async () => {
  const picked: string[] = []
  const { engine, view } = setup(1200, 900, (hex) => picked.push(hex))
  const run = async () => {
    ops = []
    engine.requestRender(true)
    runFrame()
    engine.composite()
    engine.pickColor(5, 5)
    const draft = await engine.serialize()
    return { log: shape(ops.filter((op) => op.target !== view)), draft: { ...draft, savedAt: '' } }
  }
  const without = await run()
  engine.setGuide(source())
  runFrame()
  const shown = await run()
  engine.setGuideProps({ visible: false })
  const hidden = await run()
  expect(shown).toEqual(without)
  expect(hidden).toEqual(without)
  expect(new Set(picked)).toEqual(new Set(['#ffffff']))
})

it('toggling the guide redraws the view only and never enters history or marks drawing changes', () => {
  const { engine, view } = setup()
  engine.setGuide(source())
  runFrame()
  const strokes = engine.strokes
  ops = []
  const version = engine.version
  engine.setGuideProps({ visible: false })
  engine.setGuideProps({ opacity: 0.45, visible: true })
  runFrame()
  expect(engine.version).toBeGreaterThan(version)
  expect(engine.canUndo()).toBe(false)
  expect(engine.strokes).toBe(strokes)
  expect(engine.isEmpty()).toBe(true)
  expect(new Set(ops.map((op) => op.target))).toEqual(new Set([view]))
  expect(engine.guideState).toEqual({ visible: true, opacity: 0.45 })
})

it('the view draws the guide right after the document, multiplied at its opacity, then resets', () => {
  const { engine, view } = setup()
  engine.setGuide(source())
  engine.setGuideProps({ opacity: 0.18 })
  ops = []
  engine.requestRender()
  runFrame()
  const viewOps = ops
    .filter((op) => op.target === view)
    .map((op) => [op.name, op.args[0] instanceof HTMLCanvasElement ? 'canvas' : op.args[0]])
  const firstDraw = viewOps.findIndex((op) => op[0] === 'drawImage')
  expect(viewOps.slice(firstDraw, firstDraw + 6)).toEqual([
    ['drawImage', 'canvas'],
    ['set:globalAlpha', 0.18],
    ['set:globalCompositeOperation', 'multiply'],
    ['drawImage', 'canvas'],
    ['set:globalAlpha', 1],
    ['set:globalCompositeOperation', 'source-over'],
  ])
  engine.setGuideProps({ visible: false })
  ops = []
  runFrame()
  expect(ops.filter((op) => op.target === view && op.name === 'drawImage')).toHaveLength(1)
})

it.each([
  ['square', 1080, 1080, [0, 135, 1080, 810]],
  ['story', 1080, 1920, [0, 555, 1080, 810]],
  ['classic', 1200, 900, [0, 0, 1200, 900]],
])('a 4:3 template is contained and centred on the %s page', (_, width, height, rect) => {
  const { engine } = setup(width, height)
  const src = source()
  ops = []
  engine.setGuide(src)
  const draw = ops.find((op) => op.name === 'drawImage' && op.args[0] === src)!
  expect(draw.target.width).toBe(width)
  expect(draw.target.height).toBe(height)
  expect(draw.args.slice(1)).toEqual(rect)
})

it('clearing the guide removes it from the view', () => {
  const { engine, view } = setup()
  engine.setGuide(source())
  engine.setGuide(null)
  ops = []
  runFrame()
  expect(engine.guideState).toBeNull()
  expect(ops.filter((op) => op.target === view && op.name === 'drawImage')).toHaveLength(1)
})
