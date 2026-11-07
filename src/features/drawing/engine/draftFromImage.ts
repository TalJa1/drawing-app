import type { Draft } from './types'

/**
 * Wrap a saved picture as a draft the engine can `load`, so the studio can carry on from it.
 *
 * The server keeps only the flattened PNG (background included), not the layers or the strokes, so
 * the picture comes back as ONE paint layer. `strokes` is 1 on purpose: the engine calls a drawing
 * with no strokes empty, and an empty drawing can neither be saved nor autosaved.
 */
export function draftFromImage(image: Blob, width: number, height: number): Draft {
  const id = 'saved-picture'
  return {
    version: 1,
    width,
    height,
    background: 'white',
    layers: [{ meta: { id, name: 'Layer 1', visible: true, opacity: 1, blend: 'normal', locked: false, kind: 'paint' }, image }],
    activeLayerId: id,
    savedAt: new Date().toISOString(),
    seconds: 0,
    strokes: 1,
  }
}
