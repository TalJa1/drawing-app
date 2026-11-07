import { useEffect, useId, useRef, useState } from 'react'

/** useId() made safe for url(#…) references. */
export function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

/** Re-renders every `ms` with the current time (for countdowns and timers). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/** Calls the latest handler without re-subscribing listeners. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/* Dialogs can overlap (the collection's "delete this artwork?" sits inside the artwork's own dialog) and can close in
   any order — an exiting dialog keeps its last props until its animation ends, so its lock is released late. Each
   lock therefore only counts itself: the page is locked while at least one lock is held, and gets back what it had
   before the FIRST lock when the LAST one is released. Handing each lock its own "previous value" would let a late
   release put 'hidden' back and leave the page unscrollable. */
let locks = 0
let before = ''

/** Lock body scroll while `locked` is true. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    if (locks++ === 0) {
      before = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      if (--locks === 0) document.body.style.overflow = before
    }
  }, [locked])
}
