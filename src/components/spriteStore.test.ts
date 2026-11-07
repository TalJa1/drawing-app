import { describe, expect, it, vi } from 'vitest'
import { createSpriteStore, type SpriteArt, type SpriteImage } from './spriteStore'
import { spriteSvg } from './toolSpriteArt'

/** The art, already in hand: the store then works synchronously, as the older tests expect. */
const art = (): SpriteArt => ({ spriteSvg })

const RED = { r: 224, g: 49, b: 49 }
const BLUE = { r: 38, g: 70, b: 200 }

/** A loader that the test settles by hand, so it decides the order in which sprites become ready. */
function manualLoader() {
  const calls: { svg: string; w: number; h: number; ok: (img: SpriteImage) => void; fail: (e: Error) => void }[] = []
  const load = vi.fn(
    (svg: string, w: number, h: number) =>
      new Promise<SpriteImage>((ok, fail) => {
        calls.push({ svg, w, h, ok, fail })
      }),
  )
  const image = (tag: string) => ({ tag, width: 1, height: 1 }) as unknown as SpriteImage
  const settle = async (i: number, tag = `img${i}`) => {
    calls[i].ok(image(tag))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }
  return { load, calls, image, settle }
}
const tagOf = (img: SpriteImage | null) => (img as unknown as { tag: string } | null)?.tag ?? null

describe('createSpriteStore', () => {
  it('answers null at once and tells the page when the sprite is ready', async () => {
    const { load, calls, settle } = manualLoader()
    const onReady = vi.fn()
    const store = createSpriteStore({ art, load, onReady })
    expect(store.get('pencil', 'idle', RED, 2)).toBeNull()
    expect(onReady).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    await settle(0, 'red-idle')
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(tagOf(store.get('pencil', 'idle', RED, 2))).toBe('red-idle')
    const rendered = load.mock.calls.length
    for (let i = 0; i < 10; i++) store.get('pencil', 'idle', RED, 2)
    expect(load.mock.calls.length, 'a ready sprite is not rendered again').toBe(rendered)
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  it('rasterises at the size of the picture in device pixels', () => {
    const { load, calls } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('pencil', 'idle', RED, 1)
    store.get('pencil', 'idle', RED, 2)
    expect(calls[0].w).toBeGreaterThan(0)
    expect(calls[0].h).toBe(calls[0].w)
    expect(calls[0].svg).toContain('<svg')
    // pigments are rendered in steps of 4 per channel: #E03131 becomes #E03030 (within 2 of 255, invisible on a 40px picture)
    expect(calls[0].svg).toContain('#E03030')
    // the second call has another dpr: another key, another raster, twice the pixels (the first one is still in flight)
    store.dispose()
  })

  it('does not ask twice for a sprite that is on its way', () => {
    const { load } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    for (let i = 0; i < 30; i++) store.get('eraser', 'idle', RED, 2)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('renders one sprite at a time, so the main thread is never flooded', async () => {
    const { load, calls, settle } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('pencil', 'idle', RED, 2) // starts; also queues the other two states of the pencil
    expect(load).toHaveBeenCalledTimes(1)
    await settle(0)
    expect(load).toHaveBeenCalledTimes(2)
    await settle(1)
    expect(load).toHaveBeenCalledTimes(3)
    expect(calls).toHaveLength(3)
  })

  it('keeps showing the last pigment of the same tool and state until the new one is ready (a colour drag does not flicker)', async () => {
    const { load, settle } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('marker', 'idle', RED, 2)
    await settle(0, 'red-idle')
    await settle(1)
    await settle(2) // the prefetched states
    const stand = store.get('marker', 'idle', BLUE, 2)
    expect(tagOf(stand), 'stand-in while blue renders').toBe('red-idle')
    await settle(3, 'blue-idle')
    expect(tagOf(store.get('marker', 'idle', BLUE, 2))).toBe('blue-idle')
  })

  it('shows the idle picture of the same pigment while a state has not been rendered yet', async () => {
    const { load, calls, settle } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('hand', 'idle', RED, 2)
    await settle(0, 'idle')
    // the prefetch is still queued: pressing now must not fall back to the old icon
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(tagOf(store.get('hand', 'down', RED, 2))).toBe('idle')
  })

  it('renders the newest request first and drops the stale ones when the colour changes faster than it renders', async () => {
    const { load, calls, settle } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('pen', 'idle', RED, 2) // in flight
    for (let i = 0; i < 40; i++) store.get('pen', 'idle', { r: 8 + i * 4, g: 20, b: 32 }, 2) // a colour drag
    await settle(0)
    // the next render is for the latest colour (r = 8 + 39 * 4 = 164 = 0xA4), not the first of the drag
    expect(calls[1].svg).toContain('#A41420')
    expect(load.mock.calls.length, 'not one render per colour of the drag').toBeLessThan(8)
  })

  it('treats colours a hair apart as one pigment', () => {
    const { load } = manualLoader()
    const store = createSpriteStore({ art, load, onReady: () => {} })
    store.get('chalk', 'idle', { r: 100, g: 100, b: 100 }, 2)
    store.get('chalk', 'idle', { r: 101, g: 99, b: 101 }, 2)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('forgets the sprites it has used least recently when it is full', async () => {
    const load = vi.fn(async (svg: string) => ({ tag: svg.length, width: 1, height: 1 }) as unknown as SpriteImage)
    const store = createSpriteStore({ art, load, onReady: () => {}, max: 3 })
    const flush = () => new Promise((r) => setTimeout(r, 0))
    for (const k of ['pencil', 'pen', 'marker', 'eraser'] as const) {
      store.get(k, 'idle', RED, 2)
      await flush()
      await flush()
      await flush()
      await flush()
    }
    const held = (['pencil', 'pen', 'marker', 'eraser'] as const).flatMap((k) =>
      (['idle', 'down', 'up'] as const).filter((s) => store.has(k, s, RED, 2)).map((s) => `${k}/${s}`),
    )
    expect(held.length, `holds ${held.join(', ')}`).toBe(3)
    expect(
      held.every((h) => h.startsWith('eraser/') || h.startsWith('marker/')),
      'the oldest tools were let go',
    ).toBe(true)
    expect(store.has('pencil', 'idle', RED, 2)).toBe(false)
  })

  it('gives up on a sprite that cannot be rendered, without trying again and again', async () => {
    const { load, calls } = manualLoader()
    const onReady = vi.fn()
    const store = createSpriteStore({ art, load, onReady })
    store.get('zoom', 'idle', RED, 2)
    // every try fails (the other two states are queued behind the first one): the queue drains, nothing is left waiting
    for (let i = 0; i < calls.length; i++) {
      calls[i].fail(new Error('decode failed'))
      for (let k = 0; k < 4; k++) await Promise.resolve()
    }
    const triesBefore = calls.length
    expect(triesBefore).toBe(3) // the idle try plus the prefetch of the two other states
    for (let i = 0; i < 20; i++) expect(store.get('zoom', 'idle', RED, 2)).toBeNull()
    for (let k = 0; k < 4; k++) await Promise.resolve()
    expect(calls, 'a sprite that failed is not tried again').toHaveLength(triesBefore)
    expect(onReady).not.toHaveBeenCalled()
  })

  it('stays quiet after dispose', async () => {
    const { load, settle } = manualLoader()
    const onReady = vi.fn()
    const store = createSpriteStore({ art, load, onReady })
    store.get('smudge', 'idle', RED, 2)
    store.dispose()
    await settle(0)
    expect(onReady).not.toHaveBeenCalled()
    expect(store.get('smudge', 'idle', RED, 2)).toBeNull()
  })
  describe('the art is fetched when a tool picture is first needed, not before', () => {
    const later = () => {
      let resolve!: (a: SpriteArt) => void
      let reject!: (e: Error) => void
      const promise = new Promise<SpriteArt>((ok, no) => {
        resolve = ok
        reject = no
      })
      const fetchArt = vi.fn(() => promise)
      return { fetchArt, resolve: () => resolve({ spriteSvg }), reject: (m = 'chunk failed') => reject(new Error(m)) }
    }
    const turns = async () => {
      for (let k = 0; k < 6; k++) await Promise.resolve()
    }

    it('does not ask for it when the store is made, and asks once, on the first sprite wanted', async () => {
      const { load, calls } = manualLoader()
      const a = later()
      const store = createSpriteStore({ art: a.fetchArt, load, onReady: () => {} })
      await turns()
      expect(a.fetchArt, 'nothing is fetched for a store that is never asked').not.toHaveBeenCalled()
      expect(store.get('pencil', 'idle', RED, 2)).toBeNull()
      store.get('eraser', 'idle', RED, 2)
      store.get('zoom', 'down', BLUE, 2)
      expect(a.fetchArt).toHaveBeenCalledTimes(1)
      expect(load, 'nothing is drawn before the art is here').not.toHaveBeenCalled()
      a.resolve()
      await turns()
      expect(calls.length, 'then the waiting sprites are drawn').toBeGreaterThan(0)
      expect(a.fetchArt, 'still one fetch').toHaveBeenCalledTimes(1)
    })

    it('draws the newest request first once the art arrives, as when it was already there', async () => {
      const { load, calls } = manualLoader()
      const a = later()
      const store = createSpriteStore({ art: a.fetchArt, load, onReady: () => {} })
      store.get('pencil', 'idle', RED, 2)
      store.get('pencil', 'idle', BLUE, 2) // the newest
      a.resolve()
      await turns()
      expect(calls[0].svg, 'the first sprite drawn is the newest colour').toContain('#2848C8')
    })

    it('keeps the old icon (null) and does not ask again when the art cannot be fetched', async () => {
      const { load, calls } = manualLoader()
      const onReady = vi.fn()
      const a = later()
      const store = createSpriteStore({ art: a.fetchArt, load, onReady })
      store.get('pencil', 'idle', RED, 2)
      a.reject()
      await turns()
      for (let i = 0; i < 10; i++) expect(store.get('pencil', 'idle', RED, 2)).toBeNull()
      store.get('marker', 'idle', BLUE, 2)
      await turns()
      expect(a.fetchArt, 'one failed fetch is the answer for good').toHaveBeenCalledTimes(1)
      expect(calls).toHaveLength(0)
      expect(onReady).not.toHaveBeenCalled()
    })

    it('stays quiet when disposed while the art is on its way', async () => {
      const { load, calls } = manualLoader()
      const onReady = vi.fn()
      const a = later()
      const store = createSpriteStore({ art: a.fetchArt, load, onReady })
      store.get('pencil', 'idle', RED, 2)
      store.dispose()
      a.resolve()
      await turns()
      expect(calls).toHaveLength(0)
      expect(onReady).not.toHaveBeenCalled()
    })
  })
})
