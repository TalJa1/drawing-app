import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useSettings } from '@/store/settings'
import { useCoarsePointer, useReducedMotion } from '@/app/theme'

type Mode = 'dot' | 'hover' | 'brush' | 'text' | 'hidden'

const INTERACTIVE = 'a, button, [role="button"], [role="tab"], [role="switch"], label, select, summary, [data-cursor="hover"]'

/**
 * Paint-dot cursor for fine pointers. Grows over interactive elements and
 * hides itself over the drawing canvas (which renders its own brush preview).
 */
export function CustomCursor() {
  const enabled = useSettings((s) => s.customCursor)
  const coarse = useCoarsePointer()
  const reduced = useReducedMotion()
  const active = enabled && !coarse && !reduced
  const [mode, setMode] = useState<Mode>('hidden')
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 900, damping: 50, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 900, damping: 50, mass: 0.4 })

  useEffect(() => {
    if (!active) return
    document.documentElement.classList.add('art-cursor')
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x.set(e.clientX)
      y.set(e.clientY)
      const el = e.target as Element | null
      if (!el?.closest) return
      const cursorAttr = el.closest('[data-cursor]')?.getAttribute('data-cursor')
      if (cursorAttr === 'brush' || cursorAttr === 'none') setMode('hidden')
      else if (el.closest('input:not([type=range]):not([type=checkbox]):not([type=color]), textarea, [contenteditable="true"]')) setMode('text')
      else if (el.closest(INTERACTIVE)) setMode('hover')
      else setMode('dot')
    }
    const onLeave = () => setMode('hidden')
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      document.documentElement.classList.remove('art-cursor')
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [active, x, y])

  if (!active) return null

  const size = mode === 'hover' ? 44 : mode === 'text' ? 4 : 12
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[300] rounded-full"
      style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
      animate={{
        width: size,
        height: mode === 'text' ? 22 : size,
        opacity: mode === 'hidden' ? 0 : 1,
        backgroundColor: mode === 'hover' ? 'rgba(242,169,59,0.28)' : 'rgba(228,87,46,1)',
        borderWidth: mode === 'hover' ? 1.5 : 0,
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
    >
      <span className="absolute inset-0 rounded-full border-vermilion" style={{ borderWidth: 'inherit', borderStyle: 'solid' }} />
    </motion.div>
  )
}
