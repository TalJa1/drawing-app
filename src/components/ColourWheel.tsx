import { useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { hexToHsv, hsvToHex, type HSV } from '@/lib/color'
import { cn } from '@/lib/utils'

/**
 * Hue ring + saturation/brightness square. Fully controllable by pointer
 * and keyboard (arrow keys; Shift for big steps).
 */
export function ColourWheel({
  value,
  onChange,
  onCommit,
  size = 232,
  className,
}: {
  value: string
  onChange: (hex: string) => void
  /** fired on pointer up / key up (e.g. to add to recents) */
  onCommit?: (hex: string) => void
  size?: number
  className?: string
}) {
  const { t } = useTranslation()
  const raw = hexToHsv(value)
  // greys have no hue: remember the last one so dragging back out keeps it
  const [lastHue, setLastHue] = useState(raw.h)
  const hsv: HSV = raw.s > 0.02 && raw.v > 0.02 ? raw : { ...raw, h: lastHue }
  const ringRef = useRef<HTMLDivElement>(null)
  const squareRef = useRef<HTMLDivElement>(null)
  const ring = size * 0.11
  const inner = size - ring * 2
  const sq = inner * 0.7

  const emit = (next: HSV) => {
    if (next.h !== lastHue) setLastHue(next.h)
    onChange(hsvToHex(next))
  }

  const onRing = (e: RPointerEvent) => {
    const r = ringRef.current!.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90
    emit({ ...hsv, h: (ang + 360) % 360, s: hsv.s || 0.7, v: hsv.v || 0.8 })
  }
  const onSquare = (e: RPointerEvent) => {
    const r = squareRef.current!.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))
    emit({ ...hsv, s, v })
  }
  const handle = (kind: 'ring' | 'square', e: RPointerEvent) => (kind === 'ring' ? onRing(e) : onSquare(e))

  const keyHue = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 3
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') emit({ ...hsv, h: (hsv.h + step) % 360 })
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') emit({ ...hsv, h: (hsv.h - step + 360) % 360 })
    else return
    e.preventDefault()
  }
  const keySquare = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02
    const c = (n: number) => Math.max(0, Math.min(1, n))
    if (e.key === 'ArrowRight') emit({ ...hsv, s: c(hsv.s + step) })
    else if (e.key === 'ArrowLeft') emit({ ...hsv, s: c(hsv.s - step) })
    else if (e.key === 'ArrowUp') emit({ ...hsv, v: c(hsv.v + step) })
    else if (e.key === 'ArrowDown') emit({ ...hsv, v: c(hsv.v - step) })
    else return
    e.preventDefault()
  }

  const hueAngle = ((hsv.h - 90) * Math.PI) / 180
  const thumbR = size / 2 - ring / 2
  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div className={cn('relative select-none', className)} style={{ width: size, height: size }}>
      <div
        ref={ringRef}
        className="absolute inset-0 touch-none rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #e8433c, #f0802e, #f2c14e, #a6c94a, #2e8b6f, #2aa5a1, #2f80c4, #3a3fa8, #7b4bb5, #c93c6b, #e8433c)',
          WebkitMask: `radial-gradient(circle, transparent ${inner / 2 - 1}px, #000 ${inner / 2}px)`,
          mask: `radial-gradient(circle, transparent ${inner / 2 - 1}px, #000 ${inner / 2}px)`,
          filter: 'saturate(1.05)',
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          handle('ring', e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) handle('ring', e)
        }}
        onPointerUp={() => onCommit?.(value)}
      />
      {/* paper grain on the ring for a pigment feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: 'var(--noise)',
          WebkitMask: `radial-gradient(circle, transparent ${inner / 2 - 1}px, #000 ${inner / 2}px)`,
          mask: `radial-gradient(circle, transparent ${inner / 2 - 1}px, #000 ${inner / 2}px)`,
        }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('colour.hue')}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={keyHue}
        onKeyUp={() => onCommit?.(value)}
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgb(0_0_0/0.5)]"
        style={{ left: size / 2 + Math.cos(hueAngle) * thumbR, top: size / 2 + Math.sin(hueAngle) * thumbR, background: pureHue }}
      />
      <div
        ref={squareRef}
        className="absolute touch-none overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
        style={{
          width: sq,
          height: sq,
          left: (size - sq) / 2,
          top: (size - sq) / 2,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          handle('square', e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) handle('square', e)
        }}
        onPointerUp={() => onCommit?.(value)}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('colour.saturationBrightness')}
          aria-valuetext={`${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s * 100)}
          onKeyDown={keySquare}
          onKeyUp={() => onCommit?.(value)}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgb(0_0_0/0.6)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}
        />
      </div>
    </div>
  )
}
