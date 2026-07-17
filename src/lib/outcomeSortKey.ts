import { parseWorkoutInstanceId } from './workoutInstanceId'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

/**
 * Stable sort key for an outcome: prefer completedAt (a full ISO datetime)
 * when present; fall back to the calendarDate embedded in workoutInstanceId
 * so that outcomes without completedAt are still sorted by workout date.
 * Using '' as the fallback would make all non-completedAt outcomes compare
 * as equal, returning whichever Object.values() iteration order happened to
 * be first. The final fallback to workoutInstanceId itself ensures a
 * deterministic (if arbitrary) ordering even for malformed instance IDs.
 */
export function outcomeSortKey(outcome: WorkoutOutcome): string {
  return outcome.completedAt ?? parseWorkoutInstanceId(outcome.workoutInstanceId)?.calendarDate ?? outcome.workoutInstanceId
}
