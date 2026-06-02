import { parseWorkoutInstanceId } from './workoutInstanceId'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

/**
 * Stable sort key for an outcome: prefer completedAt (a full ISO datetime)
 * when present; fall back to the calendarDate embedded in workoutInstanceId
 * so that outcomes without completedAt are still sorted by workout date.
 * Using '' as the fallback would make all non-completedAt outcomes compare
 * as equal, returning whichever Object.values() iteration order happened to
 * be first.
 */
export function outcomeSortKey(outcome: WorkoutOutcome): string {
  return outcome.completedAt ?? parseWorkoutInstanceId(outcome.workoutInstanceId)?.calendarDate ?? ''
}
