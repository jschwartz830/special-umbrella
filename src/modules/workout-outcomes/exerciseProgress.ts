import type { ExerciseSpec } from '../../types/program'
import type { LoggedExerciseActual } from './types'

/**
 * How one exercise went, for its progression rule:
 * - 'hit'        every working set completed at the top of its rep range → rule's `then`
 * - 'missed'     every working set completed, but some fell short        → rule's `else`
 * - 'incomplete' exercise skipped or not all working sets done          → no rule fires
 */
export type ExerciseProgressResult = 'hit' | 'missed' | 'incomplete'

/** Top of a rep target: "8-12" → 12, "5+" → 5, 5 → 5. Null when there's no rep number (AMRAP, timed). */
export function topOfRepRange(reps: number | string | null | undefined): number | null {
  if (typeof reps === 'number') return Number.isFinite(reps) ? reps : null
  if (typeof reps !== 'string') return null
  const nums = reps.match(/\d+/g)
  return nums ? Math.max(...nums.map(Number)) : null
}

export function evaluateExerciseProgress(
  spec: ExerciseSpec,
  logged: LoggedExerciseActual | undefined,
): ExerciseProgressResult {
  const work = (logged?.sets ?? []).filter(s => !s.isWarmup)
  if (work.length === 0 || !work.every(s => s.completed)) return 'incomplete'
  const setSpecs = Array.isArray(spec.sets) ? spec.sets : []
  const allHit = work.every((s, i) => {
    const target = setSpecs.length > 0
      ? (setSpecs[Math.min(i, setSpecs.length - 1)].reps ?? spec.reps)
      : spec.reps
    const top = topOfRepRange(target)
    return top == null || (s.actualReps ?? 0) >= top
  })
  return allHit ? 'hit' : 'missed'
}
