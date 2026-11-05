import { describe, expect, it } from 'vitest'
import { isCursorKind } from '@/components/toolCursors'
import { TOOLS, cursorKindOf } from './tools'

describe('cursorKindOf', () => {
  it('names a cursor sprite the engine knows for every tool of the rail', () => {
    for (const t of TOOLS) expect(isCursorKind(cursorKindOf(t.id)), t.id).toBe(true)
  })

  it('gives different tools different cursors (the cursor changes when the tool does)', () => {
    const own = TOOLS.filter((t) => t.id !== 'watercolour')
    expect(new Set(own.map((t) => cursorKindOf(t.id))).size).toBe(own.length)
  })

  it('keeps the calligraphic brush (the default cursor) for watercolour', () => {
    expect(cursorKindOf('watercolour')).toBe('brush')
  })

  it('gives the shape tools their drawing instruments: the ruler, the square and the compass', () => {
    expect(cursorKindOf('line')).toBe('ruler')
    expect(cursorKindOf('rect')).toBe('square')
    expect(cursorKindOf('ellipse')).toBe('compass')
  })

  it('the pencil is not the eraser is not the hand', () => {
    expect(new Set([cursorKindOf('pencil'), cursorKindOf('eraser'), cursorKindOf('hand')]).size).toBe(3)
  })
})
