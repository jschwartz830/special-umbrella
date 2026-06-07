import type { WorkoutOutcome, LoggedSetActual } from '../modules/workout-outcomes/types'
import { outcomeSortKey } from './outcomeSortKey'

/**
 * Find the most recent set data per exercise for a plan, excluding any outcome
 * on `currentDate` (and optionally a specific `excludeInstanceId`).
 *
 * Returns a map of exercise name → the sets from its most recent prior session.
 * Used by OutcomeModal to pre-fill set weights/reps from the last time the
 * exercise was performed.
 *
 * @param planId           Plan to scope the lookup to.
 * @param currentDate      YYYY-MM-DD — outcomes on this date are excluded.
 * @param outcomes         Full outcomes map from outcomeStore.
 * @param excludeInstanceId  Optional: also exclude this specific instance ID
 *                           (e.g. the outcome currently being edited).
 */
export function findPreviousSetsByExercise(
  planId: string,
  currentDate: string,
  outcomes: Record<string, WorkoutOutcome>,
  excludeInstanceId?: string,
): Record<string, LoggedSetActual[]> {
  const prefix = planId + '_'
  const sortedOutcomes = Object.values(outcomes)
    .filter(outcome => {
      if (excludeInstanceId && outcome.workoutInstanceId === excludeInstanceId) return false
      if (!outcome.workoutInstanceId.startsWith(prefix)) return false
      const rest = outcome.workoutInstanceId.slice(prefix.length)
      if (rest.startsWith(currentDate)) return false
      return Boolean(outcome.weightsActual?.exercises?.length)
    })
    .sort((a, b) => outcomeSortKey(b).localeCompare(outcomeSortKey(a)))

  const byExercise: Record<string, LoggedSetActual[]> = {}
  for (const outcome of sortedOutcomes) {
    for (const ex of outcome.weightsActual?.exercises ?? []) {
      if (!byExercise[ex.exercise]) byExercise[ex.exercise] = ex.sets
    }
  }
  return byExercise
}
