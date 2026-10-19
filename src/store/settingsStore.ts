import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_EQUIPMENT, type EquipmentLocation, type EquipmentProfile } from '../lib/equipment'

interface SettingsState {
  startDelaySeconds: number
  setStartDelay: (s: number) => void
  autoAdvanceSegments: boolean
  setAutoAdvanceSegments: (enabled: boolean) => void
  /** When on, the active workout tracker opens in single-set focus mode. */
  focusMode: boolean
  setFocusMode: (enabled: boolean) => void
  /** Calendar week start day: 0 = Sunday (US default), 1 = Monday (ISO/international). */
  weekStartsOn: 0 | 1
  setWeekStartsOn: (day: 0 | 1) => void
  /** Equipment available at each location; drives which weights are offered/pre-filled. */
  equipment: Record<EquipmentLocation, EquipmentProfile>
  setEquipment: (location: EquipmentLocation, patch: Partial<EquipmentProfile>) => void
  /** Profile used for workouts that don't specify a location. */
  defaultEquipmentLocation: EquipmentLocation
  setDefaultEquipmentLocation: (location: EquipmentLocation) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      startDelaySeconds: 0,
      setStartDelay: (s) => set({ startDelaySeconds: s }),
      autoAdvanceSegments: true,
      setAutoAdvanceSegments: (enabled) => set({ autoAdvanceSegments: enabled }),
      focusMode: false,
      setFocusMode: (enabled) => set({ focusMode: enabled }),
      weekStartsOn: 0,
      setWeekStartsOn: (day) => set({ weekStartsOn: day }),
      equipment: DEFAULT_EQUIPMENT,
      setEquipment: (location, patch) => set({
        equipment: { ...get().equipment, [location]: { ...get().equipment[location], ...patch } },
      }),
      defaultEquipmentLocation: 'gym',
      setDefaultEquipmentLocation: (location) => set({ defaultEquipmentLocation: location }),
    }),
    {
      name: 'wpt_settings',
      version: 2,
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
    weekStartsOn: s.weekStartsOn ?? 0,
    equipment: {
      home: { ...DEFAULT_EQUIPMENT.home, ...s.equipment?.home },
      gym: { ...DEFAULT_EQUIPMENT.gym, ...s.equipment?.gym },
    },
    defaultEquipmentLocation: s.defaultEquipmentLocation ?? 'gym',
  } as SettingsState
}
