import { useEffect, useSyncExternalStore } from 'react'
import { useSettings } from '@/store/settings'

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}
const darkSub = subscribeMedia('(prefers-color-scheme: dark)')
const motionSub = subscribeMedia('(prefers-reduced-motion: reduce)')
const coarseSub = subscribeMedia('(pointer: coarse)')

const media = (q: string) => () => {
  try {
    return window.matchMedia(q).matches
  } catch {
    return false
  }
}

export function useSystemDark(): boolean {
  return useSyncExternalStore(darkSub, media('(prefers-color-scheme: dark)'), () => false)
}

export function useResolvedTheme(): 'light' | 'dark' {
  const pref = useSettings((s) => s.theme)
  const sys = useSystemDark()
  return pref === 'system' ? (sys ? 'dark' : 'light') : pref
}

/** True when animations should be minimised (setting or OS preference). */
export function useReducedMotion(): boolean {
  const pref = useSettings((s) => s.motion)
  const sys = useSyncExternalStore(motionSub, media('(prefers-reduced-motion: reduce)'), () => false)
  return pref === 'reduce' || (pref === 'system' && sys)
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(coarseSub, media('(pointer: coarse)'), () => false)
}

/** Mirrors the resolved theme/motion onto <html> for CSS. */
export function useDocumentPrefs(): void {
  const theme = useResolvedTheme()
  const motion = useSettings((s) => s.motion)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.motion = motion === 'system' ? '' : motion
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute('content', theme === 'dark' ? '#12100E' : '#F6F1E7'))
  }, [theme, motion])
}
