import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '@/types'
import { persistStorage, STORE_KEYS } from './storage'

export type ThemePref = 'system' | 'light' | 'dark'
export type MotionPref = 'system' | 'reduce' | 'full'

export interface DrawingPrefs {
  defaultTool: 'pencil' | 'pen' | 'marker' | 'watercolour'
  pressure: boolean
  smoothing: number
}

interface SettingsState {
  theme: ThemePref
  language: Lang
  motion: MotionPref
  sound: boolean
  customCursor: boolean
  drawing: DrawingPrefs
  onboardingDone: boolean
  /** Developer flag: make the mock API fail ~20% of the time */
  simulateErrors: boolean
  setTheme: (t: ThemePref) => void
  setLanguage: (l: Lang) => void
  setMotion: (m: MotionPref) => void
  setSound: (on: boolean) => void
  setCustomCursor: (on: boolean) => void
  setDrawing: (p: Partial<DrawingPrefs>) => void
  setOnboardingDone: (v: boolean) => void
  setSimulateErrors: (v: boolean) => void
}

function initialLanguage(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
  } catch {
    return 'en'
  }
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: initialLanguage(),
      motion: 'system',
      sound: false,
      customCursor: true,
      drawing: { defaultTool: 'pencil', pressure: true, smoothing: 0 },
      onboardingDone: false,
      simulateErrors: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setMotion: (motion) => set({ motion }),
      setSound: (sound) => set({ sound }),
      setCustomCursor: (customCursor) => set({ customCursor }),
      setDrawing: (p) => set((s) => ({ drawing: { ...s.drawing, ...p } })),
      setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
      setSimulateErrors: (simulateErrors) => set({ simulateErrors }),
    }),
    {
      name: STORE_KEYS.settings,
      storage: persistStorage,
      version: 2,
      // v2: stroke smoothing defaults to 0 (no lag behind the pointer). Only the old default is reset; custom values survive.
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState> | undefined
        if (version < 2 && s?.drawing?.smoothing === 0.35) return { ...s, drawing: { ...s.drawing, smoothing: 0 } } as SettingsState
        return persisted as SettingsState
      },
    },
  ),
)
