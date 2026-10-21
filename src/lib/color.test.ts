import { contrastRatio, hexToHsv, hexToRgb, hsvToHex, hueBucket, hueDistance, mixPigments, normalizeHex, readableOn, rgbToHex, rotateHue, scheme } from './color'

describe('colour utilities', () => {
  it('normalises hex input', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('E4572E')).toBe('#e4572e')
    expect(normalizeHex('nope')).toBeNull()
  })

  it('round-trips hex ↔ rgb ↔ hsv', () => {
    for (const hex of ['#e4572e', '#2f80c4', '#000000', '#ffffff', '#2e8b6f']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex)
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })

  it('rotates hue and builds schemes', () => {
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00')
    expect(scheme('#ff0000', 'complementary')[1]).toBe('#00ffff')
    expect(scheme('#ff0000', 'triadic')).toHaveLength(3)
    expect(scheme('#ff0000', 'tetradic')).toHaveLength(4)
    expect(scheme('#ff0000', 'split')).toHaveLength(3)
  })

  it('measures hue distance on the circle', () => {
    expect(hueDistance(350, 10)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
  })

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#1b1a17', '#f6f1e7')).toBeGreaterThan(7)
    expect(readableOn('#1b1a17')).toBe('#f6f1e7')
    expect(readableOn('#f2a93b')).toBe('#1b1a17')
  })

  it('mixes blue and yellow pigments into a green', () => {
    const { h } = hexToHsv(mixPigments('#1f5bb5', '#f7d116'))
    expect(h).toBeGreaterThan(70)
    expect(h).toBeLessThan(170)
  })

  it('buckets hues and ignores greys', () => {
    expect(hueBucket(128, 128, 128)).toBe(-1)
    expect(hueBucket(255, 0, 0)).toBe(0)
    expect(hueBucket(0, 0, 255)).toBe(8)
  })
})
