import { create } from 'zustand'
import type { AppSettings } from '../../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  deeplApiKey: '',
  deeplApiType: 'free',
  whisperModel: 'base',
  outputLanguage: 'KO',
  theme: 'dark'
}

interface SettingsStore {
  settings: AppSettings
  isOpen: boolean
  setSettings: (settings: AppSettings) => void
  openSettings: () => void
  closeSettings: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  isOpen: false,
  setSettings: (settings) => set({ settings }),
  openSettings: () => set({ isOpen: true }),
  closeSettings: () => set({ isOpen: false })
}))
