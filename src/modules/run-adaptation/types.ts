// ── Run Adaptation Types ──────────────────────────────────────────────────────

import type { PaceRange } from '../workout-metadata/types'

export type ProgressionAction = 'progress' | 'hold' | 'regress' | 'reset' | 'none'

export interface RunProgressionState {
  progressionGroupId: string
  currentTargetDistanceMiles?: number | null
  lastCompletedWorkoutInstanceId?: string | null
  lastResult?: 'progress' | 'hold' | 'regress' | 'reset' | null
  updatedAt: string
}

export interface RunProgressionDecision {
  action: ProgressionAction
  nextTargetDistanceMiles?: number | null
  reason: string
}

/** Resolved display target for a workout — used by the UI */
export interface ResolvedWorkoutTarget {
  targetDistanceMiles?: number | null
  targetDurationMin?: number | null
  targetPaceRange?: PaceRange | null
  structureText?: string | null
  subtype?: string | null
  /** True when target comes from active progression state, false = static template */
  isFromProgression: boolean
  /** Human-readable adaptation status, e.g. "Progressed to 5.5 mi" */
  adaptationNote?: string | null
}
