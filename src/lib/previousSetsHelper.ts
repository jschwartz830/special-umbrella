import type { WorkoutOutcome, LoggedSetActual } from '../modules/workout-outcomes/types'
import { outcomeSortKey } from './outcomeSortKey'

/**
 * Find the most recent outcome with weights data for a plan, excluding
 * `currentDate` and any future-dated outcomes.
 *
 * The exclusion predicate `rest.slice(0, 10) >= currentDate` matches the guard
 * in `findPreviousSetsByExercise` and `findPreviousSessionForPlanDay` — it
 * excludes both today's outcomes and any future-dated outcomes from a bad CSV
 * import, which would otherwise rank first (newest sort key) and be returned
 * as the "previous" workout.
 *
 * Used by TodayPage to pre-fill `ActiveWorkoutTracker` with the previous
 * weights session.
 */
export function findPreviousWeightsOutcome(
  planId: string,
  currentDate: string,
  outcomes: Record<string, WorkoutOutcome>,
): WorkoutOutcome | null {
  const prefix = planId + '_'
  let best: WorkoutOutcome | null = null
  for (const outcome of Object.values(outcomes)) {
    if (!outcome.workoutInstanceId.startsWith(prefix)) continue
    const rest = outcome.workoutInstanceId.slice(prefix.length)
    if (rest.slice(0, 10) >= currentDate) continue
    if (!outcome.weightsActual?.exercises?.length) continue
    if (!best || outcomeSortKey(outcome) > outcomeSortKey(best)) best = outcome
  }
  return best
}

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
      if (rest.slice(0, 10) >= currentDate) return false
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
