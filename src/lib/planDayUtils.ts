import type { ExtraWorkoutEntry, Plan, PlanDay, WorkoutSnapshot } from '../types'

/** Sentinel planId for workouts logged with no plan (e.g. ad hoc with no active plan). */
export const NO_PLAN_ID = ''

/** Capture what a plan day contained, for storing alongside a log entry. */
export function snapshotPlanDay(plan: Plan | undefined, dayIndex: number | undefined): WorkoutSnapshot | undefined {
  const day = plan && dayIndex != null ? plan.days[dayIndex] : undefined
  if (!plan || !day) return undefined
  return {
    planName: plan.name,
    dayLabel: day.label,
    slots: day.slots.map(s => ({
      type: s.type,
      name: s.name,
      ...(s.subtype ? { subtype: s.subtype } : {}),
      ...(s.location ? { location: s.location } : {}),
    })),
  }
}

/** Minimal PlanDay rebuilt from a snapshot, for viewing/editing logs whose plan is gone. */
export function snapshotToPlanDay(snapshot: WorkoutSnapshot, id: string): PlanDay {
  return {
    id,
    label: snapshot.dayLabel ?? snapshot.slots.map(s => s.name).join(' + '),
    slots: snapshot.slots.map((s, i) => ({ id: `${id}-${i}`, ...s })),
  }
}

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
