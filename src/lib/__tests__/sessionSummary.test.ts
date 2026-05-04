import { describe, it, expect } from 'vitest'
import { findPreviousSessionForPlanDay, buildLastSessionSummary } from '../sessionSummary'
import type { HistoryEntry } from '../../types'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function entry(
  date: string,
  planDayIndex: number,
  action: HistoryEntry['action'] = 'complete',
  planId = 'p1',
): HistoryEntry {
  return {
    id: `${planId}_${date}`,
    planId,
    calendarDate: date,
    planDayIndex: action === 'day_off' ? undefined : planDayIndex,
    action,
    createdAt: `${date}T12:00:00Z`,
  }
}

function weightsOutcome(date: string, exercise: string, load: number, reps = 8, planId = 'p1'): WorkoutOutcome {
  return {
    workoutInstanceId: `${planId}_${date}`,
    completionState: 'completed',
    completedAt: `${date}T13:00:00Z`,
    perceivedEffort: 3,
    durationActualMin: 45,
    notes: null,
    runActual: null,
    swimActual: null,
    weightsActual: {
      exercises: [
        {
          exercise,
          sets: [
            { targetReps: reps, actualReps: reps, actualLoad: load, completed: true },
            { targetReps: reps, actualReps: reps, actualLoad: load, completed: true },
            { targetReps: reps, actualReps: reps, actualLoad: load, completed: true },
          ],
        },
      ],
    },
  }
}

function runOutcome(date: string, distanceMiles: number, durationMin: number, planId = 'p1'): WorkoutOutcome {
  return {
    workoutInstanceId: `${planId}_${date}`,
    completionState: 'completed',
    completedAt: `${date}T07:00:00Z`,
    perceivedEffort: 3,
    durationActualMin: durationMin,
    notes: null,
    runActual: { actualDistanceMiles: distanceMiles, actualDurationMin: durationMin },
    swimActual: null,
  }
}

function swimOutcome(date: string, distanceMeters: number, durationMin: number, planId = 'p1'): WorkoutOutcome {
  return {
    workoutInstanceId: `${planId}_${date}`,
    completionState: 'completed',
    completedAt: `${date}T08:00:00Z`,
    perceivedEffort: 2,
    durationActualMin: durationMin,
    notes: null,
    runActual: null,
    swimActual: { actualDistanceMeters: distanceMeters, actualDurationMin: durationMin },
  }
}

// ── findPreviousSessionForPlanDay ─────────────────────────────────────────────

describe('findPreviousSessionForPlanDay', () => {
  it('returns null when no entries exist', () => {
    expect(findPreviousSessionForPlanDay('p1', 0, '2026-05-02', [], {})).toBeNull()
  })

  it('returns null when entries exist but no matching outcome', () => {
    const entries = [entry('2026-05-01', 0)]
    // outcome store is empty
    expect(findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, {})).toBeNull()
  })

  it('returns the matching outcome for the most recent complete entry', () => {
    const entries = [entry('2026-04-25', 0), entry('2026-05-01', 0)]
    const outcomes = {
      'p1_2026-04-25': weightsOutcome('2026-04-25', 'Squat', 135),
      'p1_2026-05-01': weightsOutcome('2026-05-01', 'Squat', 145),
    }
    const result = findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)
    expect(result?.workoutInstanceId).toBe('p1_2026-05-01')
  })

  it('excludes today (currentDate) from results', () => {
    const entries = [entry('2026-05-02', 0), entry('2026-05-01', 0)]
    const outcomes = {
      'p1_2026-05-02': weightsOutcome('2026-05-02', 'Squat', 155),
      'p1_2026-05-01': weightsOutcome('2026-05-01', 'Squat', 145),
    }
    const result = findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)
    // Should NOT return today's outcome, even though it exists
    expect(result?.workoutInstanceId).toBe('p1_2026-05-01')
  })

  it('ignores entries for a different planDayIndex', () => {
    const entries = [entry('2026-05-01', 1)]  // planDayIndex=1, not 0
    const outcomes = { 'p1_2026-05-01': weightsOutcome('2026-05-01', 'Bench', 135) }
    expect(findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)).toBeNull()
  })

  it('ignores skip and day_off entries', () => {
    const entries = [
      entry('2026-04-30', 0, 'skip'),
      entry('2026-04-29', 0, 'day_off'),
      entry('2026-04-28', 0, 'complete'),
    ]
    const outcomes = {
      'p1_2026-04-28': weightsOutcome('2026-04-28', 'Deadlift', 225),
    }
    const result = findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)
    expect(result?.workoutInstanceId).toBe('p1_2026-04-28')
  })

  it('ignores entries from a different plan', () => {
    const entries = [entry('2026-05-01', 0, 'complete', 'other-plan')]
    const outcomes = { 'other-plan_2026-05-01': weightsOutcome('2026-05-01', 'Press', 95, 8, 'other-plan') }
    expect(findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)).toBeNull()
  })

  it('falls back to earlier entry when the newest has no outcome', () => {
    const entries = [entry('2026-04-20', 0), entry('2026-04-27', 0)]
    const outcomes = {
      // No outcome for 2026-04-27
      'p1_2026-04-20': weightsOutcome('2026-04-20', 'Squat', 120),
    }
    const result = findPreviousSessionForPlanDay('p1', 0, '2026-05-02', entries, outcomes)
    expect(result?.workoutInstanceId).toBe('p1_2026-04-20')
  })
})

// ── buildLastSessionSummary ───────────────────────────────────────────────────

describe('buildLastSessionSummary', () => {
  it('returns null for an outcome with no data', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T12:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: null,
      swimActual: null,
    }
    expect(buildLastSessionSummary(outcome)).toBeNull()
  })

  it('formats weights: sets × reps @ load exercise', () => {
    const outcome = weightsOutcome('2026-05-01', 'Bench Press', 135)
    expect(buildLastSessionSummary(outcome)).toBe('Last: 3×8 @ 135 lb Bench Press')
  })

  it('formats weights without load when actualLoad is null', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T12:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: null,
      swimActual: null,
      weightsActual: {
        exercises: [{
          exercise: 'Push-up',
          sets: [
            { targetReps: 15, actualReps: 12, actualLoad: null, completed: true },
          ],
        }],
      },
    }
    expect(buildLastSessionSummary(outcome)).toBe('Last: 1×12 Push-up')
  })

  it('shows PB marker when load matches allTime max', () => {
    const outcome = weightsOutcome('2026-05-01', 'Squat', 225)
    const maxLoadByExercise = { Squat: 225 }
    expect(buildLastSessionSummary(outcome, maxLoadByExercise)).toBe('Last: 3×8 @ 225 lb Squat · PB')
  })

  it('does not show PB when load is below allTime max', () => {
    const outcome = weightsOutcome('2026-05-01', 'Squat', 185)
    const maxLoadByExercise = { Squat: 225 }
    expect(buildLastSessionSummary(outcome, maxLoadByExercise)).toBe('Last: 3×8 @ 185 lb Squat')
  })

  it('does not show PB when maxLoadByExercise is not provided', () => {
    const outcome = weightsOutcome('2026-05-01', 'Squat', 225)
    expect(buildLastSessionSummary(outcome)).toBe('Last: 3×8 @ 225 lb Squat')
  })

  it('does not show PB for exercises not in the map', () => {
    const outcome = weightsOutcome('2026-05-01', 'OHP', 95)
    const maxLoadByExercise = { Squat: 225 }  // OHP not present
    expect(buildLastSessionSummary(outcome, maxLoadByExercise)).toBe('Last: 3×8 @ 95 lb OHP')
  })

  it('formats run with distance and duration', () => {
    const outcome = runOutcome('2026-05-01', 3.1, 28)
    expect(buildLastSessionSummary(outcome)).toBe('Last: 3.1 mi · 28 min')
  })

  it('formats run with distance only', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T07:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: { actualDistanceMiles: 5, actualDurationMin: null },
      swimActual: null,
    }
    expect(buildLastSessionSummary(outcome)).toBe('Last: 5 mi')
  })

  it('formats run with duration only', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T07:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: { actualDistanceMiles: null, actualDurationMin: 45 },
      swimActual: null,
    }
    expect(buildLastSessionSummary(outcome)).toBe('Last: 45 min')
  })

  it('returns null for run with no distance or duration', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T07:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: { actualDistanceMiles: null, actualDurationMin: null },
      swimActual: null,
    }
    expect(buildLastSessionSummary(outcome)).toBeNull()
  })

  it('formats swim with distance and duration', () => {
    const outcome = swimOutcome('2026-05-01', 800, 20)
    expect(buildLastSessionSummary(outcome)).toBe('Last: 800 m · 20 min')
  })

  it('prefers weights over run data when both are present', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'p1_2026-05-01',
      completionState: 'completed',
      completedAt: '2026-05-01T12:00:00Z',
      perceivedEffort: null,
      durationActualMin: null,
      notes: null,
      runActual: { actualDistanceMiles: 3, actualDurationMin: 25 },
      swimActual: null,
      weightsActual: {
        exercises: [{
          exercise: 'Squat',
          sets: [{ targetReps: 5, actualReps: 5, actualLoad: 200, completed: true }],
        }],
      },
    }
    // Weights branch is checked first
    expect(buildLastSessionSummary(outcome)).toBe('Last: 1×5 @ 200 lb Squat')
  })
})
