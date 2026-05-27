import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  startDelaySeconds: number
  setStartDelay: (s: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      startDelaySeconds: 0,
      setStartDelay: (s) => set({ startDelaySeconds: s }),
    }),
    { name: 'wpt_settings' },
  ),
)
