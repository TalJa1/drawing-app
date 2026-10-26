import { useEffect, useRef } from 'react'
import { useSettings } from '@/store/settings'
import { useStudio } from '@/store/studio'
import { useCoarsePointer, useReducedMotion } from '@/app/theme'
import { startBrushCursor, type BrushCursorHandle } from './brushCursorEngine'

/** The drawing canvas must stay clean: no watercolour ink from the cursor over it. */
const NO_INK_SELECTOR = '[data-brush-ink="off"]'

/**
 * Calligraphic brush cursor (fine pointers only), ported from the testbed.
 * The engine owns two fixed canvases (watercolour ink + brush sprite) and hides the
 * native cursor through `html.art-cursor`. Reduced motion keeps the sprite but drops
 * the watercolour effects and the sprite animation.
 */
export function CustomCursor() {
  const enabled = useSettings((s) => s.customCursor)
  const coarse = useCoarsePointer()
  const reduced = useReducedMotion()
  const color = useStudio((s) => s.color)
  const active = enabled && !coarse
  const handle = useRef<BrushCursorHandle | null>(null)

  useEffect(() => {
    if (!active) return
    const h = startBrushCursor({
      color: useStudio.getState().color,
      effects: !reduced,
      noInkSelector: NO_INK_SELECTOR,
    })
    handle.current = h
    return () => {
      h.destroy()
      handle.current = null
    }
  }, [active, reduced])

  useEffect(() => {
    handle.current?.setColor(color)
  }, [color, active, reduced])

  return null
}
