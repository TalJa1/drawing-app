/* Colour utilities used by the studio, the colour lab and the scorer. */

export interface RGB {
  r: number
  g: number
  b: number
}
export interface HSV {
  h: number
  s: number
  v: number
}
export interface HSL {
  h: number
  s: number
  l: number
}

export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))

export function normalizeHex(input: string): string | null {
  let s = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s))
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return `#${s.toLowerCase()}`
}

export function hexToRgb(hex: string): RGB {
  const n = normalizeHex(hex) ?? '#000000'
  const v = parseInt(n.slice(1), 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (x: number) =>
    Math.round(clamp(x, 0, 255))
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const sectors: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = sectors[Math.min(5, Math.floor(hh))]
  const m = v - c
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const { h } = rgbToHsv({ r, g, b })
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const v = l + s * Math.min(l, 1 - l)
  const sv = v === 0 ? 0 : 2 * (1 - l / v)
  return hsvToRgb({ h, s: sv, v })
}

export const hexToHsv = (hex: string) => rgbToHsv(hexToRgb(hex))
export const hsvToHex = (hsv: HSV) => rgbToHex(hsvToRgb(hsv))
export const hexToHsl = (hex: string) => rgbToHsl(hexToRgb(hex))
export const hslToHex = (hsl: HSL) => rgbToHex(hslToRgb(hsl))

export function rotateHue(hex: string, deg: number): string {
  const hsl = hexToHsl(hex)
  return hslToHex({ ...hsl, h: (hsl.h + deg + 360) % 360 })
}

/** Smallest angular distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export type SchemeKind = 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split'

export function scheme(base: string, kind: SchemeKind): string[] {
  switch (kind) {
    case 'complementary':
      return [base, rotateHue(base, 180)]
    case 'analogous':
      return [rotateHue(base, -30), base, rotateHue(base, 30)]
    case 'triadic':
      return [base, rotateHue(base, 120), rotateHue(base, 240)]
    case 'tetradic':
      return [base, rotateHue(base, 90), rotateHue(base, 180), rotateHue(base, 270)]
    case 'split':
      return [base, rotateHue(base, 150), rotateHue(base, 210)]
  }
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const ch = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function readableOn(bg: string): '#1b1a17' | '#f6f1e7' {
  return contrastRatio(bg, '#1b1a17') >= contrastRatio(bg, '#f6f1e7') ? '#1b1a17' : '#f6f1e7'
}

/**
 * "Pigment" mixing: a subtractive-feeling blend. Real pigment mixing is
 * spectral; multiplying in linear-ish space then lifting gets close enough
 * for a playful lab (blue + yellow → green instead of grey).
 */
export function mixPigments(a: string, b: string, t = 0.5): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const toAbs = (c: number) => 1 - c / 255
  const fromAbs = (x: number) => (1 - x) * 255
  // geometric mean of absorbances (subtractive) blended with additive average
  const sub = (x: number, y: number) => fromAbs(Math.pow(Math.max(0.0001, toAbs(x)), 1 - t) * Math.pow(Math.max(0.0001, toAbs(y)), t))
  const add = (x: number, y: number) => x * (1 - t) + y * t
  const mixC = (x: number, y: number) => sub(x, y) * 0.65 + add(x, y) * 0.35
  // Special-case blue + yellow style mixes by nudging toward green via hue average
  const out = { r: mixC(A.r, B.r), g: mixC(A.g, B.g), b: mixC(A.b, B.b) }
  const ha = rgbToHsv(A)
  const hb = rgbToHsv(B)
  if (ha.s > 0.25 && hb.s > 0.25) {
    const hsv = rgbToHsv(out)
    let dh = hb.h - ha.h
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
    const targetHue = (ha.h + dh * t + 360) % 360
    return hsvToHex({ h: targetHue, s: Math.max(hsv.s, (ha.s + hb.s) / 2.4), v: Math.max(hsv.v, 0.35) })
  }
  return rgbToHex(out)
}

/** 12 hue buckets of 30°; returns -1 for near-greys. */
export function hueBucket(r: number, g: number, b: number): number {
  const { h, s, v } = rgbToHsv({ r, g, b })
  if (s < 0.18 || v < 0.12) return -1
  return Math.floor(h / 30) % 12
}

export const HUE_NAMES_EN = [
  'red',
  'orange',
  'amber',
  'yellow-green',
  'green',
  'spring green',
  'teal',
  'azure',
  'blue',
  'violet',
  'magenta',
  'rose',
]
