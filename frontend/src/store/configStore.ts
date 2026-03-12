import { create } from 'zustand'
import type { AppConfig } from '@/types'

interface ConfigStore {
  config: AppConfig | null
  setConfig: (config: AppConfig) => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
}))
