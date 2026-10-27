import { AttachmentError, prepareImage, sniffImage } from './attachments'
import type { ImageDeps } from './attachments'
import { LIMITS } from './contract'

function png(width: number, height: number) {
  const head = new Uint8Array(24)
  head.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const view = new DataView(head.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new Blob([head], { type: 'text/plain' })
}

function dependencies(
  width = 3000,
  height = 2000,
  sizes = [100],
): { deps: ImageDeps; calls: unknown[][]; close: ReturnType<typeof vi.fn> } {
  const calls: unknown[][] = []
  let encoded = 0
  const close = vi.fn()
  const deps: ImageDeps = {
    decode: vi.fn(async () => ({ source: {} as CanvasImageSource, width, height, close })),
    createCanvas: vi.fn((w, h) => {
      const context = {
        fillStyle: '',
        fillRect: () => calls.push(['fill', context.fillStyle, w, h]),
        drawImage: () => calls.push(['draw', w, h]),
      }
      return {
        width: w,
        height: h,
        getContext: () => context,
        toBlob: (callback: BlobCallback, mime: string, quality: number) => {
          calls.push(['encode', w, h, mime, quality])
          callback(new Blob([new Uint8Array(sizes[Math.min(encoded++, sizes.length - 1)])], { type: mime }))
        },
      } as unknown as HTMLCanvasElement
    }),
    digest: vi.fn(async () => 'sha256-test'),
  }
  return { deps, calls, close }
}

afterEach(() => vi.unstubAllGlobals())

it('detects type by magic bytes, not by file name', async () => {
  const { deps } = dependencies(12, 8)
  expect(await prepareImage(png(12, 8), 'not-an-image.txt', deps)).toMatchObject({ mime: 'image/jpeg', name: 'not-an-image.txt' })
  expect(sniffImage(new Uint8Array([71, 73, 70, 56, 57, 97, 12, 0, 8, 0]))).toEqual({ mime: 'image/gif', width: 12, height: 8 })
  expect(sniffImage(new Uint8Array([255, 216, 255, 224, 0, 2, 255, 192, 0, 7, 8, 0, 8, 0, 12]))).toEqual({
    mime: 'image/jpeg',
    width: 12,
    height: 8,
  })
  const webp = new Uint8Array(30)
  webp.set(new TextEncoder().encode('RIFF'))
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8)
  webp[24] = 11
  webp[27] = 7
  expect(sniffImage(webp)).toEqual({ mime: 'image/webp', width: 12, height: 8 })
  const lossy = webp.slice()
  lossy.set(new TextEncoder().encode('VP8 '), 12)
  lossy.set([0x9d, 1, 0x2a, 12, 0, 8, 0], 23)
  expect(sniffImage(lossy)).toEqual({ mime: 'image/webp', width: 12, height: 8 })
  const lossless = webp.slice(0, 25)
  lossless.set(new TextEncoder().encode('VP8L'), 12)
  lossless.set([0x2f, 11, 0xc0, 1, 0], 20)
  expect(sniffImage(lossless)).toEqual({ mime: 'image/webp', width: 12, height: 8 })
  expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull()
  await expect(prepareImage(new Blob(['fake'], { type: 'image/png' }), 'fake.png', deps)).rejects.toMatchObject({ code: 'unsupported' })
})

it('rejects images over 40 MP before decoding', async () => {
  const { deps } = dependencies()
  await expect(prepareImage(png(10_000, 5000), 'large.png', deps)).rejects.toMatchObject({ code: 'too_many_pixels' })
  expect(deps.decode).not.toHaveBeenCalled()
})

it('fits the analysis image within 1600 px on the long edge', async () => {
  const { deps, close } = dependencies()
  const image = await prepareImage(png(3000, 2000), 'drawing.png', deps)
  expect(image).toMatchObject({ width: 1600, height: 1067 })
  expect(deps.createCanvas).toHaveBeenCalledWith(360, 240)
  expect(close).toHaveBeenCalledOnce()
})

it('never upscales small images', async () => {
  const { deps } = dependencies(100, 50)
  expect(await prepareImage(png(100, 50), 'small.png', deps)).toMatchObject({ width: 100, height: 50 })
  expect(deps.createCanvas).toHaveBeenCalledTimes(2)
  expect(deps.createCanvas).toHaveBeenNthCalledWith(2, 100, 50)
})

it('flattens transparency onto white before JPEG encoding', async () => {
  const { deps, calls } = dependencies()
  await prepareImage(png(3000, 2000), 'transparent.png', deps)
  expect(calls.slice(0, 3)).toEqual([
    ['fill', '#ffffff', 1600, 1067],
    ['draw', 1600, 1067],
    ['encode', 1600, 1067, 'image/jpeg', 0.85],
  ])
  expect(calls.slice(3, 5)).toEqual([
    ['fill', '#ffffff', 360, 240],
    ['draw', 360, 240],
  ])
})

it('falls back to <img> decoding when createImageBitmap fails', async () => {
  const { deps } = dependencies(20, 10)
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported bitmap')))
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:image'), revokeObjectURL: revoke })
  class FakeImage {
    src = ''
    naturalWidth = 20
    naturalHeight = 10
    decode = vi.fn().mockResolvedValue(undefined)
  }
  vi.stubGlobal('Image', FakeImage)
  const overrides = { createCanvas: deps.createCanvas, digest: deps.digest }
  expect(await prepareImage(png(20, 10), 'fallback.png', overrides)).toMatchObject({ width: 20, height: 10 })
  expect(revoke).toHaveBeenCalledWith('blob:image')
})

it('falls back to a non-crypto hash when crypto.subtle is unavailable', async () => {
  vi.stubGlobal('crypto', {})
  const { deps } = dependencies(20, 10)
  const overrides = { decode: deps.decode, createCanvas: deps.createCanvas }
  const image = await prepareImage(png(20, 10), 'hash.png', overrides)
  expect(image.hash).toMatch(/^fnv:[0-9a-f]+:100$/)
})

it('rejects files over 12 MB with too_big', async () => {
  const { deps } = dependencies()
  await expect(prepareImage(new Blob([new Uint8Array(12 * 1024 * 1024 + 1)]), 'large.png', deps)).rejects.toBeInstanceOf(AttachmentError)
  await expect(prepareImage(new Blob([new Uint8Array(12 * 1024 * 1024 + 1)]), 'large.png', deps)).rejects.toMatchObject({ code: 'too_big' })
  expect(deps.decode).not.toHaveBeenCalled()
})

it('keeps the analysis JPEG within maxAnalysisJpegBytes', async () => {
  const { deps, calls } = dependencies(3000, 2000, [1_100_001, 1_100_001, 1_100_000, 100])
  const image = await prepareImage(png(3000, 2000), 'complex.png', deps)
  expect(image.analysisBlob.size).toBe(LIMITS.maxAnalysisJpegBytes)
  expect(image).toMatchObject({ width: 1280, height: 853 })
  expect(calls.filter((call) => call[0] === 'encode').map((call) => call[4])).toEqual([0.85, 0.72, 0.72, 0.8])
  const failing = dependencies(3000, 2000, [1_100_001])
  await expect(prepareImage(png(3000, 2000), 'too-complex.png', failing.deps)).rejects.toMatchObject({ code: 'too_big' })
  expect(failing.close).toHaveBeenCalledOnce()
})

it('a JPEG of maxAnalysisJpegBytes encodes to a data URL within maxImageDataUrlChars', async () => {
  const { deps } = dependencies(1600, 1000, [LIMITS.maxAnalysisJpegBytes, 100])
  const image = await prepareImage(png(1600, 1000), 'boundary.png', deps)
  expect(4 * Math.ceil(image.analysisBlob.size / 3) + 'data:image/jpeg;base64,'.length).toBeLessThanOrEqual(LIMITS.maxImageDataUrlChars)
})
