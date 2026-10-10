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
  /** When on, focus mode switches to a side-by-side layout on a sideways phone; otherwise it stays portrait-only. */
  focusLandscape: boolean
  setFocusLandscape: (enabled: boolean) => void
  /** Calendar week start day: 0 = Sunday (US default), 1 = Monday (ISO/international). */
  weekStartsOn: 0 | 1
  setWeekStartsOn: (day: 0 | 1) => void
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
      focusLandscape: true,
      setFocusLandscape: (enabled) => set({ focusLandscape: enabled }),
      weekStartsOn: 0,
      setWeekStartsOn: (day) => set({ weekStartsOn: day }),
    }),
    {
      name: 'wpt_settings',
      version: 1,
      migrate: migrateSettingsState,
    },
  ),
)

/** @internal Exported only for unit testing. */
export function migrateSettingsState(persisted: unknown, _fromVersion: number): SettingsState {
  const s = (persisted ?? {}) as Partial<SettingsState>
  return {
    ...s,
    startDelaySeconds: s.startDelaySeconds ?? 0,
    autoAdvanceSegments: s.autoAdvanceSegments ?? true,
    focusMode: s.focusMode ?? false,
    focusLandscape: s.focusLandscape ?? true,
    weekStartsOn: s.weekStartsOn ?? 0,
  } as SettingsState
}
