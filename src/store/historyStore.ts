import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import type { HistoryEntry, OverrideEntry, ActionType, OverrideType, WorkoutType } from '../types'
import { nanoid } from '../engine/rotationEngine'

interface HistoryState {
  entries: HistoryEntry[]
  overrides: OverrideEntry[]

  addEntry: (
    payload: Omit<HistoryEntry, 'id' | 'createdAt'>,
  ) => void
  updateEntryNotes: (id: string, notes: string) => void
  /** appliedAt defaults to now; pass an ISO string to back-date (e.g. retroactive calendar edits) */
  addOverride: (
    payload: Omit<OverrideEntry, 'id' | 'appliedAt'> & { appliedAt?: string },
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

  /**
   * Remove any `jump` overrides whose local date matches calendarDate.
   * Called before writing a retroactive calendar entry so stale jump overrides
   * don't accumulate.
   */
  removeRetroJumpForDate: (planId: string, calendarDate: string) => void

  updateEntryAction: (planId: string, calendarDate: string, action: ActionType, planDayIndex?: number) => void
  clearPlanHistory: (planId: string) => void
  removeEntry: (planId: string, calendarDate: string) => void

  /** Bulk import: replaces any existing entry for the same (planId, calendarDate). */
  importEntries: (entries: HistoryEntry[]) => void
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
        const { appliedAt, ...rest } = payload
        const override: OverrideEntry = {
          id: nanoid(),
          appliedAt: appliedAt ?? new Date().toISOString(),
          ...rest,
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

      updateEntryAction(planId, calendarDate, action, planDayIndex?: number) {
        set(s => ({
          entries: s.entries.map(e => {
            if (e.planId !== planId || e.calendarDate !== calendarDate) return e
            if (action === 'day_off') {
              return { ...e, action, planDayIndex: undefined }
            }
            // When changing away from day_off, use the provided index or keep the existing one.
            // e.planDayIndex may be undefined if the original entry was a day_off.
            const nextIndex = planDayIndex ?? e.planDayIndex
            return { ...e, action, planDayIndex: nextIndex }
          }),
        }))
      },

      removeRetroJumpForDate(planId, calendarDate) {
        set(s => ({
          overrides: s.overrides.filter(o => {
            if (o.planId !== planId || o.type !== 'jump') return true
            const ovLocalDate = format(new Date(o.appliedAt), 'yyyy-MM-dd')
            return ovLocalDate !== calendarDate
          }),
        }))
      },

      removeEntry(planId, calendarDate) {
        set(s => ({
          entries: s.entries.filter(
            e => !(e.planId === planId && e.calendarDate === calendarDate),
          ),
        }))
      },

      importEntries(incoming) {
        if (incoming.length === 0) return
        set(s => {
          const keys = new Set(incoming.map(e => `${e.planId}__${e.calendarDate}`))
          const filtered = s.entries.filter(
            e => !keys.has(`${e.planId}__${e.calendarDate}`),
          )
          return { entries: [...filtered, ...incoming] }
        })
      },
    }),
    { name: 'wpt_history' },
  ),
)
