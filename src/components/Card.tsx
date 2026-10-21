import { useRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/app/theme'

export function Card({
  className,
  children,
  paper = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { paper?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[22px] border border-line shadow-paper',
        paper ? 'paper' : 'bg-card',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Subtle 3D tilt that follows the pointer. Disabled for reduced motion / touch. */
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)
  const sx = useSpring(x, { stiffness: 200, damping: 20 })
  const sy = useSpring(y, { stiffness: 200, damping: 20 })
  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max, -max])
  const glare = useTransform(
    [sx, sy] as never,
    ([gx, gy]: number[]) =>
      `radial-gradient(400px circle at ${gx * 100}% ${gy * 100}%, rgb(255 255 255 / 0.18), transparent 50%)`,
  )

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={cn('relative [transform-style:preserve-3d]', className)}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - r.left) / r.width)
        y.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => {
        x.set(0.5)
        y.set(0.5)
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
        style={{ background: glare }}
      />
    </motion.div>
  )
}
