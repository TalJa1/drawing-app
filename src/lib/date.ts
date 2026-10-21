import type { DayKey } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day key, e.g. "2026-10-21". */
export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(k: DayKey): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DayKey, b: DayKey): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function addDays(k: DayKey, n: number): DayKey {
  const d = parseDayKey(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** ISO week key, e.g. "2026-W43". */
export function weekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${pad(week)}`
}

export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

export function formatMinutes(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
