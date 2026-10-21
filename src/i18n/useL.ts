import { useCallback } from 'react'
import type { Lang, Localized, LocalizedList } from '@/types'
import { useSettings } from '@/store/settings'

export function useLang(): Lang {
  return useSettings((s) => s.language)
}

/** Resolve bilingual content (lessons, artists, badges…) for the current language. */
export function useL() {
  const lang = useLang()
  return useCallback((x: Localized | undefined | null) => (x ? x[lang] || x.en : ''), [lang])
}

export function useLL() {
  const lang = useLang()
  return useCallback((x: LocalizedList | undefined | null) => (x ? (x[lang] ?? x.en) : []), [lang])
}

export const pickL = (x: Localized, lang: Lang) => x[lang] || x.en
