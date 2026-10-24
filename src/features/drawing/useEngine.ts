import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStudio } from '@/store/studio'
import { useLatest } from '@/lib/hooks'
import { DrawingEngine, type EngineOptions } from './engine/Engine'
import type { BackgroundKind, BrushState } from './engine/types'
import type { ToolId } from './engine/types'

/** Snapshot of the studio brush settings, read by the engine when a stroke starts. */
export function currentBrush(): BrushState {
  const s = useStudio.getState()
  return {
    tool: s.tool,
    color: s.color,
    settings: s.settings[s.tool],
    smoothing: s.smoothing,
    pressure: s.pressure,
    symmetry: s.symmetry,
    tolerance: s.tolerance,
    shapeFill: s.shapeFill,
    sampleAllLayers: s.sampleAllLayers,
  }
}

/** Creates one engine per studio mount. */
export function useCreateEngine(
  width: number,
  height: number,
  background: BackgroundKind,
  callbacks: Pick<EngineOptions, 'onCommit' | 'onToolHint'>,
): DrawingEngine {
  const cb = useLatest(callbacks)
  const [engine] = useState(
    () =>
      new DrawingEngine({
        width,
        height,
        background,
        getBrush: currentBrush,
        onColorPicked: (hex) => {
          useStudio.getState().commitColor(hex)
        },
        onCommit: () => cb.current.onCommit?.(),
        onToolHint: (h) => cb.current.onToolHint?.(h),
      }),
  )
  useEffect(() => () => engine.destroy(), [engine])
  return engine
}

/** Re-render when the engine changes (layers, history, zoom…). */
export function useEngineVersion(engine: DrawingEngine): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion)
}

/** Keyboard shortcuts for the studio. */
export function useStudioShortcuts(
  engine: DrawingEngine,
  handlers: { onToggleLineArt?: () => void; onShortcuts?: () => void; onSave?: () => void },
) {
  useEffect(() => {
    const keyToTool: Record<string, ToolId> = {
      b: 'pencil',
      p: 'pen',
      m: 'marker',
      w: 'watercolour',
      a: 'airbrush',
      c: 'chalk',
      g: 'bucket',
      e: 'eraser',
      s: 'smudge',
      i: 'eyedropper',
      l: 'line',
      r: 'rect',
      o: 'ellipse',
      z: 'zoom',
    }
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      engine.setShift(e.shiftKey)
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) engine.redo()
        else engine.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        engine.redo()
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        handlers.onSave?.()
        return
      }
      if (mod) return
      if (e.code === 'Space') {
        e.preventDefault()
        engine.setSpace(true)
        return
      }
      const st = useStudio.getState()
      if (key === '[' || key === ']') {
        const cur = st.settings[st.tool].size
        const next = key === '[' ? Math.max(1, Math.round(cur / 1.2)) : Math.min(300, Math.round(cur * 1.2) + 1)
        st.setToolSetting(st.tool, { size: next })
        return
      }
      if (key === 'h') return handlers.onToggleLineArt?.()
      if (key === '0') return engine.fit()
      if (key === '+' || key === '=') return engine.zoomBy(1.25)
      if (key === '-') return engine.zoomBy(0.8)
      if (key === '?' || (e.shiftKey && key === '/')) return handlers.onShortcuts?.()
      if (key === 'x') {
        // swap to the previous recent colour
        if (st.recent[1]) st.commitColor(st.recent[1])
        return
      }
      const tool = keyToTool[key]
      if (tool) st.setTool(tool)
    }
    const up = (e: KeyboardEvent) => {
      engine.setShift(e.shiftKey)
      if (e.code === 'Space') engine.setSpace(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [engine, handlers])
}
