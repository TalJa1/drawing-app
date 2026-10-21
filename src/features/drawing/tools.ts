import {
  Brush,
  Circle,
  Droplets,
  Eraser,
  FingerprintPattern,
  Hand,
  Highlighter,
  PaintBucket,
  Pencil,
  PenTool,
  Pipette,
  Slash,
  SprayCan,
  Square,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import type { ToolId } from './engine/types'

export interface ToolDef {
  id: ToolId
  icon: LucideIcon
  shortcut?: string
  group: 'draw' | 'paint' | 'edit' | 'shape' | 'nav'
}

export const TOOLS: ToolDef[] = [
  { id: 'pencil', icon: Pencil, shortcut: 'B', group: 'draw' },
  { id: 'pen', icon: PenTool, shortcut: 'P', group: 'draw' },
  { id: 'marker', icon: Highlighter, shortcut: 'M', group: 'draw' },
  { id: 'watercolour', icon: Droplets, shortcut: 'W', group: 'paint' },
  { id: 'airbrush', icon: SprayCan, shortcut: 'A', group: 'paint' },
  { id: 'chalk', icon: Brush, shortcut: 'C', group: 'paint' },
  { id: 'bucket', icon: PaintBucket, shortcut: 'G', group: 'paint' },
  { id: 'eraser', icon: Eraser, shortcut: 'E', group: 'edit' },
  { id: 'smudge', icon: FingerprintPattern, shortcut: 'S', group: 'edit' },
  { id: 'eyedropper', icon: Pipette, shortcut: 'I', group: 'edit' },
  { id: 'line', icon: Slash, shortcut: 'L', group: 'shape' },
  { id: 'rect', icon: Square, shortcut: 'R', group: 'shape' },
  { id: 'ellipse', icon: Circle, shortcut: 'O', group: 'shape' },
  { id: 'hand', icon: Hand, shortcut: 'Space', group: 'nav' },
  { id: 'zoom', icon: ZoomIn, shortcut: 'Z', group: 'nav' },
]

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>

/** Which option controls a tool shows in the context bar. */
export function toolOptions(t: ToolId) {
  const brush = ['pencil', 'pen', 'marker', 'watercolour', 'airbrush', 'chalk', 'eraser', 'smudge'].includes(t)
  const shape = ['line', 'rect', 'ellipse'].includes(t)
  return {
    size: brush || shape,
    opacity: brush || shape || t === 'bucket',
    hardness: ['airbrush', 'eraser', 'watercolour'].includes(t),
    smoothing: brush,
    symmetry: brush || shape,
    tolerance: t === 'bucket',
    shapeFill: t === 'rect' || t === 'ellipse',
    sampleAll: t === 'bucket',
  }
}
