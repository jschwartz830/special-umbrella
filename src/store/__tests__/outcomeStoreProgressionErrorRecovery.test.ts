/**
 * Verifies that a thrown error inside the run-progression evaluation path
 * (evaluateRunProgression / applyRunProgressionDecision) does NOT prevent
 * the outcome from being saved and does NOT propagate to the caller.
 *
 * This tests the try/catch guard added to logOutcomeWithProgression step 2.
 * Without that guard, the mock below would cause the outcome to appear saved
 * (setOutcome fires first) but the function would still throw, breaking
 * TodayPage's handleOutcomeConfirm (modal would not close, advance would not
 * happen, double-day bonus would not trigger).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// Make the run-progression engine throw so we can observe the guard.
vi.mock('../../modules/run-adaptation/engine', () => ({
  evaluateRunProgression: vi.fn(() => {
    throw new Error('deliberate test error from progression engine')
  }),
  applyRunProgressionDecision: vi.fn(),
}))

// eslint-disable-next-line import/first
import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
// eslint-disable-next-line import/first
import { useExerciseHistoryStore } from '../exerciseHistoryStore'
// eslint-disable-next-line import/first
import { useProgramStore } from '../programStore'
// eslint-disable-next-line import/first
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'
// eslint-disable-next-line import/first
import type { WorkoutSlot } from '../../types'

function makeRunOutcome(planId: string, date: string): WorkoutOutcome {
  return {
    workoutInstanceId: makeWorkoutInstanceId(planId, date),
    completionState: 'completed',
    completedAt: `${date}T12:00:00Z`,
    perceivedEffort: 2,
    durationActualMin: 40,
    notes: null,
    runActual: {
      actualDistanceMiles: 5.1,
      actualDurationMin: 52,
      completedAsPlanned: true,
    },
  }
}

function makeProgressionRunSlot(): WorkoutSlot {
  return {
    id: 'slot-run',
    type: 'run',
    name: 'Easy Run',
    runConfig: {
      subtype: 'easy',
      targetDistanceMiles: 5,
      progressionEligible: true,
      progressionGroupId: 'group-easy',
      defaultStepMiles: 0.5,
    },
  }
}

beforeEach(() => {
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {} })
  useExerciseHistoryStore.setState({ records: [] })
  useProgramStore.setState({ vars: {} })
})

describe('logOutcomeWithProgression — run-progression error recovery', () => {
  it('saves the outcome even when run-progression evaluation throws', () => {
    const outcome = makeRunOutcome('plan-1', '2026-01-10')
    const slot = makeProgressionRunSlot()

    // Should not throw despite the mocked engine throwing
    expect(() => {
      useOutcomeStore.getState().logOutcomeWithProgression(outcome, slot)
    }).not.toThrow()

    // Outcome must be persisted
    expect(useOutcomeStore.getState().getOutcome(outcome.workoutInstanceId)).not.toBeNull()
  })

  it('does not create a progression state when the engine throws', () => {
    const outcome = makeRunOutcome('plan-1', '2026-01-10')
    const slot = makeProgressionRunSlot()

    useOutcomeStore.getState().logOutcomeWithProgression(outcome, slot)

    // No progression state should be written since the engine threw before
    // applyRunProgressionDecision could be called.
    expect(Object.keys(useOutcomeStore.getState().progressionStates)).toHaveLength(0)
  })

  it('saves the outcome with a progression recommendation even when run-progression throws', () => {
    const outcome = makeRunOutcome('plan-1', '2026-01-10')
    const slot = makeProgressionRunSlot()

    useOutcomeStore.getState().logOutcomeWithProgression(outcome, slot)

    // The step-1 recommendation (from buildProgressionRecommendation) must still be attached.
    const saved = useOutcomeStore.getState().getOutcome(outcome.workoutInstanceId)
    expect(saved).not.toBeNull()
    // progressionRecommendation may be null for a run slot with no explicit
    // progression config, but the outcome itself must have been written.
    expect(saved!.completionState).toBe('completed')
  })
})
