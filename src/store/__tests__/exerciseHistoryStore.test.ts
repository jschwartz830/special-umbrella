/**
 * Tests for exerciseHistoryStore business logic.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useExerciseHistoryStore } from '../exerciseHistoryStore'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOutcome(
  planId: string,
  date: string,
  exercises: Array<{
    name: string
    sets: Array<{ reps?: number | null; load?: number | null; completed?: boolean }>
  }>,
  opts: Partial<WorkoutOutcome> = {},
): WorkoutOutcome {
  return {
    workoutInstanceId: `${planId}_${date}`,
    completionState: 'completed',
    completedAt: `${date}T12:00:00Z`,
    perceivedEffort: 3,
    notes: null,
    runActual: null,
    weightsActual: {
      exercises: exercises.map(ex => ({
        exercise: ex.name,
        sets: ex.sets.map(s => ({
          actualReps: s.reps ?? null,
          actualLoad: s.load ?? null,
          completed: s.completed ?? true,
        })),
      })),
    },
    ...opts,
  }
}

function getState() {
  return useExerciseHistoryStore.getState()
}

beforeEach(() => {
  useExerciseHistoryStore.setState({ records: [] })
})

// ── upsertFromOutcome ─────────────────────────────────────────────────────────

describe('upsertFromOutcome', () => {
  it('creates one record per exercise in the outcome', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records).toHaveLength(2)
    const names = getState().records.map(r => r.exerciseName).sort()
    expect(names).toEqual(['Bench', 'Squat'])
  })

  it('stores calendarDate and planId parsed from workoutInstanceId', () => {
    const outcome = makeOutcome('plan-1', '2026-03-15', [
      { name: 'Deadlift', sets: [{ reps: 3, load: 225 }] },
    ])
    getState().upsertFromOutcome(outcome)
    const record = getState().records[0]
    expect(record.calendarDate).toBe('2026-03-15')
    expect(record.planId).toBe('plan-1')
  })

  it('computes maxLoad from completed sets', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      {
        name: 'Squat',
        sets: [
          { reps: 5, load: 135, completed: true },
          { reps: 5, load: 155, completed: true },
          { reps: 5, load: 175, completed: true },
        ],
      },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].maxLoad).toBe(175)
  })

  it('computes maxReps from completed sets', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      {
        name: 'Push-up',
        sets: [
          { reps: 15, load: null, completed: true },
          { reps: 20, load: null, completed: true },
          { reps: 12, load: null, completed: true },
        ],
      },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].maxReps).toBe(20)
  })

  it('computes totalVolume as sum of (reps × load) across completed sets', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      {
        name: 'Bench',
        sets: [
          { reps: 5, load: 100, completed: true },  // 500
          { reps: 5, load: 100, completed: true },  // 500
          { reps: 5, load: 100, completed: true },  // 500
        ],
      },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].totalVolume).toBe(1500)
  })

  it('excludes incomplete sets from summary computations', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      {
        name: 'OHP',
        sets: [
          { reps: 5, load: 80, completed: true },
          { reps: 3, load: 80, completed: false }, // incomplete — excluded
        ],
      },
    ])
    getState().upsertFromOutcome(outcome)
    const record = getState().records[0]
    expect(record.maxReps).toBe(5)
    expect(record.totalVolume).toBe(400) // only 5×80
  })

  it('sets totalVolume/maxLoad/maxReps to null when no completed sets have data', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      {
        name: 'Plank',
        sets: [{ reps: null, load: null, completed: true }],
      },
    ])
    getState().upsertFromOutcome(outcome)
    const record = getState().records[0]
    expect(record.totalVolume).toBeNull()
    expect(record.maxLoad).toBeNull()
    expect(record.maxReps).toBeNull()
  })

  it('is idempotent: re-upserting same instanceId replaces prior records', () => {
    const first = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(first)
    expect(getState().records).toHaveLength(1)

    const second = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 145 }] },
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(second)
    expect(getState().records).toHaveLength(2) // 1 was removed, 2 added
    const squat = getState().records.find(r => r.exerciseName === 'Squat')!
    expect(squat.maxLoad).toBe(145) // updated value
  })

  it('stores planName and workoutName from context when provided', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome, { planName: 'My Plan', workoutName: 'Day A' })
    const record = getState().records[0]
    expect(record.planName).toBe('My Plan')
    expect(record.workoutName).toBe('Day A')
  })

  it('stores null for planName/workoutName when context is omitted', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].planName).toBeNull()
    expect(getState().records[0].workoutName).toBeNull()
  })

  it('is a no-op when weightsActual is missing', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-01-01',
      completionState: 'completed',
      notes: null,
      runActual: null,
    }
    getState().upsertFromOutcome(outcome)
    expect(getState().records).toHaveLength(0)
  })

  it('is a no-op when weightsActual.exercises is empty', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-01-01',
      completionState: 'completed',
      notes: null,
      runActual: null,
      weightsActual: { exercises: [] },
    }
    getState().upsertFromOutcome(outcome)
    expect(getState().records).toHaveLength(0)
  })

  it('assigns distinct ids to records for different exercises in the same workout', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(outcome)
    const [a, b] = getState().records
    expect(a.id).not.toBe(b.id)
  })

  it('stores the workoutInstanceId on each record for cross-referencing', () => {
    const outcome = makeOutcome('plan-1', '2026-02-10', [
      { name: 'Deadlift', sets: [{ reps: 3, load: 225 }] },
    ])
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].workoutInstanceId).toBe('plan-1_2026-02-10')
  })

  it('parses calendarDate correctly for extra workout instanceIds', () => {
    // Extra instanceId format: `${planId}_${date}_extra_${extraId}`
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-01-05_extra_abc123',
      completionState: 'completed',
      notes: null,
      runActual: null,
      weightsActual: {
        exercises: [{ exercise: 'Row', sets: [{ actualReps: 8, actualLoad: 65, completed: true }] }],
      },
    }
    getState().upsertFromOutcome(outcome)
    expect(getState().records[0].calendarDate).toBe('2026-01-05')
  })
})

// ── removeByWorkoutInstance ───────────────────────────────────────────────────

describe('removeByWorkoutInstance', () => {
  it('removes all records for the given instanceId', () => {
    const o1 = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    const o2 = makeOutcome('plan-1', '2026-01-02', [
      { name: 'Deadlift', sets: [{ reps: 3, load: 185 }] },
    ])
    getState().upsertFromOutcome(o1)
    getState().upsertFromOutcome(o2)
    expect(getState().records).toHaveLength(3)

    getState().removeByWorkoutInstance('plan-1_2026-01-01')
    expect(getState().records).toHaveLength(1)
    expect(getState().records[0].exerciseName).toBe('Deadlift')
  })

  it('is a no-op when instanceId has no records', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome)
    getState().removeByWorkoutInstance('plan-1_2099-12-31')
    expect(getState().records).toHaveLength(1)
  })
})

// ── moveByWorkoutInstance ─────────────────────────────────────────────────────

describe('moveByWorkoutInstance', () => {
  it('re-keys records from oldId to newId', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome)
    getState().moveByWorkoutInstance('plan-1_2026-01-01', 'plan-1_2026-01-05')
    expect(getState().records[0].workoutInstanceId).toBe('plan-1_2026-01-05')
  })

  it('updates calendarDate to the date embedded in the new instanceId', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome)
    getState().moveByWorkoutInstance('plan-1_2026-01-01', 'plan-1_2026-01-05')
    expect(getState().records[0].calendarDate).toBe('2026-01-05')
    expect(getState().records[0].workoutInstanceId).toBe('plan-1_2026-01-05')
  })

  it('does not change other records', () => {
    const o1 = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    const o2 = makeOutcome('plan-1', '2026-01-02', [
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(o1)
    getState().upsertFromOutcome(o2)
    getState().moveByWorkoutInstance('plan-1_2026-01-01', 'plan-1_2026-01-10')
    const bench = getState().records.find(r => r.exerciseName === 'Bench')!
    expect(bench.workoutInstanceId).toBe('plan-1_2026-01-02') // unchanged
  })

  it('is a no-op when oldId has no records', () => {
    const outcome = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    getState().upsertFromOutcome(outcome)
    getState().moveByWorkoutInstance('plan-1_2099-01-01', 'plan-1_2099-01-05')
    expect(getState().records[0].workoutInstanceId).toBe('plan-1_2026-01-01') // unchanged
  })
})

// ── clearByPlanId ─────────────────────────────────────────────────────────────

describe('clearByPlanId', () => {
  it('removes all records for the given planId, leaves other plans intact', () => {
    const oA1 = makeOutcome('plan-A', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
    ])
    const oA2 = makeOutcome('plan-A', '2026-01-02', [
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    const oB = makeOutcome('plan-B', '2026-01-03', [
      { name: 'Deadlift', sets: [{ reps: 3, load: 185 }] },
    ])
    getState().upsertFromOutcome(oA1)
    getState().upsertFromOutcome(oA2)
    getState().upsertFromOutcome(oB)
    expect(getState().records).toHaveLength(3)

    getState().clearByPlanId('plan-A')
    expect(getState().records).toHaveLength(1)
    expect(getState().records[0].planId).toBe('plan-B')
    expect(getState().records[0].exerciseName).toBe('Deadlift')
  })

  it('is a no-op when the plan has no records', () => {
    const outcome = makeOutcome('plan-B', '2026-01-01', [
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(outcome)
    getState().clearByPlanId('plan-A')
    expect(getState().records).toHaveLength(1)
  })
})

// ── getByExerciseName ─────────────────────────────────────────────────────────

describe('getByExerciseName', () => {
  it('returns only records for the given exercise name', () => {
    const o1 = makeOutcome('plan-1', '2026-01-01', [
      { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
      { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
    ])
    getState().upsertFromOutcome(o1)
    const squats = getState().getByExerciseName('Squat')
    expect(squats).toHaveLength(1)
    expect(squats[0].exerciseName).toBe('Squat')
  })

  it('returns records sorted oldest-first by calendarDate', () => {
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-05', [{ name: 'Squat', sets: [{ reps: 5, load: 155 }] }]),
    )
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-01', [{ name: 'Squat', sets: [{ reps: 5, load: 135 }] }]),
    )
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-03', [{ name: 'Squat', sets: [{ reps: 5, load: 145 }] }]),
    )
    const records = getState().getByExerciseName('Squat')
    expect(records.map(r => r.calendarDate)).toEqual([
      '2026-01-01',
      '2026-01-03',
      '2026-01-05',
    ])
  })

  it('returns empty array when exercise has no records', () => {
    expect(getState().getByExerciseName('Nonexistent')).toEqual([])
  })

  it('is case-sensitive', () => {
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-01', [{ name: 'Squat', sets: [{ reps: 5, load: 135 }] }]),
    )
    expect(getState().getByExerciseName('squat')).toHaveLength(0)
    expect(getState().getByExerciseName('Squat')).toHaveLength(1)
  })
})

// ── getAllExerciseNames ────────────────────────────────────────────────────────

describe('getAllExerciseNames', () => {
  it('returns all unique exercise names sorted alphabetically', () => {
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-01', [
        { name: 'Squat', sets: [{ reps: 5, load: 135 }] },
        { name: 'Bench', sets: [{ reps: 5, load: 95 }] },
      ]),
    )
    getState().upsertFromOutcome(
      makeOutcome('plan-1', '2026-01-02', [
        { name: 'Deadlift', sets: [{ reps: 3, load: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, load: 145 }] }, // duplicate — should appear once
      ]),
    )
    const names = getState().getAllExerciseNames()
    expect(names).toEqual(['Bench', 'Deadlift', 'Squat'])
  })

  it('returns empty array when no records exist', () => {
    expect(getState().getAllExerciseNames()).toEqual([])
  })

  it('deduplicates exercise names across different plans', () => {
    getState().upsertFromOutcome(
      makeOutcome('plan-A', '2026-01-01', [{ name: 'Squat', sets: [{ reps: 5, load: 135 }] }]),
    )
    getState().upsertFromOutcome(
      makeOutcome('plan-B', '2026-01-02', [{ name: 'Squat', sets: [{ reps: 5, load: 140 }] }]),
    )
    expect(getState().getAllExerciseNames()).toEqual(['Squat'])
  })
})
