/**
 * Tests for parseYamlProgram — mobility slot handling, duration parsing,
 * workout type coercion, validation errors, and structure descriptions.
 */
import { describe, it, expect } from 'vitest'
import { parseYamlProgram, validateYamlProgram } from '../programParser'

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

// ── parseDurationSecs (via mobilityExercises.sets.duration) ─────────────────

describe('parseDurationSecs — duration string parsing', () => {
  function parsedDurationSec(duration: string | number): number | undefined {
    const yaml = `
schemaVersion: 1
name: T
duration:
  type: weeks
  value: 1
days:
  - label: D1
    slots:
      - type: mobility
        mobilityExercises:
          - name: Ex
            sets:
              - duration: ${duration}
`
    const { plan } = parseYamlProgram(yaml)
    return plan.days[0].slots[0].mobilityExercises![0].sets[0].durationSec
  }

  it('parses "45s" to 45 seconds', () => {
    expect(parsedDurationSec('45s')).toBe(45)
  })

  it('parses "1m" to 60 seconds', () => {
    expect(parsedDurationSec('1m')).toBe(60)
  })

  it('parses "1.5m" to 90 seconds (rounded)', () => {
    expect(parsedDurationSec('1.5m')).toBe(90)
  })

  it('parses a plain number as seconds', () => {
    expect(parsedDurationSec(30)).toBe(30)
  })
})

// ── coerceWorkoutType (via slot.type) ─────────────────────────────────────────

describe('coerceWorkoutType — slot type coercion', () => {
  function slotType(type: string): string {
    const yaml = `
schemaVersion: 1
name: T
duration:
  type: weeks
  value: 1
days:
  - label: D1
    slots:
      - type: ${type}
`
    return parseYamlProgram(yaml).plan.days[0].slots[0].type
  }

  it('maps "rest" to "other" (legacy alias)', () => {
    expect(slotType('rest')).toBe('other')
  })

  it('maps an unknown type to "other"', () => {
    expect(slotType('unknown_type')).toBe('other')
  })

  it('passes through a valid modern type unchanged', () => {
    expect(slotType('weights')).toBe('weights')
    expect(slotType('run')).toBe('run')
    expect(slotType('swim')).toBe('swim')
  })

  it('passes through legacy types for backward compat', () => {
    expect(slotType('weightlifting')).toBe('weightlifting')
    expect(slotType('long_run')).toBe('long_run')
  })
})

// ── parseYamlProgram — validation errors ──────────────────────────────────────

describe('parseYamlProgram — validation errors', () => {
  it('returns a YAML parse error for invalid YAML syntax', () => {
    const { errors } = parseYamlProgram(': }: invalid: {')
    expect(errors.some(e => e.toLowerCase().includes('yaml parse error'))).toBe(true)
  })

  it('returns an error when name is missing', () => {
    const yaml = `
schemaVersion: 1
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: weights
`
    const { errors } = parseYamlProgram(yaml)
    expect(errors.some(e => e.includes('name'))).toBe(true)
  })

  it('returns an error when duration is missing', () => {
    const yaml = `
schemaVersion: 1
name: Test
days:
  - label: Day 1
    slots:
      - type: weights
`
    const { errors } = parseYamlProgram(yaml)
    expect(errors.some(e => e.includes('duration'))).toBe(true)
  })

  it('returns an error when days array is empty', () => {
    const yaml = `
schemaVersion: 1
name: Test
duration:
  type: weeks
  value: 4
days: []
`
    const { errors } = parseYamlProgram(yaml)
    expect(errors.some(e => e.includes('days'))).toBe(true)
  })

  it('returns an error when a var is a non-numeric string', () => {
    const yaml = `
schemaVersion: 1
name: Test
duration:
  type: weeks
  value: 4
vars:
  squat: "heavy"
days:
  - label: Day 1
    slots:
      - type: weights
`
    const { errors } = parseYamlProgram(yaml)
    expect(errors.some(e => e.includes('vars.squat'))).toBe(true)
  })

  it('accepts a numeric var without error', () => {
    const yaml = `
schemaVersion: 1
name: Test
duration:
  type: weeks
  value: 4
vars:
  squat: 135
days:
  - label: Day 1
    slots:
      - type: weights
`
    const { plan, errors } = parseYamlProgram(yaml)
    expect(errors).toEqual([])
    expect(plan.programMeta?.vars).toEqual({ squat: 135 })
  })

  it('returns no errors for a minimal valid program', () => {
    const yaml = `
schemaVersion: 1
name: Minimal Plan
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: weights
`
    expect(parseYamlProgram(yaml).errors).toEqual([])
  })
})

// ── validateYamlProgram ───────────────────────────────────────────────────────

describe('validateYamlProgram', () => {
  it('returns empty array for a valid program', () => {
    const yaml = `
schemaVersion: 1
name: Valid
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: run
`
    expect(validateYamlProgram(yaml)).toEqual([])
  })

  it('returns error strings for an invalid program', () => {
    const errors = validateYamlProgram('name: only_name')
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ── buildStructureDescription ─────────────────────────────────────────────────

describe('buildStructureDescription — weights slot', () => {
  it('summarises exercises as "Name N×reps" joined by ·', () => {
    const yaml = `
schemaVersion: 1
name: T
duration:
  type: weeks
  value: 1
days:
  - label: D1
    slots:
      - type: weights
        exercises:
          - exercise: Squat
            sets: 3
            reps: 5
          - exercise: Bench Press
            sets: 4
            reps: 8
`
    const slot = parseYamlProgram(yaml).plan.days[0].slots[0]
    expect(slot.structureDescription).toBe('Squat 3×5 · Bench Press 4×8')
  })

  it('returns undefined for a slot with no exercises', () => {
    const yaml = `
schemaVersion: 1
name: T
duration:
  type: weeks
  value: 1
days:
  - label: D1
    slots:
      - type: weights
`
    const slot = parseYamlProgram(yaml).plan.days[0].slots[0]
    expect(slot.structureDescription).toBeUndefined()
  })
})

describe('buildStructureDescription — run slot', () => {
  it('summarises segments as "Type → Type" joined by →', () => {
    const yaml = `
schemaVersion: 1
name: T
duration:
  type: weeks
  value: 1
days:
  - label: D1
    slots:
      - type: run
        segments:
          - type: warmup
            duration: 10min
          - type: easy
            distance: 3mi
`
    const slot = parseYamlProgram(yaml).plan.days[0].slots[0]
    expect(slot.structureDescription).toContain('Warmup')
    expect(slot.structureDescription).toContain('Easy')
    expect(slot.structureDescription).toContain('→')
  })
})
