// ── Workout Outcome Types ─────────────────────────────────────────────────────

export type WorkoutCompletionState =
  | 'planned'
  | 'completed'
  | 'partially_completed'
  | 'skipped'
  | 'deferred'
  | 'swapped'

export type PerceivedEffort = 1 | 2 | 3 | 4 | 5

export interface RunWorkoutActual {
  actualDistanceMiles?: number | null
  actualDurationMin?: number | null
  /** Derived or manually entered — seconds per mile */
  averagePaceSecondsPerMile?: number | null
  /** Optional, manual entry */
  averageHeartRate?: number | null
  completedAsPlanned?: boolean | null
}

export interface LoggedSetActual {
  targetReps?: number | string | null
  targetLoad?: string | null
  actualReps?: number | null
  actualLoad?: number | null
  completed?: boolean
  restSeconds?: number | null
  actualRestSeconds?: number | null
  notes?: string | null
}

export interface LoggedExerciseActual {
  exercise: string
  progressionMode?: 'single' | 'double' | 'volume' | 'maintenance'
  sets: LoggedSetActual[]
}

export interface WeightsWorkoutActual {
  exercises: LoggedExerciseActual[]
}

export interface SwimWorkoutActual {
  actualDistanceMeters?: number | null
  actualDurationMin?: number | null
  averagePaceSecondsPer100m?: number | null
  completedAsPlanned?: boolean | null
}

export interface ProgressionRecommendation {
  discipline: 'weights' | 'run' | 'swim'
  mode: 'single' | 'double' | 'volume' | 'endurance' | 'speed' | 'maintenance'
  action: 'progress' | 'hold' | 'regress'
  note: string
}

export interface WorkoutOutcome {
  /** `${planId}_${calendarDate}` */
  workoutInstanceId: string
  completionState: WorkoutCompletionState
  completedAt?: string | null
  durationActualMin?: number | null
  perceivedEffort?: PerceivedEffort | null
  notes?: string | null
  swapTargetWorkoutTemplateId?: string | null
  /** Only present for run slots */
  runActual?: RunWorkoutActual | null
  /** Only present for weights slots */
  weightsActual?: WeightsWorkoutActual | null
  /** Only present for swim slots */
  swimActual?: SwimWorkoutActual | null
  progressionRecommendation?: ProgressionRecommendation | null
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

import type { ActionType } from '../../types'

/**
 * Map a WorkoutCompletionState to the legacy ActionType used by historyStore.
 * - completed / partially_completed / swapped → 'complete'
 * - skipped → 'skip'
 * - deferred → 'day_off'
 * - planned → should never be persisted; default to 'complete'
 *
 * Note on rotation advancement: all three action types (complete, skip,
 * day_off) currently advance the rotation pointer by 1. See
 * `computeCurrentDayIndex` in rotationEngine.ts.
 */
export function completionStateToAction(state: WorkoutCompletionState): ActionType {
  switch (state) {
    case 'completed':
    case 'partially_completed':
    case 'swapped':
      return 'complete'
    case 'skipped':
      return 'skip'
    case 'deferred':
      return 'day_off'
    default:
      return 'complete'
  }
}

/** Format a completion state for display */
export const COMPLETION_STATE_LABELS: Record<WorkoutCompletionState, string> = {
  planned: 'Planned',
  completed: 'Completed',
  partially_completed: 'Partially Completed',
  skipped: 'Skipped',
  deferred: 'Deferred',
  swapped: 'Swapped',
}

/** Derive average pace (seconds/mile) from distance (miles) and duration (minutes) */
export function derivePaceSecondsPerMile(
  distanceMiles: number,
  durationMin: number,
): number {
  return (durationMin * 60) / distanceMiles
}

/** Derive swim pace (seconds / 100m) from distance (meters) and duration (minutes). */
export function deriveSwimPaceSecondsPer100m(
  distanceMeters: number,
  durationMin: number,
): number {
  return (durationMin * 60) / (distanceMeters / 100)
}

/** Format pace (seconds/mile) as "M:SS /mi" */
export function formatPace(secondsPerMile: number): string {
  // Round total seconds first to avoid a secs=60 display (e.g. "9:60 /mi")
  const totalSecs = Math.round(secondsPerMile)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')} /mi`
}

/** Format swim pace as "M:SS /100m" */
export function formatSwimPace(secondsPer100m: number): string {
  const totalSecs = Math.round(secondsPer100m)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')} /100m`
}
