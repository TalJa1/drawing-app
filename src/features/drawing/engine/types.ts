export type ToolId =
  | 'pencil'
  | 'pen'
  | 'marker'
  | 'watercolour'
  | 'airbrush'
  | 'chalk'
  | 'eraser'
  | 'smudge'
  | 'bucket'
  | 'eyedropper'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'hand'
  | 'zoom'

export const BRUSH_TOOLS: ToolId[] = ['pencil', 'pen', 'marker', 'watercolour', 'airbrush', 'chalk', 'eraser', 'smudge']
export const SHAPE_TOOLS: ToolId[] = ['line', 'rect', 'ellipse']

export type BlendMode = 'normal' | 'multiply' | 'overlay' | 'screen'
export const BLEND_TO_COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  overlay: 'overlay',
  screen: 'screen',
}

export type Symmetry = 'none' | 'vertical' | 'horizontal' | 'quad' | 'radial6' | 'radial8'

export interface ToolSettings {
  size: number
  opacity: number
  hardness: number
}

/** Everything the engine reads from the UI when a stroke starts. */
export interface BrushState {
  tool: ToolId
  color: string
  settings: ToolSettings
  smoothing: number
  pressure: boolean
  symmetry: Symmetry
  tolerance: number
  shapeFill: boolean
  sampleAllLayers: boolean
}

export interface LayerMeta {
  id: string
  name: string
  visible: boolean
  opacity: number
  blend: BlendMode
  locked: boolean
  kind: 'paint' | 'lineart'
}

export interface Layer extends LayerMeta {
  canvas: HTMLCanvasElement
}

export type BackgroundKind = 'white' | 'cream' | 'kraft' | 'black' | 'transparent'
export const BACKGROUNDS: Record<BackgroundKind, string | null> = {
  white: '#ffffff',
  cream: '#f6efe0',
  kraft: '#c9a77c',
  black: '#17150f',
  transparent: null,
}

export interface Point {
  x: number
  y: number
  p: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ViewState {
  zoom: number
  panX: number
  panY: number
}

export interface DraftLayer {
  meta: LayerMeta
  image: Blob
}

export interface Draft {
  version: 1
  width: number
  height: number
  background: BackgroundKind
  layers: DraftLayer[]
  activeLayerId: string
  savedAt: string
  seconds: number
  strokes: number
}
