import { parseWorkoutInstanceId } from './workoutInstanceId'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

/**
 * Stable sort key for an outcome. Primary key: completedAt (a full ISO
 * datetime) when present, falling back to the calendarDate embedded in
 * workoutInstanceId. Secondary key: workoutInstanceId itself, appended after
 * a null-byte delimiter, so that two outcomes logged at the exact same second
 * always produce a deterministic (if arbitrary) order.
 */
export function outcomeSortKey(outcome: WorkoutOutcome): string {
  const primary = outcome.completedAt ?? parseWorkoutInstanceId(outcome.workoutInstanceId)?.calendarDate ?? ''
  return `${primary}\x00${outcome.workoutInstanceId}`
}
