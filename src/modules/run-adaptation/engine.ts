// ── Run Adaptation Engine ─────────────────────────────────────────────────────
// Pure, deterministic functions — no side effects, fully testable.

import type { WorkoutSlot } from '../../types'
import type { WorkoutOutcome } from '../workout-outcomes/types'
import type { RunProgressionState, RunProgressionDecision } from './types'

const DEFAULT_STEP_MILES = 0.5

/**
 * Evaluate whether the next run in the same progression group should
 * progress, hold, regress, or reset based on the completed outcome.
 *
 * Returns { action: 'none' } for non-run / non-progression-eligible slots.
 */
export function evaluateRunProgression(
  slot: WorkoutSlot,
  outcome: WorkoutOutcome,
  previousState?: RunProgressionState | null,
): RunProgressionDecision {
  // Only run slots with progressionEligible = true participate
  if (!slot.runConfig?.progressionEligible) {
    return { action: 'none', reason: 'not_progression_eligible' }
  }

  // Skipped or deferred runs: hold — never auto-progress
  if (outcome.completionState === 'skipped' || outcome.completionState === 'deferred') {
    return {
      action: 'hold',
      nextTargetDistanceMiles: previousState?.currentTargetDistanceMiles ?? slot.runConfig?.targetDistanceMiles ?? null,
      reason: 'not_completed',
    }
  }

  // Resolve current target: progression state → runConfig → null
  const targetDistance: number | null =
    previousState?.currentTargetDistanceMiles ??
    slot.runConfig?.targetDistanceMiles ??
    null

  // Without a target distance we can't meaningfully progress distance
  if (targetDistance == null) {
    return {
      action: 'hold',
      reason: 'no_target_distance',
    }
  }

  const actualDistance = outcome.runActual?.actualDistanceMiles ?? null
  const effort = outcome.perceivedEffort ?? null
  const completedAsPlanned = outcome.runActual?.completedAsPlanned ?? null
  const step = slot.runConfig?.defaultStepMiles ?? DEFAULT_STEP_MILES
  const baseline = slot.runConfig?.targetDistanceMiles ?? targetDistance

  // Did the runner hit the target?
  // True if actual >= 95% of target, OR if completedAsPlanned is explicitly true when no actual distance
  const hitTarget =
    actualDistance != null
      ? actualDistance >= targetDistance * 0.95
      : completedAsPlanned === true

  // ── Progress: completed + hit target + effort ≤ 3 ────────────────────────
  if (
    outcome.completionState === 'completed' &&
    hitTarget &&
    (effort == null || effort <= 3)
  ) {
    const next = roundMiles(targetDistance + step)
    return {
      action: 'progress',
      nextTargetDistanceMiles: next,
      reason: 'successful_completion',
    }
  }

  // ── Regress: effort = 5 (max) ─────────────────────────────────────────────
  if (effort === 5) {
    return {
      action: 'regress',
      nextTargetDistanceMiles: Math.max(roundMiles(targetDistance - step), baseline),
      reason: 'high_effort',
    }
  }

  // ── Regress: partial completion with significant underperformance ──────────
  if (
    outcome.completionState === 'partially_completed' &&
    actualDistance != null &&
    actualDistance < targetDistance * 0.8
  ) {
    return {
      action: 'regress',
      nextTargetDistanceMiles: Math.max(roundMiles(targetDistance - step), baseline),
      reason: 'under_completion',
    }
  }

  // ── Hold: borderline (completed + hit target + effort 4, or partial) ──────
  if (
    (outcome.completionState === 'completed' && hitTarget && effort === 4) ||
    outcome.completionState === 'partially_completed'
  ) {
    return {
      action: 'hold',
      nextTargetDistanceMiles: targetDistance,
      reason: 'borderline_completion',
    }
  }

  // ── Default hold ──────────────────────────────────────────────────────────
  return {
    action: 'hold',
    nextTargetDistanceMiles: targetDistance,
    reason: 'default_hold',
  }
}

/**
 * Apply a progression decision to produce the new RunProgressionState.
 * Call this immediately after evaluateRunProgression to persist the result.
 */
export function applyRunProgressionDecision(
  workoutInstanceId: string,
  progressionGroupId: string,
  decision: RunProgressionDecision,
  previousState?: RunProgressionState | null,
): RunProgressionState {
  const now = new Date().toISOString()

  if (decision.action === 'none') {
    // Return unchanged state (or create minimal placeholder)
    return previousState ?? {
      progressionGroupId,
      updatedAt: now,
    }
  }

  return {
    progressionGroupId,
    currentTargetDistanceMiles: decision.nextTargetDistanceMiles ?? previousState?.currentTargetDistanceMiles ?? null,
    lastCompletedWorkoutInstanceId: workoutInstanceId,
    lastResult: decision.action,
    updatedAt: now,
  }
}

/** Round miles to 2 decimal places, using epsilon to avoid binary representation drift */
function roundMiles(miles: number): number {
  return Math.round((miles + Number.EPSILON) * 100) / 100
}
