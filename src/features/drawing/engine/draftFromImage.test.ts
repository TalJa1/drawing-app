import { draftFromImage } from './draftFromImage'

describe('draftFromImage', () => {
  const image = new Blob(['png'], { type: 'image/png' })

  it('wraps the saved picture as one visible, unlocked paint layer', () => {
    const d = draftFromImage(image, 1200, 900)
    expect(d.layers).toHaveLength(1)
    expect(d.layers[0].image).toBe(image)
    expect(d.layers[0].meta).toMatchObject({ kind: 'paint', visible: true, locked: false, opacity: 1, blend: 'normal' })
    expect(d.activeLayerId).toBe(d.layers[0].meta.id)
  })

  it('keeps the size of the saved picture', () => {
    const d = draftFromImage(image, 1080, 1920)
    expect([d.width, d.height]).toEqual([1080, 1920])
  })

  it('is never empty, so the picture can be saved again without a new stroke', () => {
    expect(draftFromImage(image, 1200, 900).strokes).toBeGreaterThan(0)
  })

  it('starts a fresh timer and leaves the background to the picture, which already carries it', () => {
    const d = draftFromImage(image, 1200, 900)
    expect(d.seconds).toBe(0)
    expect(d.background).toBe('white')
    expect(d.version).toBe(1)
  })
})
