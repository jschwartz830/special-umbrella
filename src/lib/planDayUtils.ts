import type { ExtraWorkoutEntry, PlanDay } from '../types'

/**
 * Build a minimal synthetic PlanDay from an ExtraWorkoutEntry so that
 * OutcomeModal, WorkoutSlotDetails, and ActiveWorkoutTracker can render it
 * using the same slot-based interface as rotation plan days.
 */
export function extraToPlanDay(extra: ExtraWorkoutEntry): PlanDay {
  return {
    id: extra.id,
    label: extra.workoutName,
    slots: [{ id: extra.id, type: extra.workoutType, name: extra.workoutName }],
  }
}
