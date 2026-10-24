import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useStudio } from '@/store/studio'
import type { DrawingEngine } from '../engine/Engine'
import { BRUSH_TOOLS, SHAPE_TOOLS } from '../engine/types'
import { useEngineVersion } from '../useEngine'

/** The drawing surface: view canvas + brush cursor + pointer plumbing. */
export function CanvasStage({ engine, description }: { engine: DrawingEngine; description: string }) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const tool = useStudio((s) => s.tool)
  const size = useStudio((s) => s.settings[s.tool].size)
  useEngineVersion(engine)
  const zoom = engine.view.zoom

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    engine.attach(canvas)
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      engine.resize(width, height)
    })
    ro.observe(wrap)
    const onWheel = (e: WheelEvent) => engine.wheel(e)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    // stop the browser from scrolling/zooming the page while drawing
    const stopTouch = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchmove', stopTouch, { passive: false })
    return () => {
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchmove', stopTouch)
      engine.detach()
    }
  }, [engine])

  const brushLike = BRUSH_TOOLS.includes(tool) || SHAPE_TOOLS.includes(tool)
  const cursor =
    tool === 'hand'
      ? 'grab'
      : tool === 'zoom'
        ? 'zoom-in'
        : tool === 'eyedropper' || tool === 'bucket'
          ? 'crosshair'
          : brushLike
            ? 'none'
            : 'default'

  const moveCursor = (e: React.PointerEvent) => {
    const c = cursorRef.current
    const w = wrapRef.current
    if (!c || !w) return
    if (e.pointerType === 'touch' || !brushLike || engine.isPanningMode()) {
      c.style.opacity = '0'
      return
    }
    const r = w.getBoundingClientRect()
    c.style.opacity = '1'
    c.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px) translate(-50%, -50%)`
  }

  const d = Math.max(4, size * zoom)

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" data-cursor="brush">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t('studio.canvasLabel')}
        aria-description={description}
        tabIndex={0}
        className="absolute inset-0 h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-focus"
        style={{ cursor }}
        onPointerDown={(e) => engine.pointerDown(e.nativeEvent)}
        onPointerMove={(e) => {
          moveCursor(e)
          engine.pointerMove(e.nativeEvent)
        }}
        onPointerUp={(e) => engine.pointerUp(e.nativeEvent)}
        onPointerCancel={(e) => engine.pointerCancel(e.nativeEvent)}
        onPointerLeave={() => {
          if (cursorRef.current) cursorRef.current.style.opacity = '0'
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full opacity-0"
        style={{
          width: d,
          height: d,
          border: '1.5px solid rgba(255,255,255,0.95)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.25)',
          transition: 'width .08s, height .08s',
        }}
      >
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70" />
      </div>
    </div>
  )
}
