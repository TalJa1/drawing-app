import { useEffect, useRef } from 'react'
import { useStudio } from '@/store/studio'
import { useCustomCursorActive, useReducedMotion } from '@/app/theme'
import { startBrushCursor, type BrushCursorHandle } from './brushCursorEngine'

/** The drawing canvas must stay clean: no watercolour ink from the cursor over it. */
const NO_INK_SELECTOR = '[data-brush-ink="off"]'

/**
 * Calligraphic brush cursor (fine pointers only), ported from the testbed.
 * The engine owns two fixed canvases (watercolour ink + brush sprite) and hides the
 * native cursor through `html.art-cursor`. Reduced motion keeps the sprite but drops
 * the watercolour effects and the sprite animation.
 *
 * The engine is started by the first mouse or pen movement, not when the page loads: a page that is still starting up
 * (scripts, fonts, entrance animations) has its main thread to itself, and a visitor who never moves a mouse never
 * pays for a cursor.
 */
export function CustomCursor() {
  const reduced = useReducedMotion()
  const color = useStudio((s) => s.color)
  const active = useCustomCursorActive()
  const handle = useRef<BrushCursorHandle | null>(null)

  useEffect(() => {
    if (!active) return
    let h: BrushCursorHandle | null = null
    const boot = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      window.removeEventListener('pointermove', boot, true)
      h = startBrushCursor({
        color: useStudio.getState().color,
        effects: !reduced,
        noInkSelector: NO_INK_SELECTOR,
      })
      handle.current = h
      h.feed(e) // the engine did not exist yet for this event: show the sprite where the pointer is now
    }
    window.addEventListener('pointermove', boot, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointermove', boot, true)
      h?.destroy()
      handle.current = null
    }
  }, [active, reduced])

  useEffect(() => {
    handle.current?.setColor(color)
  }, [color, active, reduced])

  return null
}
