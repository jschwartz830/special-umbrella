import { describe, it, expect } from 'vitest'
import { exerciseEquipment, exercisePrimaryMuscle, EXERCISE_LIBRARY, findExerciseByName } from '../exerciseLibrary'

describe('exerciseEquipment', () => {
  it('returns the text after the last comma', () => {
    expect(exerciseEquipment('Bench Press, Barbell')).toBe('Barbell')
    expect(exerciseEquipment('Squat, Smith Machine')).toBe('Smith Machine')
  })

  it('falls back to "Other" when the name has no comma', () => {
    expect(exerciseEquipment('Farmer Carry')).toBe('Other')
  })

  it('trims surrounding whitespace', () => {
    expect(exerciseEquipment('Row,  Cable')).toBe('Cable')
  })
})

describe('exercisePrimaryMuscle', () => {
  it('returns the first target muscle', () => {
    const ex = findExerciseByName('Bench Press, Barbell')!
    expect(exercisePrimaryMuscle(ex)).toBe('chest')
  })

  it('falls back to "other" when target is empty', () => {
    expect(exercisePrimaryMuscle({ name: 'x', type: [], target: [], synergist: [] })).toBe('other')
  })
})

describe('EXERCISE_LIBRARY', () => {
  it('has no duplicate names', () => {
    const names = EXERCISE_LIBRARY.map(ex => ex.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
