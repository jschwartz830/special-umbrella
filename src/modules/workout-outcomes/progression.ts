import type { WorkoutSlot } from '../../types'
import type {
  ProgressionRecommendation,
  WorkoutOutcome,
  LoggedExerciseActual,
} from './types'

export function buildProgressionRecommendation(
  slot: WorkoutSlot,
  outcome: WorkoutOutcome,
): ProgressionRecommendation | null {
  if (slot.type === 'weights' || slot.type === 'weightlifting') {
    return buildWeightsRecommendation(outcome.weightsActual?.exercises ?? [], outcome.perceivedEffort ?? null)
  }

  if (slot.type === 'run' || slot.type === 'long_run' || slot.type === 'recovery_run') {
    const actual = outcome.runActual
    if (!actual) return null
    const completed = outcome.completionState === 'completed'
    if (completed && actual.completedAsPlanned !== false && (outcome.perceivedEffort ?? 3) <= 3) {
      return {
        discipline: 'run',
        mode: 'endurance',
        action: 'progress',
        note: 'Progress next run by +5-10% distance or add 1 interval rep.',
      }
    }
    if ((outcome.perceivedEffort ?? 0) >= 5) {
      return {
        discipline: 'run',
        mode: 'maintenance',
        action: 'regress',
        note: 'High effort detected — reduce next target by 5% and prioritize recovery.',
      }
    }
    return {
      discipline: 'run',
      mode: 'maintenance',
      action: 'hold',
      note: 'Hold target next session and aim for smoother execution.',
    }
  }

  if (slot.type === 'swim') {
    const actual = outcome.swimActual
    if (!actual) return null
    const completed = outcome.completionState === 'completed'
    if (completed && actual.completedAsPlanned !== false && (outcome.perceivedEffort ?? 3) <= 3) {
      return {
        discipline: 'swim',
        mode: 'speed',
        action: 'progress',
        note: 'Progress next swim with +100-200m volume or slightly faster pace target.',
      }
    }
    if ((outcome.perceivedEffort ?? 0) >= 5) {
      return {
        discipline: 'swim',
        mode: 'maintenance',
        action: 'regress',
        note: 'Regress slightly next swim: reduce volume and focus on technique.',
      }
    }
    return {
      discipline: 'swim',
      mode: 'maintenance',
      action: 'hold',
      note: 'Hold swim target and repeat until effort is controlled.',
    }
  }

  return null
}

function allSetsHitTarget(
  allSets: LoggedExerciseActual['sets'],
  completedSets: LoggedExerciseActual['sets'],
): boolean {
  if (!allSets.every(s => s.completed === true)) return false
  return completedSets.every(s => {
    if (typeof s.targetReps === 'number') {
      // Require actual reps to be recorded and meet the target.
      return s.actualReps != null && s.actualReps >= s.targetReps
    }
    // String target (rep range like "6-10", AMRAP "5+") or no target — completing suffices.
    return true
  })
}

function buildWeightsRecommendation(
  exercises: LoggedExerciseActual[],
  effort: number | null,
): ProgressionRecommendation | null {
  if (exercises.length === 0) return null

  const allSets = exercises.flatMap(ex => ex.sets)
  const completedSets = allSets.filter(s => s.completed)
  if (completedSets.length === 0) return null

  // Only generate a recommendation when progression logic is explicitly configured.
  if (!exercises.some(ex => ex.progressionMode != null)) return null

  // Read mode from the first exercise that actually has one configured, not always [0].
  // Exercises[0] may be a warmup-only entry without a progressionMode when a later
  // working-set exercise carries it.
  const modeSource = exercises.find(ex => ex.progressionMode != null)!
  const mode = modeSource.progressionMode ?? 'single'

  if ((effort ?? 0) >= 5) {
    return {
      discipline: 'weights',
      mode,
      action: 'regress',
      note: 'Use a 5-10% load reduction next session and rebuild quality reps.',
    }
  }

  if (mode === 'double') {
    const allHit = allSetsHitTarget(allSets, completedSets)
    return {
      discipline: 'weights',
      mode,
      action: allHit ? 'progress' : 'hold',
      note: allHit
        ? 'Double progression: increase reps toward top of range, then add load.'
        : 'Double progression: hold load and complete all target reps first.',
    }
  }

  if (mode === 'volume') {
    const allHit = allSetsHitTarget(allSets, completedSets)
    return {
      discipline: 'weights',
      mode,
      action: allHit ? 'progress' : 'hold',
      note: allHit
        ? 'Volume progression: add one set or a small rep bump next session.'
        : 'Volume progression: hit all target reps before adding volume.',
    }
  }

  // Single (and maintenance fallback)
  const allHit = allSetsHitTarget(allSets, completedSets)
  return {
    discipline: 'weights',
    mode: 'single',
    action: allHit ? 'progress' : 'hold',
    note: allHit
      ? 'Single progression: add 2.5-5 lb next session on this lift.'
      : 'Repeat current load next session until all sets and target reps are completed.',
  }
}
