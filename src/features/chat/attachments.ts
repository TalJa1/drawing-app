import { uid } from '@/lib/random'
import { LIMITS } from './contract'

export class AttachmentError extends Error {
  code: 'too_big' | 'unsupported' | 'decode' | 'too_many_pixels'

  constructor(code: AttachmentError['code']) {
    super(code)
    this.name = 'AttachmentError'
    this.code = code
  }
}

export type PreparedImage = {
  id: string
  name: string
  previewBlob: Blob
  analysisBlob: Blob
  width: number
  height: number
  hash: string
  mime: 'image/jpeg'
}
export type ImageDeps = {
  decode(b: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }>
  createCanvas(w: number, h: number): HTMLCanvasElement
  digest(bytes: ArrayBuffer): Promise<string>
}

type ImageHeader = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; width: number; height: number }

export function sniffImage(head: Uint8Array): ImageHeader | null {
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const matches = (offset: number, bytes: number[]) => bytes.every((byte, i) => head[offset + i] === byte)
  const ascii = (offset: number, text: string) =>
    matches(
      offset,
      Array.from(text, (char) => char.charCodeAt(0)),
    )
  const result = (mime: ImageHeader['mime'], width: number, height: number): ImageHeader | null =>
    width > 0 && height > 0 ? { mime, width, height } : null
  if (head.length >= 24 && matches(0, [137, 80, 78, 71, 13, 10, 26, 10]) && ascii(12, 'IHDR')) {
    return result('image/png', view.getUint32(16), view.getUint32(20))
  }
  if (head.length >= 10 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) {
    return result('image/gif', view.getUint16(6, true), view.getUint16(8, true))
  }
  if (head.length >= 25 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    const uint24 = (offset: number) => head[offset] + (head[offset + 1] << 8) + (head[offset + 2] << 16)
    if (head.length >= 30 && ascii(12, 'VP8X')) return result('image/webp', uint24(24) + 1, uint24(27) + 1)
    if (head.length >= 30 && ascii(12, 'VP8 ') && matches(23, [0x9d, 1, 0x2a])) {
      return result('image/webp', view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff)
    }
    if (ascii(12, 'VP8L') && head[20] === 0x2f) {
      return result('image/webp', 1 + head[21] + ((head[22] & 0x3f) << 8), 1 + (head[22] >> 6) + (head[23] << 2) + ((head[24] & 15) << 10))
    }
  }
  if (head.length >= 4 && matches(0, [0xff, 0xd8])) {
    let offset = 2
    while (offset + 3 < Math.min(head.length, 256 * 1024)) {
      if (head[offset++] !== 0xff) return null
      while (head[offset] === 0xff) offset++
      const marker = head[offset++]
      if (marker === 0xd9 || marker === 0xda || offset + 2 > head.length) return null
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > head.length) return null
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 7) {
        return result('image/jpeg', view.getUint16(offset + 5), view.getUint16(offset + 3))
      }
      offset += length
    }
  }
  return null
}

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new AttachmentError('decode'))
    reader.readAsArrayBuffer(blob)
  })
}

const defaultDeps: ImageDeps = {
  async decode(blob) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      const url = URL.createObjectURL(blob)
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) }
      } catch {
        URL.revokeObjectURL(url)
        throw new AttachmentError('decode')
      }
    }
  },
  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },
  async digest(bytes) {
    if (globalThis.crypto?.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    let hash = 2166136261
    for (const byte of new Uint8Array(bytes)) hash = Math.imul(hash ^ byte, 16777619)
    return `fnv:${(hash >>> 0).toString(16)}:${bytes.byteLength}`
  },
}

export async function prepareImage(source: Blob, name: string, overrides: Partial<ImageDeps> = {}): Promise<PreparedImage> {
  if (source.size > 12 * 1024 * 1024) throw new AttachmentError('too_big')
  const header = sniffImage(new Uint8Array(await readBytes(source.slice(0, 256 * 1024))))
  if (!header) throw new AttachmentError('unsupported')
  if (header.width * header.height > 40_000_000) throw new AttachmentError('too_many_pixels')
  const deps = { ...defaultDeps, ...overrides }
  let decoded: Awaited<ReturnType<ImageDeps['decode']>>
  try {
    decoded = await deps.decode(source)
  } catch {
    throw new AttachmentError('decode')
  }
  try {
    if (decoded.width * decoded.height > 40_000_000) throw new AttachmentError('too_many_pixels')
    if (decoded.width <= 0 || decoded.height <= 0) throw new AttachmentError('decode')
    const render = (edge: number) => {
      const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height))
      const canvas = deps.createCanvas(Math.max(1, Math.round(decoded.width * scale)), Math.max(1, Math.round(decoded.height * scale)))
      const context = canvas.getContext('2d')
      if (!context) throw new AttachmentError('decode')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
      return canvas
    }
    const encode = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
      new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AttachmentError('decode'))), 'image/jpeg', quality)
      })
    let analysis = render(LIMITS.maxImageEdge)
    let analysisBlob = await encode(analysis, 0.85)
    if (analysisBlob.size > LIMITS.maxAnalysisJpegBytes) analysisBlob = await encode(analysis, 0.72)
    if (analysisBlob.size > LIMITS.maxAnalysisJpegBytes) {
      analysis = render(1280)
      analysisBlob = await encode(analysis, 0.72)
    }
    if (analysisBlob.size > LIMITS.maxAnalysisJpegBytes) throw new AttachmentError('too_big')
    const previewBlob = await encode(render(360), 0.8)
    return {
      id: uid('a_'),
      name: name.slice(0, LIMITS.maxImageNameChars),
      previewBlob,
      analysisBlob,
      width: analysis.width,
      height: analysis.height,
      hash: await deps.digest(await readBytes(analysisBlob)),
      mime: 'image/jpeg',
    }
  } finally {
    decoded.close()
  }
}
