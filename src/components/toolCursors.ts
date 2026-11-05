/* Per-tool cursor sprites for the brush cursor engine.

   The shapes are the same glyphs the tool rail shows (lucide-react 1.60.0, ISC licence), copied here as SVG path data so the
   engine can paint them into its canvas with Path2D without importing React components. Each icon is a list of separate
   paths: lucide's relative `m` commands are relative to the origin of their own path, so they must not be joined. */

/** What the sprite looks like. `brush` is the calligraphic brush that is drawn by the engine itself. `ruler`, `square` and
    `compass` (the shape tools) have no glyph: until their picture is ready (see toolSprites) they show the crosshair. */
export type CursorKind =
  | 'brush'
  | 'pencil'
  | 'pen'
  | 'marker'
  | 'airbrush'
  | 'chalk'
  | 'eraser'
  | 'smudge'
  | 'bucket'
  | 'eyedropper'
  | 'crosshair'
  | 'ruler'
  | 'square'
  | 'compass'
  | 'hand'
  | 'zoom'

export const CURSOR_KINDS: readonly CursorKind[] = [
  'brush',
  'pencil',
  'pen',
  'marker',
  'airbrush',
  'chalk',
  'eraser',
  'smudge',
  'bucket',
  'eyedropper',
  'crosshair',
  'ruler',
  'square',
  'compass',
  'hand',
  'zoom',
]

export function isCursorKind(v: unknown): v is CursorKind {
  return typeof v === 'string' && (CURSOR_KINDS as readonly string[]).includes(v)
}

type GlyphKind = Exclude<CursorKind, 'brush' | 'crosshair' | 'ruler' | 'square' | 'compass'>

const GLYPH_PATHS: Record<GlyphKind, string[]> = {
  pencil: [
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    'm15 5 4 4',
  ],
  pen: [
    'm18 13-.654-4.736a4 4 0 00-2.756-3.266l-9.163-2.9a2 2 0 00-2.017.493l-.82.819a2 2 0 00-.492 2.017l2.9 9.163a4 4 0 003.266 2.756L13 18',
    'M18.648 12.352a1.205 1.205 0 011.704 0l1.296 1.296a1.205 1.205 0 010 1.704l-6.296 6.296a1.205 1.205 0 01-1.704 0l-1.296-1.296a1.205 1.205 0 010-1.704z',
    'm3 3 6.586 6.586',
    'M9 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  marker: ['m9 11-6 6v3h9l3-3', 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'],
  airbrush: [
    'M3 3h.01',
    'M7 5h.01',
    'M11 7h.01',
    'M3 7h.01',
    'M7 9h.01',
    'M3 11h.01',
    'M15 5h4v4h-4z',
    'm19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2',
    'm13 14 8-2',
    'm13 19 8-2',
  ],
  chalk: [
    'm11 10 3 3',
    'M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z',
    'M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031',
  ],
  bucket: [
    'M11 7 6 2',
    'M18.992 12H2.041',
    'M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595',
    'm8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33',
  ],
  eraser: [
    'M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21',
    'm5.082 11.09 8.828 8.828',
  ],
  smudge: [
    'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
    'M14 13.12c0 2.38 0 6.38-1 8.88',
    'M17.29 21.02c.12-.6.43-2.3.5-3.02',
    'M2 12a10 10 0 0 1 18-6',
    'M2 16h.01',
    'M21.8 16c.2-2 .131-5.354 0-6',
    'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
    'M8.65 22c.21-.66.45-1.32.57-2',
    'M9 6.8a6 6 0 0 1 9 5.2v2',
  ],
  eyedropper: [
    'm12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12',
    'm18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z',
    'm2 22 .414-.414',
  ],
  hand: [
    'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
    'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2',
    'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8',
    'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ],
  zoom: ['M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0', 'M21 21L16.65 16.65', 'M11 8L11 14', 'M8 11L14 11'],
}

/** The point of each glyph that sits exactly under the pointer, in the icon's own 24x24 units. */
const HOTSPOT: Record<GlyphKind, readonly [number, number]> = {
  pencil: [3, 21],
  pen: [3, 3],
  marker: [4, 20],
  airbrush: [6, 7],
  chalk: [4, 20],
  bucket: [3, 12],
  eraser: [6, 18],
  smudge: [12, 12],
  eyedropper: [3, 21],
  hand: [12, 12],
  zoom: [11, 11],
}

/** Kinds that put ink on the page: they carry a swatch of the pigment, so the cursor shows the colour that will be drawn. */
const SWATCH_KINDS: ReadonlySet<CursorKind> = new Set<CursorKind>([
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
])
export const hasSwatch = (k: CursorKind) => SWATCH_KINDS.has(k)

/** Where the pigment swatch sits relative to the hotspot; the default (down and right) is free space for most glyphs. */
const SWATCH_AT: Partial<Record<CursorKind, readonly [number, number]>> = {
  airbrush: [0, 17],
  bucket: [-4, 16],
}

const paths = new Map<GlyphKind, Path2D[]>()
function glyphPaths(kind: GlyphKind): Path2D[] {
  let p = paths.get(kind)
  if (!p) {
    p = GLYPH_PATHS[kind].map((d) => new Path2D(d))
    paths.set(kind, p)
  }
  return p
}

export interface SpriteColour {
  r: number
  g: number
  b: number
}

const INK = '#1b1612'
const HALO = 'rgba(255, 252, 245, 0.96)'

/** A round swatch of the pigment with a light ring and a dark rim, so it reads on any background. */
function swatch(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, c: SpriteColour) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.lineWidth = 3
  ctx.strokeStyle = HALO
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`
  ctx.fill()
}

/**
 * Paints the sprite of a tool with its hotspot at (tipX, tipY). `scale` is the size of one icon unit in px
 * (the brush cursor's CURSOR_SCALE, so every cursor is the same 1.5x size).
 */
export function drawToolSprite(
  ctx: CanvasRenderingContext2D,
  kind: Exclude<CursorKind, 'brush'>,
  tipX: number,
  tipY: number,
  colour: SpriteColour,
  scale: number,
  pressed: boolean,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'crosshair' || kind === 'ruler' || kind === 'square' || kind === 'compass') {
    const arm = 11
    const gap = 4
    ctx.beginPath()
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      ctx.moveTo(tipX + dx * gap, tipY + dy * gap)
      ctx.lineTo(tipX + dx * arm, tipY + dy * arm)
    }
    ctx.lineWidth = 4
    ctx.strokeStyle = HALO
    ctx.stroke()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = INK
    ctx.stroke()
    swatch(ctx, tipX, tipY, pressed ? 3.4 : 2.6, colour)
    ctx.restore()
    return
  }
  const [hx, hy] = HOTSPOT[kind]
  ctx.translate(tipX, tipY)
  ctx.scale(scale, scale)
  ctx.translate(-hx, -hy)
  const list = glyphPaths(kind)
  ctx.lineWidth = 2 + 3.4 / scale
  ctx.strokeStyle = HALO
  for (const p of list) ctx.stroke(p)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  for (const p of list) ctx.stroke(p)
  ctx.restore()
  if (SWATCH_KINDS.has(kind)) {
    const [dx, dy] = SWATCH_AT[kind] ?? [12, 12]
    swatch(ctx, tipX + dx, tipY + dy, pressed ? 5.4 : 4.6, colour)
  }
}
