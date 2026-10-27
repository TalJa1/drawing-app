import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** The Art Spark muse: a friendly painter's palette with a brush tucked behind its ear. Original character. */
export function Muse({
  size = 160,
  className,
  thinking,
  still = false,
}: {
  size?: number
  className?: string
  thinking?: boolean
  still?: boolean
}) {
  return (
    <motion.svg
      viewBox="0 0 200 180"
      width={size}
      height={size * 0.9}
      className={cn('overflow-visible', className)}
      aria-hidden
      animate={still ? {} : thinking ? { rotate: [-2, 2, -2] } : { y: [0, -6, 0] }}
      transition={{ duration: thinking ? 1.2 : 4, repeat: still ? 0 : Infinity, ease: 'easeInOut' }}
    >
      {/* brush behind the "ear" */}
      <g transform="rotate(-28 150 40)">
        <rect x="144" y="-6" width="10" height="70" rx="5" fill="#6b4f36" />
        <rect x="142" y="58" width="14" height="14" fill="#c9c1b0" />
        <path d="M142 72 C 142 92 156 92 156 72 Z" fill="#E4572E" />
      </g>
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
        animate={still ? {} : { scaleY: [1, 1, 0.1, 1] }}
        transition={{ duration: 4, repeat: still ? 0 : Infinity, times: [0, 0.9, 0.95, 1] }}
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
