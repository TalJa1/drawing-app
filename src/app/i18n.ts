import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en.json'
import vi from '@/i18n/vi.json'
import { useSettings } from '@/store/settings'

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: useSettings.getState().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

// Keep i18next and <html lang> in sync with the persisted setting.
useSettings.subscribe((s, prev) => {
  if (s.language !== prev.language) void i18n.changeLanguage(s.language)
})
document.documentElement.lang = useSettings.getState().language

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
