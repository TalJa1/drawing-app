import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Symmetry, ToolId, ToolSettings } from '@/features/drawing/engine/types'
import { useSettings } from './settings'
import { persistStorage, STORE_KEYS } from './storage'

export const DEFAULT_TOOL_SETTINGS: Record<ToolId, ToolSettings> = {
  pencil: { size: 4, opacity: 0.9, hardness: 0.8 },
  pen: { size: 3, opacity: 1, hardness: 1 },
  marker: { size: 18, opacity: 0.82, hardness: 1 },
  watercolour: { size: 44, opacity: 0.75, hardness: 0.3 },
  airbrush: { size: 70, opacity: 0.6, hardness: 0.2 },
  chalk: { size: 18, opacity: 0.9, hardness: 0.5 },
  eraser: { size: 26, opacity: 1, hardness: 0.85 },
  smudge: { size: 32, opacity: 0.6, hardness: 0.5 },
  bucket: { size: 1, opacity: 1, hardness: 1 },
  eyedropper: { size: 1, opacity: 1, hardness: 1 },
  line: { size: 6, opacity: 1, hardness: 1 },
  rect: { size: 6, opacity: 1, hardness: 1 },
  ellipse: { size: 6, opacity: 1, hardness: 1 },
  hand: { size: 1, opacity: 1, hardness: 1 },
  zoom: { size: 1, opacity: 1, hardness: 1 },
}

export type StudioPanel = 'colour' | 'layers' | 'info'

interface StudioState {
  tool: ToolId
  color: string
  recent: string[]
  settings: Record<ToolId, ToolSettings>
  smoothing: number
  pressure: boolean
  symmetry: Symmetry
  tolerance: number
  shapeFill: boolean
  sampleAllLayers: boolean
  panel: StudioPanel
  /** palette handed over from the Colour Lab / AI chat / a lesson */
  pendingPalette: { name: string; colors: string[] } | null
  setTool: (t: ToolId) => void
  setColor: (c: string) => void
  commitColor: (c: string) => void
  setToolSetting: (t: ToolId, p: Partial<ToolSettings>) => void
  set: (
    p: Partial<Pick<StudioState, 'smoothing' | 'pressure' | 'symmetry' | 'tolerance' | 'shapeFill' | 'sampleAllLayers' | 'panel'>>,
  ) => void
  setPendingPalette: (p: StudioState['pendingPalette']) => void
}

const drawingPrefs = () => {
  try {
    return useSettings.getState().drawing
  } catch {
    return { defaultTool: 'pencil' as const, pressure: true, smoothing: 0.35 }
  }
}

export const useStudio = create<StudioState>()(
  persist(
    (set) => ({
      tool: drawingPrefs().defaultTool,
      color: '#e4572e',
      recent: ['#e4572e', '#f2a93b', '#2e8b6f', '#2f80c4', '#3a3fa8', '#c93c6b', '#1b1a17'],
      settings: DEFAULT_TOOL_SETTINGS,
      smoothing: drawingPrefs().smoothing,
      pressure: drawingPrefs().pressure,
      symmetry: 'none',
      tolerance: 12,
      shapeFill: false,
      sampleAllLayers: false,
      panel: 'colour',
      pendingPalette: null,
      setTool: (tool) => set({ tool }),
      setColor: (color) => set({ color }),
      commitColor: (color) => set((s) => ({ color, recent: [color, ...s.recent.filter((c) => c !== color)].slice(0, 14) })),
      setToolSetting: (t, p) => set((s) => ({ settings: { ...s.settings, [t]: { ...s.settings[t], ...p } } })),
      set: (p) => set(p),
      setPendingPalette: (pendingPalette) => set({ pendingPalette }),
    }),
    {
      name: STORE_KEYS.studio,
      storage: persistStorage,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>
        return { ...current, ...p, settings: { ...DEFAULT_TOOL_SETTINGS, ...(p.settings ?? {}) } }
      },
    },
  ),
)
