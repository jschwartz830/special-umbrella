// ── Workout Types ────────────────────────────────────────────────────────────

export type WorkoutType =
  | 'weightlifting'
  | 'long_run'
  | 'recovery_run'
  | 'swim'
  | 'yoga'
  | 'rest'

export type ActionType = 'complete' | 'skip' | 'day_off'

export type PlanStatus = 'active' | 'inactive' | 'archived'

export type OverrideType = 'advance' | 'go_back' | 'jump' | 'swap_slot'

export type DayStatus =
  | 'past_complete'
  | 'past_skip'
  | 'past_day_off'
  | 'today_pending'
  | 'today_complete'
  | 'today_skip'
  | 'today_day_off'
  | 'future'

// ── Plan Definition ──────────────────────────────────────────────────────────

/** One workout within a plan day (a day has 1–2 slots) */
export interface WorkoutSlot {
  id: string
  type: WorkoutType
  name: string
  // Weightlifting
  notes?: string
  targetTime?: number   // minutes
  isDeload?: boolean
  // Runs (long_run, recovery_run)
  targetDistance?: number  // miles
  targetPace?: number      // min/mile
  // Swim
  targetDuration?: number  // minutes
  // (targetDistance reused for swim)
}

/** One entry in the repeating day sequence */
export interface PlanDay {
  id: string
  label: string
  slots: WorkoutSlot[]  // 1 or 2 items
}

export interface PlanDuration {
  type: 'rotations' | 'weeks'
  value: number
}

export interface Plan {
  id: string
  name: string
  description?: string
  status: PlanStatus
  days: PlanDay[]
  duration: PlanDuration
  startDate: string      // YYYY-MM-DD – calendar anchor when activated
  startDayIndex: number  // rotation index when activated (0 for new plans)
  createdAt: string
  updatedAt: string
}

// ── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string
  planId: string
  calendarDate: string    // YYYY-MM-DD
  planDayIndex?: number   // undefined for day_off
  action: ActionType
  notes?: string
  createdAt: string
}

// ── Overrides ────────────────────────────────────────────────────────────────

export interface OverrideEntry {
  id: string
  planId: string
  appliedAt: string       // ISO timestamp
  type: OverrideType
  targetDayIndex?: number // for 'jump'
  slotId?: string         // for 'swap_slot'
  newSlotType?: WorkoutType
  delta?: number          // +1 advance, -1 go_back
}

// ── Computed (never persisted) ───────────────────────────────────────────────

export interface ResolvedDay {
  calendarDate: string
  planDayIndex: number
  planDay: PlanDay
  status: DayStatus
  historyEntry?: HistoryEntry
}
