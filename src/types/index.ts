// ── Workout Types ────────────────────────────────────────────────────────────

export type WorkoutType =
  | 'weights'
  | 'run'
  | 'other'
  | 'weightlifting'
  | 'long_run'
  | 'recovery_run'
  | 'swim'
  | 'yoga'
  | 'rest'

export type ActionType = 'complete' | 'skip' | 'day_off'

// Re-export new metadata/outcome/adaptation types for convenience
export type { WorkoutTag, WorkoutDifficulty, RunWorkoutConfig, RunWorkoutSubtype, PaceRange } from '../modules/workout-metadata/types'
export type { WorkoutCompletionState, PerceivedEffort, WorkoutOutcome, RunWorkoutActual } from '../modules/workout-outcomes/types'
export type { RunProgressionState, RunProgressionDecision, ResolvedWorkoutTarget } from '../modules/run-adaptation/types'
export type { ExerciseSpec, SetSpec, RunSegment, DrillSpec, ProgressionRule, ProgramMeta, ProgramVarDefs } from './program'

export type PlanStatus = 'active' | 'inactive' | 'archived'

export type OverrideType = 'advance' | 'go_back' | 'jump' | 'swap_slot'

export type DayStatus =
  | 'past_unlogged'
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

  // ── New metadata fields (all optional — backward compatible) ──────────────
  /** Display/sequencing tags */
  tags?: import('../modules/workout-metadata/types').WorkoutTag[]
  /** Difficulty level — used by recommendation spacing logic */
  difficulty?: import('../modules/workout-metadata/types').WorkoutDifficulty
  /** Rich run configuration; only meaningful when type = long_run | recovery_run */
  runConfig?: import('../modules/workout-metadata/types').RunWorkoutConfig | null
  /** Unified subtype field for type-specific programming (run/yoga/swim/other). */
  subtype?: string
  /** Shared environment field; options vary by workout type in UI. */
  location?: string
  /** Weights-specific programming fields. */
  weightsFocusArea?: import('../modules/workout-metadata/types').WeightsFocusArea
  weightsIntent?: import('../modules/workout-metadata/types').WeightsTrainingIntent
  /** Canonical numeric duration target in minutes. */
  durationMin?: number
  /** Canonical run fields (keep legacy fields for compatibility/read paths). */
  timeMin?: number
  structureDescription?: string
  adaptiveProgressionEnabled?: boolean

  // ── Program / DSL fields (populated when slot comes from a YAML import) ──
  /** Structured weightlifting warmup sets */
  warmup?: import('./program').ExerciseSpec[]
  /** Structured weightlifting exercises with sets/reps/load/progression */
  exercises?: import('./program').ExerciseSpec[]
  /** Structured run segments (warmup, intervals, drills, cooldown, etc.) */
  segments?: import('./program').RunSegment[]
  /** Slot-level progression rule (typically used on run slots) */
  slotProgress?: import('./program').ProgressionRule
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
  /** Present when the plan was imported from a YAML program definition */
  programMeta?: import('./program').ProgramMeta
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

/** An ad-hoc workout logged on a day, outside the plan rotation. */
export interface ExtraWorkoutEntry {
  id: string
  planId: string
  calendarDate: string    // YYYY-MM-DD
  workoutType: WorkoutType
  workoutName: string
  notes?: string
  createdAt: string
  /**
   * Where this extra originated. Used by Undo on TodayPage to distinguish
   * double-day bonus entries (which Undo should remove) from user-initiated
   * extras added via History or Calendar (which Undo should leave alone).
   * Pre-v1 records have source=undefined; the v1 migration in historyStore
   * sets them to 'history' (conservative — keeps the entry, never auto-removes).
   */
  source?: 'history' | 'double_day'
  /**
   * Whether adding this extra also advanced the rotation pointer (logged an
   * 'advance' override). Only true when the extra was the day already next
   * in the rotation; a double-day extra added from an arbitrary plan day
   * (via "Add from plan") does not advance the rotation, so this is false.
   * Undefined on records created before this field existed — those were all
   * created via the old all-or-nothing double-day flow, so they're treated
   * as if true (see call sites).
   */
  advancedRotation?: boolean
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
