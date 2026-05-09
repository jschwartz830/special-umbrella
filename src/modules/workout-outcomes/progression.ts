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

function buildWeightsRecommendation(
  exercises: LoggedExerciseActual[],
  effort: number | null,
): ProgressionRecommendation | null {
  if (exercises.length === 0) return null

  const allSets = exercises.flatMap(ex => ex.sets)
  const completedSets = allSets.filter(s => s.completed)
  if (completedSets.length === 0) return null

  const mode = exercises[0].progressionMode ?? 'single'

  if ((effort ?? 0) >= 5) {
    return {
      discipline: 'weights',
      mode,
      action: 'regress',
      note: 'Use a 5-10% load reduction next session and rebuild quality reps.',
    }
  }

  if (mode === 'double') {
    const allHit = completedSets.every(s => s.actualReps != null && typeof s.targetReps === 'number' ? s.actualReps >= s.targetReps : true)
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
    return {
      discipline: 'weights',
      mode,
      action: 'hold',
      note: 'Volume progression: add one set or small rep bump while keeping form sharp.',
    }
  }

  // allCompleted uses allSets so that partially-done workouts (some sets not
  // completed) correctly receive the 'hold' recommendation rather than 'progress'.
  const allCompleted = allSets.every(s => s.completed === true)
  return {
    discipline: 'weights',
    mode: 'single',
    action: allCompleted ? 'progress' : 'hold',
    note: allCompleted
      ? 'Single progression: add 2.5-5 lb next session on this lift.'
      : 'Repeat current load next session until all sets are completed cleanly.',
  }
}
