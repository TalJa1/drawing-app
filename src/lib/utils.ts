import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// teach tailwind-merge about our custom shadow tokens so they aren't mistaken for colours
const twMerge = extendTailwindMerge({
  extend: { classGroups: { shadow: [{ shadow: ['paper', 'lift', 'frame'] }] } },
})

/** clsx + tailwind-merge: later utilities win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  }
  return Promise.resolve(false)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Lower-case, strip diacritics (works for Vietnamese) for matching. */
export function normalizeText(x: string): string {
  return x
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
}

/** Accent-insensitive "contains" used by every search box. */
export function fuzzyIncludes(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle.trim()))
}

/** Accent-insensitive whole-word/phrase match ("hi" does not match "something"). */
export function matchesPhrase(haystack: string, phrase: string): boolean {
  const h = ` ${normalizeText(haystack).replace(/[^a-z0-9']+/g, ' ')} `
  const p = normalizeText(phrase.trim()).replace(/[^a-z0-9']+/g, ' ').trim()
  return p.length > 0 && h.includes(` ${p} `)
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
