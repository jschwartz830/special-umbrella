import type { LoggedExerciseActual } from './types'

/**
 * Map a raw progression type string (from ExerciseSpec) to the canonical
 * progressionMode label stored on LoggedExerciseActual. Returns undefined
 * when neither a progression type nor a progress rule is present, meaning
 * progression tracking is not configured for this exercise.
 */
export function deriveProgressionMode(
  progressionType: string | undefined,
  hasProgressRule: boolean,
): LoggedExerciseActual['progressionMode'] {
  if (!progressionType && !hasProgressRule) return undefined
  if (progressionType === 'double' || progressionType === 'dynamic_double') return 'double'
  if (progressionType === 'triple') return 'volume'
  if (progressionType === 'step_loading') return 'maintenance'
  return 'single'
}
