/**
 * Tests for parseYamlProgram's `mobility` slot handling — parsing a slot's
 * `mobilityExercises` (timed holds and rep-based sets) into the runtime
 * MobilityRoutineExercise shape used by WorkoutSlot.mobilityExercises.
 */
import { describe, it, expect } from 'vitest'
import { parseYamlProgram } from '../programParser'

const BASE_YAML = `
schemaVersion: 1
name: Test Program
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: mobility
        name: PT Shoulder Work
        mobilityExercises:
          - name: Banded Wall Slide
            sets:
              - duration: 45s
            rest: 15s
          - name: Shoulder Isometric ER
            sets:
              - reps: 10
              - reps: 10
            rest: 30s
          - name: Overhead KB Carry
            sets:
              - duration: 60
`

describe('parseYamlProgram — mobility slots', () => {
  it('parses type: mobility into WorkoutType "mobility"', () => {
    const { plan, errors } = parseYamlProgram(BASE_YAML)
    expect(errors).toEqual([])
    expect(plan.days[0].slots[0].type).toBe('mobility')
  })

  it('parses each mobilityExercises entry with its sets', () => {
    const { plan } = parseYamlProgram(BASE_YAML)
    const exercises = plan.days[0].slots[0].mobilityExercises!
    expect(exercises).toHaveLength(3)
    expect(exercises[0].name).toBe('Banded Wall Slide')
    expect(exercises[0].sets).toEqual([{ durationSec: 45, reps: undefined }])
    expect(exercises[0].restSec).toBe(15)
  })

  it('parses rep-based sets distinctly from timed sets', () => {
    const { plan } = parseYamlProgram(BASE_YAML)
    const exercises = plan.days[0].slots[0].mobilityExercises!
    expect(exercises[1].sets).toEqual([
      { durationSec: undefined, reps: 10 },
      { durationSec: undefined, reps: 10 },
    ])
  })

  it('accepts a plain numeric duration (seconds) in addition to "45s" strings', () => {
    const { plan } = parseYamlProgram(BASE_YAML)
    const exercises = plan.days[0].slots[0].mobilityExercises!
    expect(exercises[2].sets).toEqual([{ durationSec: 60, reps: undefined }])
  })

  it('defaults a mobility exercise with no sets to a single 45s hold', () => {
    const yaml = `
schemaVersion: 1
name: Test Program
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: mobility
        mobilityExercises:
          - name: Cat-Cow
`
    const { plan } = parseYamlProgram(yaml)
    const exercises = plan.days[0].slots[0].mobilityExercises!
    expect(exercises[0].sets).toEqual([{ durationSec: 45 }])
  })

  it('does not populate mobilityExercises for a non-mobility slot', () => {
    const yaml = `
schemaVersion: 1
name: Test Program
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: weights
        exercises:
          - exercise: Bench Press
            sets: 3
            reps: 8
`
    const { plan } = parseYamlProgram(yaml)
    expect(plan.days[0].slots[0].mobilityExercises).toBeUndefined()
  })
})
