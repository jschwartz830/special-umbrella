import type { ExtraWorkoutEntry, HistoryEntry, Plan, PlanDay, WorkoutSnapshot } from '../types'

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

/** A completed plan-day log that isn't part of the active plan (another or deleted plan). */
export interface OffPlanLog {
  entry: HistoryEntry
  planDay: PlanDay
  planName: string | null
}

/**
 * Completed workouts logged on `date` under any plan other than the active one,
 * resolved through the live plan when it still exists, else the log's snapshot.
 */
export function getOffPlanLogs(
  entries: HistoryEntry[],
  plans: Record<string, Plan>,
  activePlanId: string | null,
  date: string,
): OffPlanLog[] {
  const out: OffPlanLog[] = []
  for (const entry of entries) {
    if (entry.calendarDate !== date || entry.action !== 'complete' || entry.planId === activePlanId) continue
    const plan = plans[entry.planId]
    const planDay = plan?.days[entry.planDayIndex ?? -1]
      ?? (entry.workout ? snapshotToPlanDay(entry.workout, entry.id) : undefined)
    if (!planDay) continue
    out.push({ entry, planDay, planName: plan?.name ?? entry.workout?.planName ?? null })
  }
  return out
}
