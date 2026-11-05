import { describe, expect, it } from 'vitest'
import { CURSOR_KINDS } from './toolCursors'
import { SPRITE_HOTSPOT, SPRITE_KINDS, SPRITE_STATES, SPRITE_VIEW, spriteHex, type SpriteState } from './toolSprites'
import { spriteSvg } from './toolSpriteArt'
import constantsSource from './toolSprites.ts?raw'
import storeSource from './spriteStore.ts?raw'
import engineSource from './brushCursorEngine.ts?raw'

const RED = { r: 224, g: 49, b: 49 } // #E03131, the studio's reference pigment
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml')

describe('which tools have a sprite', () => {
  it('is every cursor kind but the engine-drawn brush and the fallback crosshair', () => {
    const expected = CURSOR_KINDS.filter((k) => k !== 'brush' && k !== 'crosshair')
    expect([...SPRITE_KINDS].sort()).toEqual([...expected].sort())
    expect(SPRITE_KINDS).toHaveLength(14)
  })

  it('has the studio’s three states', () => {
    expect([...SPRITE_STATES]).toEqual(['idle', 'down', 'up'])
  })
})

describe('spriteHex', () => {
  it('writes a pigment as upper-case #RRGGBB', () => {
    expect(spriteHex(RED)).toBe('#E03131')
    expect(spriteHex({ r: 0, g: 5, b: 255 })).toBe('#0005FF')
  })

  it('never lets anything but three byte values into the markup', () => {
    expect(spriteHex({ r: 300, g: -4, b: 12.7 })).toBe('#FF000D')
    expect(spriteHex({ r: NaN, g: Infinity, b: 1 })).toMatch(/^#[0-9A-F]{6}$/)
  })
})

describe('spriteSvg: every sprite is a picture that stands on its own', () => {
  for (const kind of SPRITE_KINDS) {
    for (const state of SPRITE_STATES) {
      it(`${kind} / ${state}: well-formed, every reference resolves inside the picture, nothing that an <img> cannot run`, () => {
        const svg = spriteSvg(kind, state, RED)
        const doc = parse(svg)
        expect(doc.querySelector('parsererror'), 'it is well-formed XML').toBeNull()
        const root = doc.documentElement
        expect(root.tagName).toBe('svg')
        expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg')
        expect(root.getAttribute('viewBox')).toBe(SPRITE_VIEW.join(' '))
        // Firefox cannot draw an SVG image into a canvas unless the root names its own size
        expect(root.getAttribute('width')).toBe(String(SPRITE_VIEW[2]))
        expect(root.getAttribute('height')).toBe(String(SPRITE_VIEW[3]))

        // gradients and filters live in the same file (the studio shared them through the page: an <img> cannot)
        const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1])
        expect(refs.length, 'it uses the shared materials').toBeGreaterThan(0)
        for (const id of new Set(refs)) expect(doc.getElementById(id), `#${id} is defined in the picture`).not.toBeNull()

        // things that would not run, or would be unsafe, inside an image
        expect(svg).not.toMatch(/<script|<style|foreignObject|\sclass=|\sstyle=|href=|@import|@keyframes|on\w+=/i)
        expect(svg, 'CSS filter functions are not SVG attributes in every engine').not.toMatch(/filter="(blur|drop-shadow)/)
        expect(svg).not.toMatch(/\$\{|undefined|NaN|\[object/)
      })
    }
  }
})

describe('spriteSvg: pigment', () => {
  it('shows the exact pigment on every sprite in every state, except the eraser (a rubber has none)', () => {
    for (const kind of SPRITE_KINDS) {
      for (const state of SPRITE_STATES) {
        const svg = spriteSvg(kind, state, RED)
        if (kind === 'eraser') expect(svg, `${kind}/${state}`).not.toContain('#E03131')
        else expect(svg, `${kind}/${state}`).toContain('#E03131')
      }
    }
  })

  it('changes with the pigment and with nothing else', () => {
    const teal = { r: 38, g: 70, b: 83 }
    for (const kind of SPRITE_KINDS) {
      if (kind === 'eraser') continue
      const a = spriteSvg(kind, 'idle', RED)
      const b = spriteSvg(kind, 'idle', teal)
      expect(b, kind).not.toBe(a)
      expect(b.replaceAll('#264653', '#E03131'), `${kind} differs only by the pigment`).toBe(a)
    }
  })
})

describe('spriteSvg: the three states', () => {
  it('are three different pictures of every tool', () => {
    for (const kind of SPRITE_KINDS) {
      const pictures = SPRITE_STATES.map((s) => spriteSvg(kind, s, RED))
      expect(new Set(pictures).size, kind).toBe(3)
    }
  })

  const shadow = (kind: (typeof SPRITE_KINDS)[number], state: SpriteState) => {
    const doc = parse(spriteSvg(kind, state, RED))
    const offset = doc.querySelector('feOffset')
    return { dx: Number(offset?.getAttribute('dx')), dy: Number(offset?.getAttribute('dy')) }
  }

  it('cast the paper shadow of the studio: floating +8/+10, on the paper +2/+2.5, rebound +11/+13', () => {
    for (const kind of SPRITE_KINDS) {
      expect(shadow(kind, 'idle'), `${kind} idle`).toEqual({ dx: 8, dy: 10 })
      expect(shadow(kind, 'down'), `${kind} down`).toEqual({ dx: 2, dy: 2.5 })
      expect(shadow(kind, 'up'), `${kind} up`).toEqual({ dx: 11, dy: 13 })
    }
  })

  it('the pressed tool sits lower on the paper than the floating one', () => {
    for (const kind of SPRITE_KINDS) {
      expect(shadow(kind, 'down').dy, kind).toBeLessThan(shadow(kind, 'idle').dy)
      expect(shadow(kind, 'up').dy, kind).toBeGreaterThan(shadow(kind, 'idle').dy)
    }
  })
})

describe('SPRITE_HOTSPOT', () => {
  it('is the studio’s tip of every tool, inside the picture', () => {
    expect(Object.keys(SPRITE_HOTSPOT).sort()).toEqual([...SPRITE_KINDS].sort())
    const [vx, vy, vw, vh] = SPRITE_VIEW
    for (const kind of SPRITE_KINDS) {
      const [x, y] = SPRITE_HOTSPOT[kind]
      expect(x, kind).toBeGreaterThan(vx)
      expect(x, kind).toBeLessThan(vx + vw)
      expect(y, kind).toBeGreaterThan(vy)
      expect(y, kind).toBeLessThan(vy + vh)
    }
    // values of the studio's TOOLS table (hotspot of each tool in its 110x110 sprite)
    expect(SPRITE_HOTSPOT.pencil).toEqual([20, 88])
    expect(SPRITE_HOTSPOT.pen).toEqual([20, 88])
    expect(SPRITE_HOTSPOT.marker).toEqual([21, 87])
    expect(SPRITE_HOTSPOT.airbrush).toEqual([18, 84])
    expect(SPRITE_HOTSPOT.bucket).toEqual([26, 86])
    expect(SPRITE_HOTSPOT.eraser).toEqual([24, 85])
    expect(SPRITE_HOTSPOT.smudge).toEqual([20, 88])
    expect(SPRITE_HOTSPOT.eyedropper).toEqual([20, 88])
    expect(SPRITE_HOTSPOT.ruler).toEqual([22, 86])
    expect(SPRITE_HOTSPOT.square).toEqual([26, 82])
    expect(SPRITE_HOTSPOT.compass).toEqual([30, 86])
    expect(SPRITE_HOTSPOT.hand).toEqual([54, 56])
    expect(SPRITE_HOTSPOT.zoom).toEqual([44, 44])
  })
})

describe('what every page loads and what only the studio loads', () => {
  // The 3D art is ~25 KB of markup: pages that never show a tool picture must not carry it (it is its own chunk, fetched on first use).
  it('the always-loaded constants hold no art', () => {
    expect(constantsSource).not.toMatch(/<svg|linearGradient|feGaussianBlur|walnut/)
    expect(constantsSource).not.toMatch(/from '\.\/toolSpriteArt'/)
  })

  it('the cursor engine and the sprite store reach the art only through a dynamic import()', () => {
    for (const [name, source] of [
      ['spriteStore', storeSource],
      ['brushCursorEngine', engineSource],
    ] as const) {
      expect(source, `${name} must not import the art statically`).not.toMatch(/^\s*import[^;]*from\s+'\.\/toolSpriteArt'/m)
    }
    expect(storeSource).toMatch(/import\('\.\/toolSpriteArt'\)/)
  })
})
