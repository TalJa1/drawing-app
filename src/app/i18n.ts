import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from '@/types'
import { useSettings } from '@/store/settings'
import en from '@/i18n/en.json'

/* English (the default) ships with the app; Vietnamese is fetched when first needed. */
const loaders: Record<Lang, () => Promise<{ default: Record<string, unknown> }>> = {
  en: async () => ({ default: en }),
  vi: () => import('@/i18n/vi.json'),
}

async function ensure(lang: Lang) {
  if (i18n.hasResourceBundle(lang, 'translation')) return
  const { default: dict } = await loaders[lang]()
  i18n.addResourceBundle(lang, 'translation', dict, true, true)
}

async function setLanguage(lang: Lang) {
  await ensure(lang)
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

/** Resolves once the current language is ready — awaited before the first render. */
export const i18nReady = (async () => {
  const lang = useSettings.getState().language
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: lang,
    fallbackLng: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    partialBundledLanguages: true,
  })
  await setLanguage(lang)
})()

// Keep i18next and <html lang> in sync with the persisted setting.
useSettings.subscribe((s, prev) => {
  if (s.language !== prev.language) void setLanguage(s.language)
})

export default i18n
