import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HistoryEntry, OverrideEntry, ActionType, OverrideType, WorkoutType } from '../types'
import { nanoid } from '../engine/rotationEngine'

interface HistoryState {
  entries: HistoryEntry[]
  overrides: OverrideEntry[]

  addEntry: (
    payload: Omit<HistoryEntry, 'id' | 'createdAt'>,
  ) => void
  updateEntryNotes: (id: string, notes: string) => void
  addOverride: (
    payload: Omit<OverrideEntry, 'id' | 'appliedAt'>,
  ) => void

  // Convenience action wrappers
  logAction: (
    planId: string,
    calendarDate: string,
    planDayIndex: number,
    action: ActionType,
    notes?: string,
  ) => void

  logOverride: (
    planId: string,
    type: OverrideType,
    opts?: {
      targetDayIndex?: number
      slotId?: string
      newSlotType?: WorkoutType
      delta?: number
    },
  ) => void

  clearPlanHistory: (planId: string) => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      overrides: [],

      addEntry(payload) {
        const now = new Date().toISOString()
        const newEntry: HistoryEntry = {
          id: nanoid(),
          createdAt: now,
          ...payload,
        }
        set(s => {
          // Replace any existing entry for same (planId, calendarDate)
          const filtered = s.entries.filter(
            e => !(e.planId === payload.planId && e.calendarDate === payload.calendarDate),
          )
          return { entries: [...filtered, newEntry] }
        })
      },

      updateEntryNotes(id, notes) {
        set(s => ({
          entries: s.entries.map(e => (e.id === id ? { ...e, notes } : e)),
        }))
      },

      addOverride(payload) {
        const override: OverrideEntry = {
          id: nanoid(),
          appliedAt: new Date().toISOString(),
          ...payload,
        }
        set(s => ({ overrides: [...s.overrides, override] }))
      },

      logAction(planId, calendarDate, planDayIndex, action, notes) {
        get().addEntry({
          planId,
          calendarDate,
          planDayIndex: action === 'day_off' ? undefined : planDayIndex,
          action,
          notes,
        })
      },

      logOverride(planId, type, opts = {}) {
        get().addOverride({ planId, type, ...opts })
      },

      clearPlanHistory(planId) {
        set(s => ({
          entries: s.entries.filter(e => e.planId !== planId),
          overrides: s.overrides.filter(o => o.planId !== planId),
        }))
      },
    }),
    { name: 'wpt_history' },
  ),
)
