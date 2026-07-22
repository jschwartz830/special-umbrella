import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  startDelaySeconds: number
  setStartDelay: (s: number) => void
  autoAdvanceSegments: boolean
  setAutoAdvanceSegments: (enabled: boolean) => void
  /** When on, the active workout tracker opens in single-set focus mode. */
  focusMode: boolean
  setFocusMode: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      startDelaySeconds: 0,
      setStartDelay: (s) => set({ startDelaySeconds: s }),
      autoAdvanceSegments: true,
      setAutoAdvanceSegments: (enabled) => set({ autoAdvanceSegments: enabled }),
      focusMode: false,
      setFocusMode: (enabled) => set({ focusMode: enabled }),
    }),
    {
      name: 'wpt_settings',
      version: 1,
      migrate: (persisted) => persisted as SettingsState,
    },
  ),
)
