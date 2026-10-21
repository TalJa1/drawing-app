import { svgToDataUrl } from './utils'

/** Load an SVG string as an <img> ready to draw onto a canvas. */
export function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load SVG'))
    img.src = svgToDataUrl(svg)
  })
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export async function svgToCanvas(svg: string, w: number, h: number, background?: string): Promise<HTMLCanvasElement> {
  const img = await loadSvgImage(svg)
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')!
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return c
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality)
  })
}

/** Downscaled JPEG/PNG thumbnail of a canvas. */
export function makeThumbnail(src: HTMLCanvasElement, maxW = 480, background = '#ffffff'): Promise<Blob> {
  const scale = Math.min(1, maxW / src.width)
  const c = createCanvas(Math.round(src.width * scale), Math.round(src.height * scale))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return canvasToBlob(c, 'image/jpeg', 0.86)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Colour a line-art template by giving its white-filled shapes pigment fills.
 * Used for demo artworks and the landing page showcase.
 */
export function colouriseTemplate(svg: string, palette: string[], rng: () => number, coverage = 1): string {
  let i = 0
  return svg.replace(/<(path|circle|ellipse|rect|polygon)\b(?![^>]*\bfill=)/g, (m) => {
    i++
    if (rng() > coverage) return m
    const colour = palette[Math.floor(rng() * palette.length)] ?? palette[i % palette.length]
    return `${m} fill="${colour}"`
  })
}
