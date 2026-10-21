import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const INKS = ['#E4572E', '#2F80C4', '#2E8B6F', '#C93C6B', '#F2A93B', '#3A3FA8']
const LIFE = 4200

interface Stroke {
  color: string
  pts: { x: number; y: number; t: number }[]
}

/** A tiny doodle pad in the hero: strokes fade out slowly like ink drying. */
export function HeroDoodle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const strokes: Stroke[] = []
    let drawing: Stroke | null = null
    let raf = 0
    let colour = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const size = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    const render = () => {
      raf = 0
      const now = performance.now()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i]
        const last = s.pts[s.pts.length - 1]
        if (s !== drawing && now - last.t > LIFE) {
          strokes.splice(i, 1)
          continue
        }
        ctx.strokeStyle = s.color
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        for (let k = 1; k < s.pts.length; k++) {
          const a = s.pts[k - 1]
          const b = s.pts[k]
          const age = now - b.t
          ctx.globalAlpha = Math.max(0, 1 - age / LIFE) * 0.9
          const speed = Math.hypot(b.x - a.x, b.y - a.y)
          ctx.lineWidth = Math.max(2.5, 9 - speed * 0.25)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      if (strokes.length) raf = requestAnimationFrame(render)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
    }
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      drawing = { color: INKS[colour++ % INKS.length], pts: [pos(e)] }
      strokes.push(drawing)
      kick()
    }
    const move = (e: PointerEvent) => {
      if (!drawing) return
      drawing.pts.push(pos(e))
      kick()
    }
    const up = () => {
      drawing = null
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <div className={cn('relative', className)}>
      <canvas ref={ref} className="h-full w-full touch-none rounded-[18px]" data-cursor="brush" aria-label={t('home.doodleLabel')} role="img" />
      <p className="hand pointer-events-none absolute bottom-3 left-4 text-lg text-ink-faint">{t('home.doodleHint')}</p>
    </div>
  )
}
