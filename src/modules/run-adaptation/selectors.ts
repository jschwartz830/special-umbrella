// ── Run Adaptation Selectors ──────────────────────────────────────────────────

import type { WorkoutSlot } from '../../types'
import type { RunProgressionState, ResolvedWorkoutTarget } from './types'

/**
 * Resolve the display target for a workout slot, preferring active progression
 * state over static template fields.
 *
 * Falls back gracefully to legacy slot fields (targetDistance, targetPace, etc.)
 * so existing plans without runConfig continue to work unchanged.
 */
export function resolveWorkoutDisplayTarget(
  slot: WorkoutSlot,
  progressionState?: RunProgressionState | null,
): ResolvedWorkoutTarget {
  const rc = slot.runConfig ?? null

  if (!rc) {
    // No runConfig — return legacy fields
    return {
      targetDistanceMiles: slot.targetDistance ?? null,
      targetDurationMin: slot.targetDuration ?? slot.targetTime ?? null,
      isFromProgression: false,
    }
  }

  // Resolve distance: progression > runConfig > legacy
  const progressionDistance = progressionState?.currentTargetDistanceMiles ?? null
  const configDistance = rc.targetDistanceMiles ?? slot.targetDistance ?? null
  const resolvedDistance = progressionDistance ?? configDistance

  const isFromProgression = progressionDistance != null && progressionDistance !== configDistance

  return {
    targetDistanceMiles: resolvedDistance,
    targetDurationMin: rc.targetDurationMin ?? slot.targetDuration ?? slot.targetTime ?? null,
    targetPaceRange: rc.targetPaceRange ?? null,
    structureText: rc.targetStructureText ?? null,
    subtype: rc.subtype,
    isFromProgression,
    adaptationNote: buildAdaptationNote(progressionState, isFromProgression),
  }
}

function buildAdaptationNote(
  state: RunProgressionState | null | undefined,
  isFromProgression: boolean,
): string | null {
  if (!state || !isFromProgression) return null
  const dist = state.currentTargetDistanceMiles
  if (dist == null) return null

  switch (state.lastResult) {
    case 'progress':
      return `Progressed to ${dist} mi after successful completion`
    case 'hold':
      return `Holding at ${dist} mi`
    case 'regress':
      return `Stepped back to ${dist} mi`
    case 'reset':
      return `Reset to ${dist} mi`
    default:
      return `Targeting ${dist} mi`
  }
}
