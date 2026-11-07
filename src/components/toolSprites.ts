/* The 3D artisan sprites of the tool cursors: what is known without drawing them (kinds, states, size, hotspots, pigment).
   The art itself (the SVG of each tool) is in toolSpriteArt.ts, which is a chunk of its own: the cursor engine is on every page,
   the pictures are only needed in the studio, so they are fetched the first time one is wanted.

   (Ported from "Art Spark tool cursor sprite studio"; see toolSpriteArt.ts for how the pictures differ from the studio's.) */
import type { CursorKind } from './toolCursors'

export type SpriteKind = Exclude<CursorKind, 'brush' | 'crosshair'>
export const SPRITE_KINDS: readonly SpriteKind[] = [
  'pencil',
  'pen',
  'marker',
  'airbrush',
  'chalk',
  'bucket',
  'eraser',
  'smudge',
  'eyedropper',
  'ruler',
  'square',
  'compass',
  'hand',
  'zoom',
]

const SPRITE_KIND_SET: ReadonlySet<string> = new Set(SPRITE_KINDS)
export const isSpriteKind = (k: string): k is SpriteKind => SPRITE_KIND_SET.has(k)

/** idle = floating over the paper, down = pressed (the tip touches), up = the elastic lift just after the release. */
export type SpriteState = 'idle' | 'down' | 'up'
export const SPRITE_STATES: readonly SpriteState[] = ['idle', 'down', 'up']

/** The picture's own coordinates (x, y, width, height). The studio draws in 0..110; the margin holds the shadow. */
export const SPRITE_VIEW = [-20, -20, 150, 150] as const

/** Size of one picture unit in CSS px: the studio's tools are ~80 units long, which makes ~35px, the size of the cursor's icons
    (24 units x 1.5 = 36px). */
export const SPRITE_SCALE = 0.44

/** The tip of each tool in picture units (the studio's TOOLS table; the chalk is drawn to the pencil's tip). */
export const SPRITE_HOTSPOT: Record<SpriteKind, readonly [number, number]> = {
  pencil: [20, 88],
  pen: [20, 88],
  marker: [21, 87],
  airbrush: [18, 84],
  chalk: [20, 88],
  bucket: [26, 86],
  eraser: [24, 85],
  smudge: [20, 88],
  eyedropper: [20, 88],
  ruler: [22, 86],
  square: [26, 82],
  compass: [30, 86],
  hand: [54, 56],
  zoom: [44, 44],
}

export interface SpritePigment {
  r: number
  g: number
  b: number
}

const byte = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0)
/** #RRGGBB from three numbers: nothing else ever reaches the markup. */
export function spriteHex(c: SpritePigment): string {
  return (
    '#' +
    [c.r, c.g, c.b]
      .map((v) => byte(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}
