/**
 * Tests for the YAML program parser.
 */
import { describe, it, expect } from 'vitest'
import { parseYamlProgram, validateYamlProgram } from '../programParser'

// ── Minimal valid YAML ────────────────────────────────────────────────────────

const MINIMAL_YAML = `
name: Test Plan
duration:
  type: weeks
  value: 4
days:
  - label: Day A
    slots:
      - type: weights
        name: Upper Body
`

const WEIGHTS_YAML = `
name: Weights Plan
duration:
  type: weeks
  value: 8
days:
  - label: Push Day
    slots:
      - type: weights
        name: Push
        focus: upper
        intent: strength
        difficulty: hard
        exercises:
          - exercise: Bench Press
            sets: 3
            reps: "5"
            load: "225"
          - exercise: Overhead Press
            sets:
              - reps: 5
                load: "135"
              - reps: 5
                load: "135"
`

const RUN_YAML = `
name: 5K Plan
duration:
  type: weeks
  value: 6
days:
  - label: Interval Day
    slots:
      - type: run
        name: Intervals
        subtype: intervals
        segments:
          - type: warmup
            distance: "1 mi"
            pace: "9:00"
          - type: interval
            distance: "400m"
            reps: 6
            rest: "90s"
          - type: cooldown
            distance: "0.5 mi"
`

const VARS_YAML = `
name: Progressive Plan
duration:
  type: weeks
  value: 12
vars:
  squat: 225
  deadlift: 275
  bench: 185
days:
  - label: Day 1
    slots:
      - type: weights
        name: Lower
`

// ── Fixtures ──────────────────────────────────────────────────────────────────

describe('parseYamlProgram', () => {
  describe('happy path — minimal valid YAML', () => {
    it('returns no errors for valid YAML', () => {
      const { errors } = parseYamlProgram(MINIMAL_YAML)
      expect(errors).toHaveLength(0)
    })

    it('parses plan name', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      expect(plan.name).toBe('Test Plan')
    })

    it('parses duration type and value', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      expect(plan.duration.type).toBe('weeks')
      expect(plan.duration.value).toBe(4)
    })

    it('parses days array', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      expect(plan.days).toHaveLength(1)
      expect(plan.days[0].label).toBe('Day A')
    })

    it('parses slots within a day', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      const slots = plan.days[0].slots
      expect(slots).toHaveLength(1)
      expect(slots[0].type).toBe('weights')
      expect(slots[0].name).toBe('Upper Body')
    })

    it('assigns a unique id to each day', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      const id = plan.days[0].id
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('assigns a unique id to each slot', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      const id = plan.days[0].slots[0].id
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('sets plan status to inactive', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      expect(plan.status).toBe('inactive')
    })
  })

  describe('validation errors', () => {
    it('returns error for missing name', () => {
      const yaml = `
duration:
  type: weeks
  value: 4
days:
  - label: Day A
    slots:
      - type: weights
`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.some(e => e.includes('name'))).toBe(true)
    })

    it('returns error for missing duration', () => {
      const yaml = `
name: Test
days:
  - label: Day A
    slots:
      - type: weights
`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.some(e => e.includes('duration'))).toBe(true)
    })

    it('returns error for empty days array', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
days: []
`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.some(e => e.includes('days'))).toBe(true)
    })

    it('returns error for invalid YAML syntax', () => {
      const yaml = `name: Test\n  bad: indent: here:`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.some(e => e.includes('YAML parse error'))).toBe(true)
    })

    it('returns fallback plan on YAML parse error', () => {
      const yaml = `name: Test\n  bad: indent: here:`
      const { plan } = parseYamlProgram(yaml)
      expect(plan.name).toBe('Imported Program')
      expect(plan.days).toHaveLength(0)
    })

    it('returns errors when document is a bare list (missing all required fields)', () => {
      // YAML arrays satisfy typeof === 'object', so the parser processes them
      // and produces field-missing errors rather than a top-level type error.
      const yaml = `- just a list`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.includes('name') || e.includes('duration') || e.includes('days'))).toBe(true)
    })

    it('accumulates multiple errors', () => {
      const yaml = `description: only a description`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.length).toBeGreaterThan(1)
    })
  })

  describe('weights slot parsing', () => {
    it('parses focus area', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      expect(plan.days[0].slots[0].weightsFocusArea).toBe('upper')
    })

    it('parses training intent', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      expect(plan.days[0].slots[0].weightsIntent).toBe('strength')
    })

    it('parses difficulty', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      expect(plan.days[0].slots[0].difficulty).toBe('hard')
    })

    it('parses exercises array', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      const exercises = plan.days[0].slots[0].exercises
      expect(exercises).toHaveLength(2)
      expect(exercises![0].exercise).toBe('Bench Press')
    })

    it('parses numeric sets count', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      expect(plan.days[0].slots[0].exercises![0].sets).toBe(3)
    })

    it('parses per-set set specs', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      const sets = plan.days[0].slots[0].exercises![1].sets
      expect(Array.isArray(sets)).toBe(true)
      expect((sets as unknown[]).length).toBe(2)
    })

    it('builds structureDescription for weights', () => {
      const { plan } = parseYamlProgram(WEIGHTS_YAML)
      const desc = plan.days[0].slots[0].structureDescription
      expect(typeof desc).toBe('string')
      expect(desc).toContain('Bench Press')
    })
  })

  describe('run slot parsing', () => {
    it('parses run slot type', () => {
      const { plan } = parseYamlProgram(RUN_YAML)
      expect(plan.days[0].slots[0].type).toBe('run')
    })

    it('parses segments array', () => {
      const { plan } = parseYamlProgram(RUN_YAML)
      const segments = plan.days[0].slots[0].segments
      expect(segments).toHaveLength(3)
    })

    it('parses segment type and distance', () => {
      const { plan } = parseYamlProgram(RUN_YAML)
      const seg = plan.days[0].slots[0].segments![0]
      expect(seg.type).toBe('warmup')
      expect(seg.distance).toBe('1 mi')
      expect(seg.pace).toBe('9:00')
    })

    it('parses interval reps', () => {
      const { plan } = parseYamlProgram(RUN_YAML)
      const seg = plan.days[0].slots[0].segments![1]
      expect(seg.reps).toBe(6)
    })

    it('builds structureDescription for run slots', () => {
      const { plan } = parseYamlProgram(RUN_YAML)
      const desc = plan.days[0].slots[0].structureDescription
      expect(typeof desc).toBe('string')
      expect(desc).toContain('Warmup')
      expect(desc).toContain('→')
    })
  })

  describe('program vars', () => {
    it('parses numeric vars into programMeta', () => {
      const { plan } = parseYamlProgram(VARS_YAML)
      expect(plan.programMeta).toBeDefined()
      expect(plan.programMeta!.vars.squat).toBe(225)
      expect(plan.programMeta!.vars.deadlift).toBe(275)
    })

    it('sets programMeta version to 1', () => {
      const { plan } = parseYamlProgram(VARS_YAML)
      expect(plan.programMeta!.version).toBe(1)
    })

    it('errors on non-numeric var values', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
vars:
  squat: "heavy"
days:
  - label: Day A
    slots:
      - type: weights
`
      const { errors } = parseYamlProgram(yaml)
      expect(errors.some(e => e.includes('vars.squat'))).toBe(true)
    })

    it('sets programMeta to undefined when no vars defined', () => {
      const { plan } = parseYamlProgram(MINIMAL_YAML)
      expect(plan.programMeta).toBeUndefined()
    })
  })

  describe('type coercions', () => {
    it('coerces unknown slot type to "other"', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: crossfit
`
      const { plan } = parseYamlProgram(yaml)
      expect(plan.days[0].slots[0].type).toBe('other')
    })

    it('coerces "rest" slot type to "other"', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: rest
`
      const { plan } = parseYamlProgram(yaml)
      expect(plan.days[0].slots[0].type).toBe('other')
    })

    it('ignores invalid focus area', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: weights
        focus: chest
`
      const { plan } = parseYamlProgram(yaml)
      expect(plan.days[0].slots[0].weightsFocusArea).toBeUndefined()
    })

    it('ignores invalid difficulty', () => {
      const yaml = `
name: Test
duration:
  type: weeks
  value: 4
days:
  - label: Day 1
    slots:
      - type: weights
        difficulty: extreme
`
      const { plan } = parseYamlProgram(yaml)
      expect(plan.days[0].slots[0].difficulty).toBeUndefined()
    })
  })
})

// ── validateYamlProgram ───────────────────────────────────────────────────────

describe('validateYamlProgram', () => {
  it('returns empty array for valid YAML', () => {
    expect(validateYamlProgram(MINIMAL_YAML)).toHaveLength(0)
  })

  it('returns error strings for invalid YAML', () => {
    const errors = validateYamlProgram('name: only name')
    expect(errors.length).toBeGreaterThan(0)
  })
})
