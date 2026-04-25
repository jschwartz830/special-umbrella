import { describe, it, expect } from 'vitest'
import {
  generateRunAdaptationNote,
  generateDifficultySpacingWarning,
  summariseRunOutcome,
} from '../explanation'
import type { WorkoutSlot } from '../../../types'
import type { RunProgressionState } from '../../run-adaptation/types'
import type { WorkoutOutcome } from '../../workout-outcomes/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProgressionSlot(overrides: Partial<WorkoutSlot['runConfig']> = {}): WorkoutSlot {
  return {
    id: 'slot-1',
    type: 'long_run',
    name: 'Long Run',
    runConfig: {
      subtype: 'long_run',
      targetDistanceMiles: 5,
      progressionEligible: true,
      progressionGroupId: 'long-run',
      ...overrides,
    },
  }
}

function makeState(overrides: Partial<RunProgressionState> = {}): RunProgressionState {
  return {
    progressionGroupId: 'long-run',
    currentTargetDistanceMiles: 5.5,
    lastResult: 'progress',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeOutcome(overrides: Partial<WorkoutOutcome> = {}): WorkoutOutcome {
  return {
    workoutInstanceId: 'plan1_2026-01-01',
    completionState: 'completed',
    ...overrides,
  }
}

// ── generateRunAdaptationNote ─────────────────────────────────────────────────

describe('generateRunAdaptationNote', () => {
  it('returns null for a slot without progressionEligible', () => {
    const slot = makeProgressionSlot({ progressionEligible: false })
    expect(generateRunAdaptationNote(slot, null)).toBeNull()
  })

  it('returns null when runConfig is absent', () => {
    const slot: WorkoutSlot = { id: 's', type: 'long_run', name: 'Run' }
    expect(generateRunAdaptationNote(slot, null)).toBeNull()
  })

  it('returns null when progression state is null and no progression has occurred', () => {
    const slot = makeProgressionSlot()
    // With no state, resolveWorkoutDisplayTarget returns isFromProgression=false → no note.
    expect(generateRunAdaptationNote(slot, null)).toBeNull()
  })

  it('returns an adaptation note when progression state differs from template target', () => {
    const slot = makeProgressionSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5.5, lastResult: 'progress' })
    const note = generateRunAdaptationNote(slot, state)
    expect(note).not.toBeNull()
    expect(note).toContain('5.5')
    expect(note).toContain('Progressed')
  })

  it('returns a "Holding" note when lastResult is hold', () => {
    const slot = makeProgressionSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5.5, lastResult: 'hold' })
    const note = generateRunAdaptationNote(slot, state)
    expect(note).toContain('Holding')
    expect(note).toContain('5.5')
  })

  it('returns a regress note when lastResult is regress', () => {
    const slot = makeProgressionSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5.5, lastResult: 'regress' })
    const note = generateRunAdaptationNote(slot, state)
    expect(note).toContain('Stepped back')
    expect(note).toContain('5.5')
  })

  it('returns null when progression distance equals template distance (no meaningful change)', () => {
    // Same distance as template → isFromProgression = false → no note
    const slot = makeProgressionSlot({ targetDistanceMiles: 5 })
    const state = makeState({ currentTargetDistanceMiles: 5, lastResult: 'hold' })
    expect(generateRunAdaptationNote(slot, state)).toBeNull()
  })
})

// ── generateDifficultySpacingWarning ──────────────────────────────────────────

describe('generateDifficultySpacingWarning', () => {
  it('returns a warning for back-to-back hard workouts', () => {
    const warning = generateDifficultySpacingWarning('hard', 'hard')
    expect(warning).not.toBeNull()
    expect(warning!.toLowerCase()).toContain('back-to-back')
  })

  it('returns null when today is hard but tomorrow is moderate', () => {
    expect(generateDifficultySpacingWarning('hard', 'moderate')).toBeNull()
  })

  it('returns null when today is hard but tomorrow is easy', () => {
    expect(generateDifficultySpacingWarning('hard', 'easy')).toBeNull()
  })

  it('returns null when today is moderate and tomorrow is hard', () => {
    expect(generateDifficultySpacingWarning('moderate', 'hard')).toBeNull()
  })

  it('returns null for easy + easy', () => {
    expect(generateDifficultySpacingWarning('easy', 'easy')).toBeNull()
  })

  it('returns null when either argument is null', () => {
    expect(generateDifficultySpacingWarning(null, 'hard')).toBeNull()
    expect(generateDifficultySpacingWarning('hard', null)).toBeNull()
    expect(generateDifficultySpacingWarning(null, null)).toBeNull()
  })

  it('returns null when either argument is undefined', () => {
    expect(generateDifficultySpacingWarning(undefined, 'hard')).toBeNull()
    expect(generateDifficultySpacingWarning('hard', undefined)).toBeNull()
  })
})

// ── summariseRunOutcome ───────────────────────────────────────────────────────

describe('summariseRunOutcome', () => {
  it('returns null when runActual is absent', () => {
    expect(summariseRunOutcome(makeOutcome({ runActual: null }))).toBeNull()
    expect(summariseRunOutcome(makeOutcome({ runActual: undefined }))).toBeNull()
  })

  it('returns null when runActual is present but has no values', () => {
    expect(
      summariseRunOutcome(makeOutcome({ runActual: {} })),
    ).toBeNull()
  })

  it('includes distance when present', () => {
    const result = summariseRunOutcome(makeOutcome({
      runActual: { actualDistanceMiles: 5.2 },
    }))
    expect(result).toContain('5.2 mi')
  })

  it('includes duration when present', () => {
    const result = summariseRunOutcome(makeOutcome({
      runActual: { actualDurationMin: 52 },
    }))
    expect(result).toContain('52 min')
  })

  it('includes formatted pace when present', () => {
    // 600 sec/mi = 10:00 /mi
    const result = summariseRunOutcome(makeOutcome({
      runActual: { averagePaceSecondsPerMile: 600 },
    }))
    expect(result).toContain('10:00 /mi')
  })

  it('rounds seconds correctly in pace formatting', () => {
    // 543 sec/mi = 9:03 /mi
    const result = summariseRunOutcome(makeOutcome({
      runActual: { averagePaceSecondsPerMile: 543 },
    }))
    expect(result).toContain('9:03 /mi')
  })

  it('joins multiple parts with ·', () => {
    const result = summariseRunOutcome(makeOutcome({
      runActual: {
        actualDistanceMiles: 5,
        actualDurationMin: 50,
        averagePaceSecondsPerMile: 600,
      },
    }))
    expect(result).toBe('5 mi · 50 min · 10:00 /mi')
  })

  it('omits parts that are null or undefined', () => {
    const result = summariseRunOutcome(makeOutcome({
      runActual: {
        actualDistanceMiles: null,
        actualDurationMin: 45,
        averagePaceSecondsPerMile: null,
      },
    }))
    expect(result).toBe('45 min')
  })
})
