import { describe, it, expect } from 'vitest'
import { evaluateRunProgression, applyRunProgressionDecision } from '../engine'
import type { WorkoutSlot } from '../../../types'
import type { WorkoutOutcome } from '../../workout-outcomes/types'
import type { RunProgressionState } from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<WorkoutSlot['runConfig']> = {}): WorkoutSlot {
  return {
    id: 'slot-1',
    type: 'long_run',
    name: 'Long Run',
    targetDistance: 5,
    runConfig: {
      subtype: 'long_run',
      targetDistanceMiles: 5,
      progressionEligible: true,
      progressionGroupId: 'long-run',
      defaultStepMiles: 0.5,
      ...overrides,
    },
  }
}

function makeOutcome(overrides: Partial<WorkoutOutcome> = {}): WorkoutOutcome {
  return {
    workoutInstanceId: 'plan1_2026-01-01',
    completionState: 'completed',
    perceivedEffort: 3,
    runActual: {
      actualDistanceMiles: 5.1,
      actualDurationMin: 52,
      completedAsPlanned: true,
    },
    ...overrides,
  }
}

function makeState(overrides: Partial<RunProgressionState> = {}): RunProgressionState {
  return {
    progressionGroupId: 'long-run',
    currentTargetDistanceMiles: 5,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── evaluateRunProgression ────────────────────────────────────────────────────

describe('evaluateRunProgression', () => {
  it('returns none for non-progression-eligible slots', () => {
    const slot = makeSlot({ progressionEligible: false })
    const result = evaluateRunProgression(slot, makeOutcome())
    expect(result.action).toBe('none')
  })

  it('returns none when runConfig is missing', () => {
    const slot: WorkoutSlot = { id: 's', type: 'long_run', name: 'Run' }
    const result = evaluateRunProgression(slot, makeOutcome())
    expect(result.action).toBe('none')
  })

  it('holds when skipped', () => {
    const result = evaluateRunProgression(
      makeSlot(),
      makeOutcome({ completionState: 'skipped' }),
    )
    expect(result.action).toBe('hold')
    expect(result.reason).toBe('not_completed')
  })

  it('holds when deferred', () => {
    const result = evaluateRunProgression(
      makeSlot(),
      makeOutcome({ completionState: 'deferred' }),
    )
    expect(result.action).toBe('hold')
    expect(result.reason).toBe('not_completed')
  })

  it('holds when no target distance is available', () => {
    const slot = makeSlot({ targetDistanceMiles: undefined })
    const result = evaluateRunProgression(slot, makeOutcome(), null)
    expect(result.action).toBe('hold')
    expect(result.reason).toBe('no_target_distance')
  })

  describe('progress path', () => {
    it('progresses on completed + hit target + effort ≤ 3', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: 3, runActual: { actualDistanceMiles: 5.1, completedAsPlanned: true } }),
        makeState(),
      )
      expect(result.action).toBe('progress')
      expect(result.nextTargetDistanceMiles).toBe(5.5)
      expect(result.reason).toBe('successful_completion')
    })

    it('progresses when effort is null (not logged)', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: null, runActual: { actualDistanceMiles: 5.0, completedAsPlanned: true } }),
        makeState(),
      )
      expect(result.action).toBe('progress')
    })

    it('progresses from progression state target, not template baseline', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: 2, runActual: { actualDistanceMiles: 6.0 } }),
        makeState({ currentTargetDistanceMiles: 6 }),
      )
      expect(result.action).toBe('progress')
      expect(result.nextTargetDistanceMiles).toBe(6.5)
    })

    it('uses completedAsPlanned = true as a proxy when no distance logged', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          perceivedEffort: 2,
          runActual: { actualDistanceMiles: null, completedAsPlanned: true },
        }),
        makeState(),
      )
      expect(result.action).toBe('progress')
    })
  })

  describe('hold path', () => {
    it('holds when effort = 4 and hit target', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: 4, runActual: { actualDistanceMiles: 5.0 } }),
        makeState(),
      )
      expect(result.action).toBe('hold')
      expect(result.nextTargetDistanceMiles).toBe(5)
      expect(result.reason).toBe('borderline_completion')
    })

    it('holds on partially_completed when not far below target', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'partially_completed',
          perceivedEffort: 3,
          runActual: { actualDistanceMiles: 4.5 }, // 90% of 5 — above 80% threshold
        }),
        makeState(),
      )
      expect(result.action).toBe('hold')
    })
  })

  describe('regress path', () => {
    it('regresses when effort = 5', () => {
      // Start from 6 mi so there is room to regress (baseline is 5)
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: 5, runActual: { actualDistanceMiles: 6.0 } }),
        makeState({ currentTargetDistanceMiles: 6 }),
      )
      expect(result.action).toBe('regress')
      expect(result.nextTargetDistanceMiles).toBe(5.5)
      expect(result.reason).toBe('high_effort')
    })

    it('regresses when partial completion < 80% of target', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'partially_completed',
          perceivedEffort: 3,
          runActual: { actualDistanceMiles: 3.5 }, // 70% of 5
        }),
        makeState(),
      )
      expect(result.action).toBe('regress')
      expect(result.reason).toBe('under_completion')
    })

    it('never regresses below baseline', () => {
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({ perceivedEffort: 5, runActual: { actualDistanceMiles: 5.0 } }),
        makeState({ currentTargetDistanceMiles: 5 }), // already at baseline (5 mi)
      )
      expect(result.action).toBe('regress')
      expect(result.nextTargetDistanceMiles).toBe(5) // can't go below baseline
    })

    it('custom step size is respected on regress', () => {
      const slot = makeSlot({ defaultStepMiles: 1.0, targetDistanceMiles: 3 })
      const result = evaluateRunProgression(
        slot,
        makeOutcome({ perceivedEffort: 5, runActual: { actualDistanceMiles: 6.0 } }),
        makeState({ currentTargetDistanceMiles: 6 }),
      )
      expect(result.action).toBe('regress')
      expect(result.nextTargetDistanceMiles).toBe(5)
    })

    it('effort=5 regresses even when completionState is partially_completed', () => {
      // effort=5 check fires before the partial-completion check; ensure both paths
      // land on regress (not accidentally on the partial-hold branch).
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'partially_completed',
          perceivedEffort: 5,
          runActual: { actualDistanceMiles: 4.2 },
        }),
        makeState({ currentTargetDistanceMiles: 5 }),
      )
      expect(result.action).toBe('regress')
      expect(result.reason).toBe('high_effort')
    })
  })

  describe('default hold path', () => {
    it('holds when completed but distance is between 80–95% of target (missed 95% threshold)', () => {
      // actualDistance = 4.6 mi is 92% of 5 mi → not hitTarget (< 95%), not partial
      // → not progress, not effort-regress, not partial-regress → default hold
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'completed',
          perceivedEffort: 3,
          runActual: { actualDistanceMiles: 4.6 },
        }),
        makeState(),
      )
      expect(result.action).toBe('hold')
      expect(result.reason).toBe('default_hold')
      expect(result.nextTargetDistanceMiles).toBe(5)
    })

    it('holds when completed + missed target + effort=4 (hold check requires hitTarget)', () => {
      // hitTarget = false (4.7 < 4.75), effort = 4
      // The explicit hold check: (completed && hitTarget && effort===4) = false
      // Falls to default hold.
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'completed',
          perceivedEffort: 4,
          runActual: { actualDistanceMiles: 4.7 }, // 94% of 5 — just below 95%
        }),
        makeState(),
      )
      expect(result.action).toBe('hold')
      expect(result.reason).toBe('default_hold')
    })

    it('holds when completedAsPlanned=false and no actual distance (cannot evaluate hitTarget)', () => {
      // No distance logged + completedAsPlanned=false → hitTarget=false → default hold
      const result = evaluateRunProgression(
        makeSlot(),
        makeOutcome({
          completionState: 'completed',
          perceivedEffort: 2,
          runActual: { actualDistanceMiles: null, completedAsPlanned: false },
        }),
        makeState(),
      )
      expect(result.action).toBe('hold')
    })
  })
})

// ── applyRunProgressionDecision ───────────────────────────────────────────────

describe('applyRunProgressionDecision', () => {
  it('returns previous state unchanged for action = none', () => {
    const prev = makeState()
    const result = applyRunProgressionDecision('id', 'long-run', { action: 'none', reason: 'not_progression_eligible' }, prev)
    expect(result).toEqual(prev)
  })

  it('writes the next target on progress', () => {
    const result = applyRunProgressionDecision(
      'plan1_2026-01-01',
      'long-run',
      { action: 'progress', nextTargetDistanceMiles: 5.5, reason: 'successful_completion' },
      makeState(),
    )
    expect(result.currentTargetDistanceMiles).toBe(5.5)
    expect(result.lastResult).toBe('progress')
    expect(result.lastCompletedWorkoutInstanceId).toBe('plan1_2026-01-01')
  })

  it('writes hold state', () => {
    const result = applyRunProgressionDecision(
      'id',
      'long-run',
      { action: 'hold', nextTargetDistanceMiles: 5, reason: 'borderline_completion' },
      makeState(),
    )
    expect(result.lastResult).toBe('hold')
    expect(result.currentTargetDistanceMiles).toBe(5)
  })
})

// ── Derived pace calculation ──────────────────────────────────────────────────

import { derivePaceSecondsPerMile, formatPace } from '../../workout-outcomes/types'

describe('derivePaceSecondsPerMile', () => {
  it('correctly derives pace from distance and duration', () => {
    // 5 miles in 50 minutes = 600 sec/mile (10:00 /mi)
    const pace = derivePaceSecondsPerMile(5, 50)
    expect(pace).toBe(600)
  })

  it('handles fractional distances', () => {
    // 3.1 miles in 31 minutes ≈ 600 sec/mile
    const pace = derivePaceSecondsPerMile(3.1, 31)
    expect(Math.round(pace)).toBe(600)
  })
})

describe('formatPace', () => {
  it('formats exactly 600 sec/mi as 10:00 /mi', () => {
    expect(formatPace(600)).toBe('10:00 /mi')
  })

  it('formats 543 sec/mi as 9:03 /mi', () => {
    expect(formatPace(543)).toBe('9:03 /mi')
  })

  it('does not produce ":60" when fractional seconds round up to 60', () => {
    // 599.5 rounds to 600 total seconds → 10:00, not 9:60
    expect(formatPace(599.5)).toBe('10:00 /mi')
  })

  it('does not produce ":60" for 539.5 sec/mi (8:60 → 9:00)', () => {
    expect(formatPace(539.5)).toBe('9:00 /mi')
  })

  it('rounds fractional seconds correctly (599.4 → 9:59)', () => {
    expect(formatPace(599.4)).toBe('9:59 /mi')
  })
})

// ── resolveWorkoutDisplayTarget ───────────────────────────────────────────────

import { resolveWorkoutDisplayTarget } from '../selectors'

describe('resolveWorkoutDisplayTarget', () => {
  it('returns legacy fields when no runConfig', () => {
    const slot: WorkoutSlot = {
      id: 's',
      type: 'long_run',
      name: 'Run',
      targetDistance: 8,
      targetPace: 10,
    }
    const result = resolveWorkoutDisplayTarget(slot, null)
    expect(result.targetDistanceMiles).toBe(8)
    expect(result.isFromProgression).toBe(false)
  })

  it('prefers progression state distance over runConfig', () => {
    const slot = makeSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 6.5 })
    const result = resolveWorkoutDisplayTarget(slot, state)
    expect(result.targetDistanceMiles).toBe(6.5)
    expect(result.isFromProgression).toBe(true)
  })

  it('falls back to runConfig distance when progression state is null', () => {
    const slot = makeSlot({ targetDistanceMiles: 5 })
    const result = resolveWorkoutDisplayTarget(slot, null)
    expect(result.targetDistanceMiles).toBe(5)
    expect(result.isFromProgression).toBe(false)
  })

  it('returns no adaptation note when not from progression', () => {
    const slot = makeSlot({ targetDistanceMiles: 5 })
    const result = resolveWorkoutDisplayTarget(slot, null)
    expect(result.adaptationNote).toBeNull()
  })

  it('returns an adaptation note when from progression', () => {
    const slot = makeSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5.5, lastResult: 'progress' })
    const result = resolveWorkoutDisplayTarget(slot, state)
    expect(result.adaptationNote).toContain('5.5')
    expect(result.adaptationNote).toContain('Progressed')
  })

  it('isFromProgression is false when progression distance equals template distance', () => {
    // Intentional design: if the progression state has the same target as the
    // runConfig template, we treat it as "not from progression" (no visual indicator).
    // This happens when progression is initialised but hasn't changed the target yet,
    // or after a reset to the baseline distance.
    const slot = makeSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5 }) // same as template
    const result = resolveWorkoutDisplayTarget(slot, state)
    expect(result.targetDistanceMiles).toBe(5)
    expect(result.isFromProgression).toBe(false) // distance unchanged → no indicator
    expect(result.adaptationNote).toBeNull()     // no note either
  })
})
