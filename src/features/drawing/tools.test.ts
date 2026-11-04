import { describe, expect, it } from 'vitest'
import { isCursorKind } from '@/components/toolCursors'
import { TOOLS, cursorKindOf } from './tools'

describe('cursorKindOf', () => {
  it('names a cursor sprite the engine knows for every tool of the rail', () => {
    for (const t of TOOLS) expect(isCursorKind(cursorKindOf(t.id)), t.id).toBe(true)
  })

  it('gives different tools different cursors (the cursor changes when the tool does)', () => {
    const own = TOOLS.filter((t) => !['watercolour', 'line', 'rect', 'ellipse'].includes(t.id))
    expect(new Set(own.map((t) => cursorKindOf(t.id))).size).toBe(own.length)
  })

  it('keeps the calligraphic brush for watercolour and a crosshair for the shape tools', () => {
    expect(cursorKindOf('watercolour')).toBe('brush')
    for (const s of ['line', 'rect', 'ellipse'] as const) expect(cursorKindOf(s)).toBe('crosshair')
  })

  it('the pencil is not the eraser is not the hand', () => {
    expect(new Set([cursorKindOf('pencil'), cursorKindOf('eraser'), cursorKindOf('hand')]).size).toBe(3)
  })
})
