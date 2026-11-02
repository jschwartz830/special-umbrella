import type { PlanDay, WorkoutSlot } from '../types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'
import { isRunType } from '../modules/workout-metadata/types'

/**
 * A part of a plan day: one with its own live tracker, or `other` — a part done
 * off the app (a class, swim, yoga) that's simply marked done.
 */
export type SegmentKind = 'weights' | 'cardio' | 'mobility' | 'other'

export interface WorkoutSegment {
  kind: SegmentKind
  slot: WorkoutSlot
}

function segmentKindForSlot(slot: WorkoutSlot): SegmentKind | null {
  if (isRunType(slot.type)) return 'cardio'
  if (slot.type === 'mobility') return 'mobility'
  if ((slot.exercises?.length ?? 0) > 0 || (slot.warmup?.length ?? 0) > 0) return 'weights'
  if (slot.type === 'rest' || slot.subtype === 'rest') return null
  return 'other'
}

/**
 * Segments of a plan day in slot order, e.g. run → class.
 * One per kind — each tracker handles a single slot of its kind.
 */
export function workoutSegments(planDay: PlanDay): WorkoutSegment[] {
  const segments: WorkoutSegment[] = []
  for (const slot of planDay.slots) {
    const kind = segmentKindForSlot(slot)
    if (kind && !segments.some(s => s.kind === kind)) segments.push({ kind, slot })
  }
  return segments
}

/** Whether a logged outcome already carries data for a segment. */
export function isSegmentLogged(kind: SegmentKind, outcome: WorkoutOutcome): boolean {
  switch (kind) {
    case 'weights':
      return !!outcome.weightsActual?.exercises?.some(ex => ex.sets.some(s => s.completed))
    case 'cardio':
      return outcome.runActual?.actualDurationMin != null || outcome.runActual?.actualDistanceMiles != null
    case 'mobility':
      return !!outcome.mobilityActual?.exercises?.some(ex => ex.sets.some(s => s.completed))
    case 'other':
      return outcome.otherSegmentDone === true
        || outcome.swimActual?.actualDurationMin != null
        || outcome.swimActual?.actualDistanceMeters != null
  }
}

/** First segment not in `doneKinds`, or null when the day is finished. */
export function nextSegment(planDay: PlanDay, doneKinds: SegmentKind[]): WorkoutSegment | null {
  return workoutSegments(planDay).find(s => !doneKinds.includes(s.kind)) ?? null
}

/** Segments of an already-logged day that the outcome has no data for yet. */
export function remainingSegments(planDay: PlanDay, outcome: WorkoutOutcome | null): WorkoutSegment[] {
  if (!outcome) return []
  const segments = workoutSegments(planDay)
  if (segments.length < 2) return []
  return segments.filter(s => !isSegmentLogged(s.kind, outcome))
}
