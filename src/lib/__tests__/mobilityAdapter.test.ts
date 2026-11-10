import { describe, it, expect } from 'vitest'
import {
  mobilityExerciseToSpec,
  mobilityRoutineToSlot,
  mobilityLibraryHoldSec,
  trackedToMobilityActual,
  trackedToMobilityProgress,
  DEFAULT_MOBILITY_HOLD_SEC,
  insertRoutineExercise,
  replaceRoutineExercise,
  mobilityCompletionToResumeOutcome,
  mobilityCompletionState,
} from '../mobilityAdapter'
import type { MobilityRoutineExercise } from '../mobilityLibrary'
import type { LoggedExerciseActual } from '../../modules/workout-outcomes/types'

const routine: MobilityRoutineExercise[] = [
  { id: 'hip-90-90', name: 'Hip 90/90', sets: [{ durationSec: 60 }] },
  { id: 'wall-slides', name: 'Wall Slides', sets: [{ reps: 10 }, { reps: 8 }], restSec: 20, notes: 'slow' },
]

describe('mobilityExerciseToSpec', () => {
  it('maps timed holds to duration sets and rep sets to reps, with no warmup ramp', () => {
    expect(mobilityExerciseToSpec(routine[0])).toEqual({
      exercise: 'Hip 90/90',
      sets: [{ duration: '60s' }],
      warmup: 'none',
    })
    expect(mobilityExerciseToSpec(routine[1])).toEqual({
      exercise: 'Wall Slides',
      sets: [{ reps: 10 }, { reps: 8 }],
      rest: '20s',
      notes: 'slow',
      warmup: 'none',
    })
  })

  it('falls back to the default hold for a set with neither field', () => {
    expect(mobilityExerciseToSpec({ id: 'x', name: 'X', sets: [{}] }).sets).toEqual([{ duration: `${DEFAULT_MOBILITY_HOLD_SEC}s` }])
  })
})

describe('mobilityRoutineToSlot', () => {
  it('wraps the routine as a mobility slot', () => {
    const slot = mobilityRoutineToSlot(routine, { id: 'daily', name: 'Daily Routine' })
    expect(slot.type).toBe('mobility')
    expect(slot.name).toBe('Daily Routine')
    expect(slot.exercises?.map(e => e.exercise)).toEqual(['Hip 90/90', 'Wall Slides'])
  })

  it('normalizes legacy exercises without sets', () => {
    const legacy = [{ id: 'old', name: 'Old', durationSec: 40 }] as unknown as MobilityRoutineExercise[]
    expect(mobilityRoutineToSlot(legacy, { id: 'd', name: 'D' }).exercises?.[0].sets).toEqual([{ duration: '40s' }])
  })
})

describe('mobilityLibraryHoldSec', () => {
  it('uses the library default, case-insensitively, else the fallback', () => {
    expect(mobilityLibraryHoldSec('wall slides')).toBe(45)
    expect(mobilityLibraryHoldSec('Not A Real Stretch')).toBe(DEFAULT_MOBILITY_HOLD_SEC)
  })
})

const logged: LoggedExerciseActual[] = [
  { exercise: 'Hip 90/90', sets: [{ targetReps: 60, actualReps: 42, completed: true, isTimed: true }] },
  { exercise: 'Wall Slides', sets: [{ targetReps: 10, actualReps: 10, completed: true }, { targetReps: 8, actualReps: 8, completed: false }] },
]

describe('trackedToMobilityActual', () => {
  it('splits timed seconds back into duration fields and drops actuals for unfinished sets', () => {
    expect(trackedToMobilityActual(logged)).toEqual({
      exercises: [
        { exercise: 'Hip 90/90', sets: [{ targetDurationSec: 60, targetReps: null, actualDurationSec: 42, actualReps: null, completed: true }] },
        {
          exercise: 'Wall Slides',
          sets: [
            { targetDurationSec: null, targetReps: 10, actualDurationSec: null, actualReps: 10, completed: true },
            { targetDurationSec: null, targetReps: 8, actualDurationSec: null, actualReps: null, completed: false },
          ],
        },
      ],
    })
  })
})

describe('trackedToMobilityProgress', () => {
  it('keys progress by routine id, matching names in order', () => {
    expect(trackedToMobilityProgress(logged, routine)).toEqual({
      completedExerciseIds: ['hip-90-90'],
      completedSets: { 'hip-90-90': [0], 'wall-slides': [0] },
    })
  })

  it('gives exercises added mid-session distinct synthetic ids', () => {
    const extra: LoggedExerciseActual[] = [
      { exercise: 'Hip 90/90', sets: [{ completed: true }] },
      { exercise: 'Hip 90/90', sets: [{ completed: true }] },
      { exercise: 'Calf Stretch', sets: [{ completed: true }] },
      { exercise: 'Calf Stretch', sets: [{ completed: false }] },
    ]
    const { completedExerciseIds, completedSets } = trackedToMobilityProgress(extra, routine)
    expect(Object.keys(completedSets)).toEqual(['hip-90-90', 'added-hip-90-90', 'added-calf-stretch', 'added-calf-stretch-2'])
    expect(completedExerciseIds).toEqual(['hip-90-90', 'added-hip-90-90', 'added-calf-stretch'])
  })
})

describe('insertRoutineExercise', () => {
  it('inserts a library exercise with its id and default hold', () => {
    const next = insertRoutineExercise(routine, 'wall slides', 1)
    expect(next.map(e => e.name)).toEqual(['Hip 90/90', 'Wall Slides', 'Wall Slides'])
    expect(next[1]).toMatchObject({ id: 'lib-wall-slides', sets: [{ durationSec: 45 }] })
  })

  it('gives custom or duplicate exercises a fresh id and clamps the index', () => {
    const once = insertRoutineExercise([], 'Wall Slides', 0)
    const twice = insertRoutineExercise(once, 'Wall Slides', 99)
    expect(twice[1].id).not.toBe('lib-wall-slides')
    const custom = insertRoutineExercise(routine, ' Neck Rolls ', 0)[0]
    expect(custom).toMatchObject({ name: 'Neck Rolls', sets: [{ durationSec: DEFAULT_MOBILITY_HOLD_SEC }] })
  })
})

describe('replaceRoutineExercise', () => {
  it('renames in place and keeps dosing, rest, and notes', () => {
    const next = replaceRoutineExercise(routine, 1, 'Prone Y-T-W')
    expect(next[1]).toEqual({ id: 'lib-prone-ytw', name: 'Prone Y-T-W', sets: [{ reps: 10 }, { reps: 8 }], restSec: 20, notes: 'slow' })
    expect(next[0]).toBe(routine[0])
  })

  it('ignores an out-of-range index', () => {
    expect(replaceRoutineExercise(routine, 5, 'X')).toBe(routine)
  })
})

describe('mobilityCompletionToResumeOutcome', () => {
  it('marks logged sets done, falling back to whole exercises for older logs', () => {
    const outcome = mobilityCompletionToResumeOutcome(
      { completedAt: 't', durationMin: 7, completedExerciseIds: ['hip-90-90'], completedSets: { 'wall-slides': [1] } },
      routine,
      'mobility_2026-11-10',
    )
    expect(outcome.durationActualMin).toBe(7)
    expect(outcome.weightsActual?.exercises).toEqual([
      { exercise: 'Hip 90/90', sets: [{ completed: true }] },
      { exercise: 'Wall Slides', sets: [{ completed: false }, { completed: true }] },
    ])
  })
})

describe('mobilityCompletionState', () => {
  it('is completed when all routine exercises are done or the routine is empty', () => {
    expect(mobilityCompletionState(routine, ['hip-90-90', 'wall-slides'])).toBe('completed')
    expect(mobilityCompletionState([], [])).toBe('completed')
  })

  it('is partial when anything is done, else skipped', () => {
    expect(mobilityCompletionState(routine, ['hip-90-90'])).toBe('partially_completed')
    expect(mobilityCompletionState(routine, ['added-neck-rolls'])).toBe('partially_completed')
    expect(mobilityCompletionState(routine, [])).toBe('skipped')
  })
})
