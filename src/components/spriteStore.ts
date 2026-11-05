/* Renders the tool sprites into small canvases, once, and keeps them.

   A sprite is an SVG (toolSprites.ts); painting it from SVG on every change would cost far more than the cursor may. So each
   (tool, state, pigment, pixel ratio) is rasterised one time, off to the side, and the cursor then only blits the finished
   canvas. Nothing here runs per frame:
    - one sprite is rendered at a time and the newest request goes first, so a colour drag renders the colour it ends on,
      not every colour it passed through;
    - until a sprite is ready, `get` hands back the best stand-in (the same tool in the previous pigment, or the same pigment
      in another state), so the cursor never flashes back to the old icon;
    - pigments a hair apart are one sprite (steps of 4 of 255 per channel, below what the eye tells apart on a 40px picture);
    - the store is bounded (least recently used goes first) and gives up on a sprite that fails to render. */
import { SPRITE_SCALE, SPRITE_STATES, SPRITE_VIEW, type SpriteKind, type SpritePigment, type SpriteState } from './toolSprites'

/** The drawn art (toolSpriteArt.ts). It is not imported here: it is its own chunk, fetched when a picture is first needed. */
export interface SpriteArt {
  spriteSvg: (kind: SpriteKind, state: SpriteState, pigment: SpritePigment) => string
}
const fetchSpriteArt = (): Promise<SpriteArt> => import('./toolSpriteArt')

export type SpriteImage = CanvasImageSource & { width: number; height: number }

export interface SpriteStoreOptions {
  /** Draws an SVG into a canvas of w x h device pixels. */
  load: (svg: string, w: number, h: number) => Promise<SpriteImage>
  /** Brings the art (default: the toolSpriteArt chunk). Asked for once, the first time a picture is needed; a failure is final. */
  art?: () => SpriteArt | Promise<SpriteArt>
  /** Called when a sprite that `get` had to stand in for is ready: the cursor should be painted again. */
  onReady: () => void
  /** How many sprites to keep (default 48: 14 tools x 3 states is 42, for one pigment). */
  max?: number
}

export interface SpriteStore {
  /** The picture to paint now for this sprite: the exact one when it is ready, else the best stand-in, else null. */
  get: (kind: SpriteKind, state: SpriteState, pigment: SpritePigment, dpr: number) => SpriteImage | null
  has: (kind: SpriteKind, state: SpriteState, pigment: SpritePigment, dpr: number) => boolean
  dispose: () => void
}

const STEP = 4
const quant = (v: number) => Math.min(255, Math.max(0, Math.round((Number.isFinite(v) ? v : 0) / STEP) * STEP))
/** Most waiting requests kept; older ones are the pigments a drag has already left behind. */
const MAX_WAITING = 4

interface Request {
  key: string
  kind: SpriteKind
  state: SpriteState
  rgb: SpritePigment
  dpr: number
}

export function createSpriteStore({ load, onReady, max = 48, art = fetchSpriteArt }: SpriteStoreOptions): SpriteStore {
  const ready = new Map<string, SpriteImage>()
  const failed = new Set<string>()
  const waiting: Request[] = []
  const prefetched = new Set<SpriteKind>()
  /** key of the newest ready sprite of a tool+state / of a tool (any state), for stand-ins */
  const lastOf = new Map<string, string>()
  let busy = false
  let dead = false
  let artIn: SpriteArt | null = null
  let artLost = false
  let artPending = false

  const colourKey = (c: SpritePigment) => `${quant(c.r)},${quant(c.g)},${quant(c.b)}`
  const dprKey = (dpr: number) => Math.round((dpr || 1) * 100) / 100
  const keyOf = (kind: SpriteKind, state: SpriteState, c: SpritePigment, dpr: number) => `${kind}|${state}|${colourKey(c)}|${dprKey(dpr)}`

  function remember(key: string, kind: SpriteKind, state: SpriteState, img: SpriteImage) {
    ready.set(key, img)
    lastOf.set(`${kind}|${state}`, key)
    lastOf.set(kind, key)
    while (ready.size > max) {
      const oldest = ready.keys().next().value as string
      ready.delete(oldest)
    }
  }

  function render(next: Request, a: SpriteArt, done: () => void) {
    const px = Math.round(SPRITE_VIEW[2] * SPRITE_SCALE * next.dpr)
    let promise: Promise<SpriteImage>
    try {
      const svg = a.spriteSvg(next.kind, next.state, { r: quant(next.rgb.r), g: quant(next.rgb.g), b: quant(next.rgb.b) })
      promise = load(svg, px, px)
    } catch (e) {
      promise = Promise.reject(e)
    }
    promise.then(
      (img) => {
        if (!dead) {
          remember(next.key, next.kind, next.state, img)
          onReady()
        }
        done()
      },
      () => {
        failed.add(next.key)
        done()
      },
    )
  }

  /** Brings the art in once; whoever is waiting is then picked newest-first, as if the art had always been there. */
  function fetchArt() {
    if (artPending) return
    artPending = true
    const arrived = (a: SpriteArt) => {
      artIn = a
      artPending = false
      pump()
    }
    const lost = () => {
      artLost = true // the old icon stays; one failed fetch is final (no refetching on every colour change)
      artPending = false
      pump()
    }
    let got: SpriteArt | Promise<SpriteArt>
    try {
      got = art()
    } catch {
      return lost()
    }
    if (got instanceof Promise) got.then(arrived, lost)
    else arrived(got)
  }

  function pump() {
    if (busy || dead) return
    if (!artIn && !artLost) {
      if (waiting.length) fetchArt()
      return
    }
    const next = waiting.pop() // the newest request first
    if (!next) return
    if (!artIn) {
      failed.add(next.key) // the art could not be fetched: this picture cannot be drawn
      return pump()
    }
    busy = true
    render(next, artIn, () => {
      busy = false
      pump()
    })
  }

  function enqueue(r: Request) {
    if (dead || ready.has(r.key) || failed.has(r.key)) return
    const queued = waiting.findIndex((w) => w.key === r.key)
    if (queued >= 0) waiting.splice(queued, 1) // asked for again: it is the newest request now
    waiting.push(r)
    while (waiting.length > MAX_WAITING) waiting.shift()
  }

  function standIn(kind: SpriteKind, state: SpriteState, c: SpritePigment, dpr: number): SpriteImage | null {
    const sameState = lastOf.get(`${kind}|${state}`)
    if (sameState && ready.has(sameState)) return ready.get(sameState)!
    for (const other of ['idle', 'up', 'down'] as const) {
      const k = keyOf(kind, other, c, dpr)
      if (other !== state && ready.has(k)) return ready.get(k)!
    }
    const anyOf = lastOf.get(kind)
    return anyOf && ready.has(anyOf) ? ready.get(anyOf)! : null
  }

  return {
    get(kind, state, rgb, dpr) {
      if (dead) return null
      const key = keyOf(kind, state, rgb, dpr)
      const hit = ready.get(key)
      if (hit) {
        ready.delete(key) // touch: now the most recently used
        ready.set(key, hit)
        return hit
      }
      if (!prefetched.has(kind)) {
        // the first time a tool is seen, queue its other states too, so a press finds its picture ready
        prefetched.add(kind)
        for (const s of SPRITE_STATES) if (s !== state) enqueue({ key: keyOf(kind, s, rgb, dpr), kind, state: s, rgb, dpr })
      }
      enqueue({ key, kind, state, rgb, dpr }) // queued last: it is the newest, so it is rendered first
      pump()
      return standIn(kind, state, rgb, dpr)
    },
    has: (kind, state, rgb, dpr) => ready.has(keyOf(kind, state, rgb, dpr)),
    dispose() {
      dead = true
      ready.clear()
      waiting.length = 0
    },
  }
}

/** The real loader: the SVG becomes an image, the image is drawn once into a canvas of the final size. */
export function rasterizeSprite(svg: string, w: number, h: number): Promise<SpriteImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const g = canvas.getContext('2d')
        if (!g) throw new Error('no 2d context')
        g.drawImage(img, 0, 0, w, h)
        resolve(canvas)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('the sprite could not be decoded'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
