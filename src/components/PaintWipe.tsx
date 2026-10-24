import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const COLOURS = ['var(--saffron)', 'var(--vermilion)', 'var(--cerulean)', 'var(--viridian)', 'var(--rose)']

/**
 * A quick brush sweep across the screen on route change (≤ 600 ms).
 * Purely decorative: pointer-events none, hidden from assistive tech.
 */
export function PaintWipe({ routeKey }: { routeKey: string }) {
  const first = useRef(true)
  const [wipe, setWipe] = useState<{ id: string; color: string } | null>(null)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = window.setTimeout(() => {
      setWipe({ id: routeKey, color: COLOURS[routeKey.length % COLOURS.length] })
    }, 0)
    const done = window.setTimeout(() => setWipe(null), 650)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(done)
    }
  }, [routeKey])

  return (
    <AnimatePresence>
      {wipe && (
        <motion.div
          key={wipe.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[85] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <motion.svg
            viewBox="0 0 1400 400"
            preserveAspectRatio="none"
            className="absolute left-0 top-1/2 h-[120vh] w-[220vw] -translate-y-1/2"
            initial={{ x: '-110%' }}
            animate={{ x: '60%' }}
            transition={{ duration: 0.58, ease: [0.65, 0, 0.35, 1] }}
          >
            <path
              d="M0 120c120-60 300-90 520-80s360 40 560 30 260-30 320-20v260c-80-10-180 20-340 24-200 6-380-40-580-30S120 360 0 330z"
              fill={wipe.color}
              opacity="0.9"
              filter="url(#wash-edge)"
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
