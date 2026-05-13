// ── Recommendation Explanation ────────────────────────────────────────────────

import type { WorkoutSlot } from '../../types'
import type { RunProgressionState } from '../run-adaptation/types'
import type { WorkoutOutcome } from '../workout-outcomes/types'
import { formatPace } from '../workout-outcomes/types'
import type { WorkoutDifficulty } from '../workout-metadata/types'
import { resolveWorkoutDisplayTarget } from '../run-adaptation/selectors'

/**
 * Generate a short plain-text explanation for why the current run target
 * was chosen.  Returns null for non-run slots or when there's nothing notable.
 */
export function generateRunAdaptationNote(
  slot: WorkoutSlot,
  progressionState?: RunProgressionState | null,
): string | null {
  if (!slot.runConfig?.progressionEligible) return null
  const resolved = resolveWorkoutDisplayTarget(slot, progressionState)
  return resolved.adaptationNote ?? null
}

/**
 * Produce an advisory message when two consecutive hard workouts are detected
 * (e.g. due to a prior defer/skip causing a heavy workout to stack next to another).
 */
export function generateDifficultySpacingWarning(
  todayDifficulty: WorkoutDifficulty | null | undefined,
  nextDifficulty: WorkoutDifficulty | null | undefined,
): string | null {
  if (todayDifficulty === 'hard' && nextDifficulty === 'hard') {
    return 'Back-to-back hard workouts detected — consider lightening tomorrow or adding a rest day.'
  }
  return null
}

/**
 * Given the last logged outcome for a run, produce a brief summary suitable
 * for display in the history view.
 */
export function summariseRunOutcome(outcome: WorkoutOutcome): string | null {
  const ra = outcome.runActual
  if (!ra) return null

  const parts: string[] = []
  if (ra.actualDistanceMiles != null) parts.push(`${ra.actualDistanceMiles} mi`)
  if (ra.actualDurationMin != null) parts.push(`${ra.actualDurationMin} min`)
  if (ra.averagePaceSecondsPerMile != null && ra.averagePaceSecondsPerMile > 0) {
    parts.push(formatPace(ra.averagePaceSecondsPerMile))
  }
  return parts.length ? parts.join(' · ') : null
}
