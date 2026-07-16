import { parseWorkoutInstanceId } from './workoutInstanceId'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

/**
 * Stable sort key for an outcome: prefer completedAt (a full ISO datetime)
 * when present; fall back to the calendarDate embedded in workoutInstanceId
 * so that outcomes without completedAt are still sorted by workout date.
 * When neither source yields a date (corrupted data), use a prefix that
 * sorts before any valid date so these entries consistently appear at the
 * bottom of a descending sort rather than non-deterministically equal.
 */
export function outcomeSortKey(outcome: WorkoutOutcome): string {
  return (
    outcome.completedAt ??
    parseWorkoutInstanceId(outcome.workoutInstanceId)?.calendarDate ??
    `0000-00-00_${outcome.workoutInstanceId}`
  )
}
