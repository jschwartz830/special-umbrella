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
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

import type { ActionType } from '../../types'

/**
 * Map a WorkoutCompletionState to the legacy ActionType used by historyStore.
 * - completed / partially_completed / swapped → 'complete' (advances rotation)
 * - skipped → 'skip' (advances rotation)
 * - deferred → 'day_off' (does NOT advance rotation)
 * - planned → should never be persisted; default to 'complete'
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

/** Format pace (seconds/mile) as "M:SS /mi" */
export function formatPace(secondsPerMile: number): string {
  const mins = Math.floor(secondsPerMile / 60)
  const secs = Math.round(secondsPerMile % 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /mi`
}
