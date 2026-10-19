import { describe, it, expect } from 'vitest'
import { evaluateExerciseProgress, topOfRepRange } from '../exerciseProgress'
import type { ExerciseSpec } from '../../../types/program'
import type { LoggedSetActual } from '../types'

const set = (actualReps: number, completed = true, isWarmup = false): LoggedSetActual => ({ actualReps, completed, isWarmup })
const spec = (reps: ExerciseSpec['reps'], sets: ExerciseSpec['sets'] = 3): ExerciseSpec => ({ exercise: 'Squat', reps, sets })

describe('topOfRepRange', () => {
  it('reads the upper bound', () => {
    expect(topOfRepRange('8-12')).toBe(12)
    expect(topOfRepRange('5+')).toBe(5)
    expect(topOfRepRange(5)).toBe(5)
    expect(topOfRepRange('AMRAP')).toBeNull()
    expect(topOfRepRange(undefined)).toBeNull()
  })
})

describe('evaluateExerciseProgress', () => {
  it('hits only when every working set reaches the top of the range', () => {
    expect(evaluateExerciseProgress(spec('6-8'), { exercise: 'Squat', sets: [set(8), set(8), set(8)] })).toBe('hit')
    expect(evaluateExerciseProgress(spec('6-8'), { exercise: 'Squat', sets: [set(8), set(8), set(7)] })).toBe('missed')
  })

  it('ignores warmup sets', () => {
    expect(evaluateExerciseProgress(spec('6-8'), {
      exercise: 'Squat', sets: [set(3, false, true), set(8), set(8), set(8)],
    })).toBe('hit')
  })

  it('is incomplete when skipped or any working set is unfinished', () => {
    expect(evaluateExerciseProgress(spec('6-8'), undefined)).toBe('incomplete')
    expect(evaluateExerciseProgress(spec('6-8'), { exercise: 'Squat', sets: [set(8), set(8), set(8, false)] })).toBe('incomplete')
  })

  it('uses per-set rep targets', () => {
    const perSet = spec(undefined, [{ reps: '6-12' }, { reps: '3-6' }, { reps: '3-6' }])
    expect(evaluateExerciseProgress(perSet, { exercise: 'Squat', sets: [set(12), set(6), set(6)] })).toBe('hit')
    expect(evaluateExerciseProgress(perSet, { exercise: 'Squat', sets: [set(12), set(6), set(5)] })).toBe('missed')
  })
})
