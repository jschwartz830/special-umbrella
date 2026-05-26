import { describe, it, expect } from 'vitest'
import { buildProgressionRecommendation } from '../progression'
import type { WorkoutSlot } from '../../../types'
import type { WorkoutOutcome, LoggedSetActual } from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSlot(type: WorkoutSlot['type'] = 'weights'): WorkoutSlot {
  return { id: 's1', type, name: 'Test Slot' }
}

function makeOutcome(overrides: Partial<WorkoutOutcome> = {}): WorkoutOutcome {
  return {
    workoutInstanceId: 'plan1_2026-01-01',
    completionState: 'completed',
    ...overrides,
  }
}

function completedSet(overrides: Partial<LoggedSetActual> = {}): LoggedSetActual {
  return { targetReps: 8, actualReps: 8, actualLoad: 135, completed: true, ...overrides }
}

function incompleteSet(overrides: Partial<LoggedSetActual> = {}): LoggedSetActual {
  return { targetReps: 8, actualReps: null, actualLoad: null, completed: false, ...overrides }
}

// ── Non-matching slot types ───────────────────────────────────────────────────

describe('buildProgressionRecommendation — null for unsupported slot types', () => {
  it('returns null for yoga slot', () => {
    const result = buildProgressionRecommendation(makeSlot('yoga'), makeOutcome())
    expect(result).toBeNull()
  })

  it('returns null for other slot', () => {
    const result = buildProgressionRecommendation(makeSlot('other'), makeOutcome())
    expect(result).toBeNull()
  })

  it('returns null for rest slot', () => {
    const result = buildProgressionRecommendation(makeSlot('rest'), makeOutcome())
    expect(result).toBeNull()
  })
})

// ── Weights: null paths ───────────────────────────────────────────────────────

describe('buildProgressionRecommendation — weights: null paths', () => {
  it('returns null when exercises array is empty', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({ weightsActual: { exercises: [] } }),
    )
    expect(result).toBeNull()
  })

  it('returns null when all sets have completed=false', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Squat',
            sets: [incompleteSet(), incompleteSet()],
          }],
        },
      }),
    )
    expect(result).toBeNull()
  })

  it('returns null when weightsActual is absent', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({ weightsActual: null }),
    )
    expect(result).toBeNull()
  })
})

// ── Weights: single mode ──────────────────────────────────────────────────────

describe('buildProgressionRecommendation — weights: single mode (default)', () => {
  it('returns progress when all sets are completed', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        perceivedEffort: 3,
        weightsActual: {
          exercises: [{
            exercise: 'Bench Press',
            sets: [completedSet(), completedSet(), completedSet()],
          }],
        },
      }),
    )
    expect(result?.action).toBe('progress')
    expect(result?.discipline).toBe('weights')
    expect(result?.mode).toBe('single')
  })

  it('returns hold when not all sets are completed (partial workout)', () => {
    // This test previously failed before the bug fix: allCompleted was trivially
    // true because it was checked against the already-filtered completedSets array.
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        perceivedEffort: 3,
        weightsActual: {
          exercises: [{
            exercise: 'Bench Press',
            sets: [completedSet(), completedSet(), incompleteSet()],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
    expect(result?.note).toMatch(/repeat current load/i)
  })

  it('returns hold when some sets have completed=undefined (not yet done)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Squat',
            sets: [completedSet(), { targetReps: 8 }],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns regress when effort is 5', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        perceivedEffort: 5,
        weightsActual: {
          exercises: [{
            exercise: 'Deadlift',
            sets: [completedSet(), completedSet()],
          }],
        },
      }),
    )
    expect(result?.action).toBe('regress')
    expect(result?.note).toMatch(/load reduction/i)
  })

  it('uses progressionMode from the first exercise', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'OHP',
            progressionMode: 'single',
            sets: [completedSet()],
          }],
        },
      }),
    )
    expect(result?.mode).toBe('single')
  })
})

// ── Weights: double mode ──────────────────────────────────────────────────────

describe('buildProgressionRecommendation — weights: double mode', () => {
  it('returns progress when all completed sets hit their rep target', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Curl',
            progressionMode: 'double',
            sets: [
              { targetReps: 8, actualReps: 8, completed: true },
              { targetReps: 8, actualReps: 9, completed: true },
            ],
          }],
        },
      }),
    )
    expect(result?.action).toBe('progress')
    expect(result?.mode).toBe('double')
  })

  it('returns hold when any completed set is below target reps', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Curl',
            progressionMode: 'double',
            sets: [
              { targetReps: 8, actualReps: 8, completed: true },
              { targetReps: 8, actualReps: 6, completed: true },
            ],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
    expect(result?.note).toMatch(/complete all target reps/i)
  })

  it('treats sets without numeric targetReps as hitting target (non-numeric is ignored)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Plank',
            progressionMode: 'double',
            sets: [{ targetReps: 'AMRAP', actualReps: 12, completed: true }],
          }],
        },
      }),
    )
    expect(result?.action).toBe('progress')
  })

  it('returns hold when only some sets are completed — even if completed ones hit reps (bug fix)', () => {
    // Regression guard: before the fix, double mode only checked completedSets
    // for rep targets. A workout with 2 of 4 sets done (both hitting reps) would
    // incorrectly return 'progress' instead of 'hold'.
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Squat',
            progressionMode: 'double',
            sets: [
              { targetReps: 8, actualReps: 8, completed: true },
              { targetReps: 8, actualReps: 8, completed: true },
              { targetReps: 8, actualReps: null, completed: false },
              { targetReps: 8, actualReps: null, completed: false },
            ],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
    expect(result?.note).toMatch(/complete all target reps/i)
  })

  it('returns hold when some sets are completed: undefined (not-yet-touched)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'RDL',
            progressionMode: 'double',
            sets: [
              { targetReps: 10, actualReps: 10, completed: true },
              { targetReps: 10 }, // no completed field — not touched
            ],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
  })
})

// ── Weights: volume mode ──────────────────────────────────────────────────────

describe('buildProgressionRecommendation — weights: volume mode', () => {
  it('always returns hold for volume mode (regardless of completions)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weights'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Row',
            progressionMode: 'volume',
            sets: [completedSet(), completedSet(), completedSet()],
          }],
        },
      }),
    )
    expect(result?.action).toBe('hold')
    expect(result?.mode).toBe('volume')
    expect(result?.note).toMatch(/volume progression/i)
  })
})

// ── Weights: legacy 'weightlifting' type ─────────────────────────────────────

describe('buildProgressionRecommendation — legacy weightlifting slot type', () => {
  it('handles weightlifting type identically to weights', () => {
    const result = buildProgressionRecommendation(
      makeSlot('weightlifting'),
      makeOutcome({
        weightsActual: {
          exercises: [{
            exercise: 'Press',
            sets: [completedSet(), completedSet()],
          }],
        },
      }),
    )
    expect(result?.discipline).toBe('weights')
    expect(result?.action).toBe('progress')
  })
})

// ── Run ───────────────────────────────────────────────────────────────────────

describe('buildProgressionRecommendation — run slot', () => {
  it('returns null when runActual is absent', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({ runActual: null }),
    )
    expect(result).toBeNull()
  })

  it('returns progress when completed + effort <= 3 + completedAsPlanned not false', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 3,
        runActual: { actualDistanceMiles: 5, completedAsPlanned: true },
      }),
    )
    expect(result?.action).toBe('progress')
    expect(result?.discipline).toBe('run')
    expect(result?.mode).toBe('endurance')
  })

  it('returns progress when effort is null (defaults to 3)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: null,
        runActual: { actualDistanceMiles: 3 },
      }),
    )
    expect(result?.action).toBe('progress')
  })

  it('returns hold when completed but completedAsPlanned is explicitly false', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 2,
        runActual: { actualDistanceMiles: 2.5, completedAsPlanned: false },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns hold when not completed (partially_completed)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'partially_completed',
        perceivedEffort: 3,
        runActual: { actualDistanceMiles: 2 },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns hold when effort is 4 (borderline)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 4,
        runActual: { actualDistanceMiles: 5 },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns regress when effort is 5', () => {
    const result = buildProgressionRecommendation(
      makeSlot('run'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 5,
        runActual: { actualDistanceMiles: 5 },
      }),
    )
    expect(result?.action).toBe('regress')
    expect(result?.note).toMatch(/high effort/i)
  })

  it('handles long_run and recovery_run slot types identically', () => {
    for (const type of ['long_run', 'recovery_run'] as const) {
      const result = buildProgressionRecommendation(
        makeSlot(type),
        makeOutcome({
          completionState: 'completed',
          perceivedEffort: 2,
          runActual: { actualDistanceMiles: 4 },
        }),
      )
      expect(result?.discipline).toBe('run')
      expect(result?.action).toBe('progress')
    }
  })
})

// ── Swim ──────────────────────────────────────────────────────────────────────

describe('buildProgressionRecommendation — swim slot', () => {
  it('returns null when swimActual is absent', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({ swimActual: null }),
    )
    expect(result).toBeNull()
  })

  it('returns progress when completed + effort <= 3 + completedAsPlanned not false', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 2,
        swimActual: { actualDistanceMeters: 1000, completedAsPlanned: true },
      }),
    )
    expect(result?.action).toBe('progress')
    expect(result?.discipline).toBe('swim')
    expect(result?.mode).toBe('speed')
  })

  it('returns hold when completedAsPlanned is false', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 2,
        swimActual: { actualDistanceMeters: 600, completedAsPlanned: false },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns regress when effort is 5', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 5,
        swimActual: { actualDistanceMeters: 1000 },
      }),
    )
    expect(result?.action).toBe('regress')
    expect(result?.note).toMatch(/regress/i)
  })

  it('returns hold when not completed', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'partially_completed',
        perceivedEffort: 3,
        swimActual: { actualDistanceMeters: 500 },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns hold when effort is 4 (above progress threshold)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: 4,
        swimActual: { actualDistanceMeters: 1000 },
      }),
    )
    expect(result?.action).toBe('hold')
  })

  it('returns progress when effort is null (defaults to 3)', () => {
    const result = buildProgressionRecommendation(
      makeSlot('swim'),
      makeOutcome({
        completionState: 'completed',
        perceivedEffort: null,
        swimActual: { actualDistanceMeters: 1000 },
      }),
    )
    expect(result?.action).toBe('progress')
  })
})
