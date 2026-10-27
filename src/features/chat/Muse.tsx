import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, useChatVisibility } from './motion'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** The Art Spark muse: a friendly painter's palette with a brush tucked behind its ear. Original character. */
type MuseState = 'idle' | 'thinking' | 'speaking' | 'error'
type MuseProps = { size?: number; className?: string; thinking?: boolean; state?: MuseState; still?: boolean }

export function Muse({ state, thinking, ...props }: MuseProps) {
  const resolved = state ?? (thinking ? 'thinking' : 'idle')
  return <AnimatedMuse key={resolved} {...props} state={resolved} />
}

function AnimatedMuse({ size = 160, className, state, still = false }: MuseProps & { state: MuseState }) {
  const reduced = useReducedMotion()
  const visible = useChatVisibility()
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (state !== 'error') return
    const timer = setTimeout(() => setSettled(true), CHAT_MOTION.copyReset * 1000)
    return () => clearTimeout(timer)
  }, [state])
  const shown = state === 'error' && settled ? 'idle' : state
  const animate = !still && !reduced && visible
  const repeating = animate && shown !== 'error'
  return (
    <motion.svg
      viewBox="0 0 200 180"
      width={size}
      height={size * 0.9}
      className={cn('overflow-visible', className)}
      aria-hidden
      data-state={shown}
      style={!animate ? { transform: 'none' } : undefined}
      animate={
        !animate
          ? {}
          : shown === 'thinking'
            ? { rotate: [-2, 2, -2] }
            : shown === 'error'
              ? { rotate: [0, -3, 0] }
              : shown === 'speaking'
                ? { y: [0, -3, 0] }
                : { y: [0, -4, 0] }
      }
      transition={
        repeating
          ? { duration: shown === 'idle' ? CHAT_MOTION.idle : 1.4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: animate ? CHAT_MOTION.error : 0 }
      }
    >
      {/* brush behind the "ear" */}
      <motion.g
        transform="rotate(-28 150 40)"
        animate={repeating ? { rotate: [-28, -26, -28] } : {}}
        transition={repeating ? { duration: CHAT_MOTION.idle, repeat: Infinity } : { duration: 0 }}
      >
        <rect x="144" y="-6" width="10" height="70" rx="5" fill="#6b4f36" />
        <rect x="142" y="58" width="14" height="14" fill="#c9c1b0" />
        <path d="M142 72 C 142 92 156 92 156 72 Z" fill="#E4572E" />
      </motion.g>
      {/* palette body */}
      <path
        d="M100 22 C 160 18 190 60 184 104 C 178 146 132 168 92 162 C 52 156 16 132 14 92 C 12 66 30 50 52 52 C 70 54 74 70 64 80 C 56 88 60 100 74 100 C 96 100 92 70 86 54 C 80 36 76 24 100 22 Z"
        fill="#F6EBD7"
        stroke="#1B1A17"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* paint dabs */}
      <circle cx="132" cy="48" r="11" fill="#E4572E" />
      <circle cx="160" cy="80" r="10" fill="#F2A93B" />
      <circle cx="160" cy="116" r="10" fill="#2E8B6F" />
      <circle cx="130" cy="142" r="10" fill="#2F80C4" />
      <circle cx="94" cy="142" r="9" fill="#C93C6B" />
      {/* face */}
      <motion.g
        animate={repeating ? { scaleY: [1, 1, 0.1, 1] } : {}}
        transition={repeating ? { duration: CHAT_MOTION.idle, repeat: Infinity, times: [0, 0.9, 0.95, 1] } : { duration: 0 }}
        style={{ transformOrigin: '115px 96px' }}
      >
        <ellipse cx="104" cy="96" rx="5" ry="7" fill="#1B1A17" />
        <ellipse cx="128" cy="96" rx="5" ry="7" fill="#1B1A17" />
      </motion.g>
      <circle cx="96" cy="110" r="6" fill="#E4572E" opacity="0.25" />
      <circle cx="138" cy="110" r="6" fill="#E4572E" opacity="0.25" />
      <path d="M106 114 Q 116 124 126 114" fill="none" stroke="#1B1A17" strokeWidth="3.5" strokeLinecap="round" />
      {/* sparkles */}
      <path d="M30 26 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#D4AF37" />
      <path d="M186 160 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#D4AF37" />
    </motion.svg>
  )
}
