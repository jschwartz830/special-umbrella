/**
 * Tests for planStore business logic.
 *
 * Covers setActivePlan, duplicatePlan, createPlan, archivePlan, deletePlan, and
 * deactivatePlan. The persist middleware is mocked as a pass-through so the
 * store works in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { usePlanStore } from '../planStore'
// eslint-disable-next-line import/first
import type { Plan } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlan(id: string, status: Plan['status'] = 'inactive'): Plan {
  return {
    id,
    name: `Plan ${id}`,
    status,
    days: [{ id: 'd1', label: 'Day 1', slots: [{ id: 's1', type: 'weights', name: 'Lift' }] }],
    duration: { type: 'rotations', value: 4 },
    startDate: '2026-01-01',
    startDayIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function getState() {
  return usePlanStore.getState()
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  usePlanStore.setState({ plans: {}, activePlanId: null })
})

// ── createPlan ────────────────────────────────────────────────────────────────

describe('createPlan', () => {
  it('adds a new plan to the store and returns its id', () => {
    const id = getState().createPlan({
      name: 'My Plan',
      status: 'inactive',
      days: [],
      duration: { type: 'rotations', value: 4 },
      startDate: '2026-01-01',
      startDayIndex: 0,
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(getState().plans[id]).toBeDefined()
    expect(getState().plans[id].name).toBe('My Plan')
  })

  it('assigns createdAt and updatedAt timestamps', () => {
    const id = getState().createPlan({
      name: 'Timed',
      status: 'inactive',
      days: [],
      duration: { type: 'weeks', value: 8 },
      startDate: '2026-01-01',
      startDayIndex: 0,
    })
    const plan = getState().plans[id]
    expect(typeof plan.createdAt).toBe('string')
    expect(plan.createdAt).toBe(plan.updatedAt)
  })

  it('stores multiple plans independently', () => {
    const a = getState().createPlan({ name: 'A', status: 'inactive', days: [], duration: { type: 'rotations', value: 1 }, startDate: '2026-01-01', startDayIndex: 0 })
    const b = getState().createPlan({ name: 'B', status: 'inactive', days: [], duration: { type: 'rotations', value: 2 }, startDate: '2026-01-01', startDayIndex: 0 })
    expect(Object.keys(getState().plans)).toHaveLength(2)
    expect(getState().plans[a].name).toBe('A')
    expect(getState().plans[b].name).toBe('B')
  })
})

// ── setActivePlan ─────────────────────────────────────────────────────────────

describe('setActivePlan', () => {
  it('sets the plan to active and stores its id', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().setActivePlan('plan-1')
    expect(getState().activePlanId).toBe('plan-1')
    expect(getState().plans['plan-1'].status).toBe('active')
  })

  it('deactivates the previously active plan', () => {
    const planA = makePlan('plan-a', 'active')
    const planB = makePlan('plan-b', 'inactive')
    usePlanStore.setState({ plans: { 'plan-a': planA, 'plan-b': planB }, activePlanId: 'plan-a' })

    getState().setActivePlan('plan-b')

    expect(getState().activePlanId).toBe('plan-b')
    expect(getState().plans['plan-b'].status).toBe('active')
    expect(getState().plans['plan-a'].status).toBe('inactive')
  })

  it('accepts optional startDate override', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().setActivePlan('plan-1', { startDate: '2026-03-15' })
    expect(getState().plans['plan-1'].startDate).toBe('2026-03-15')
  })

  it('accepts optional startDayIndex override', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().setActivePlan('plan-1', { startDayIndex: 2 })
    expect(getState().plans['plan-1'].startDayIndex).toBe(2)
  })

  it('uses today as default startDate when no override provided', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().setActivePlan('plan-1')
    // Should be a YYYY-MM-DD string matching today
    expect(getState().plans['plan-1'].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('is a no-op when the plan id does not exist', () => {
    usePlanStore.setState({ plans: {}, activePlanId: null })
    getState().setActivePlan('nonexistent-id')
    expect(getState().plans['nonexistent-id']).toBeUndefined()
    expect(getState().activePlanId).toBeNull()
  })
})

// ── deactivatePlan ────────────────────────────────────────────────────────────

describe('deactivatePlan', () => {
  it('sets active plan status to inactive and clears activePlanId', () => {
    const plan = makePlan('plan-1', 'active')
    usePlanStore.setState({ plans: { 'plan-1': plan }, activePlanId: 'plan-1' })
    getState().deactivatePlan()
    expect(getState().activePlanId).toBeNull()
    expect(getState().plans['plan-1'].status).toBe('inactive')
  })

  it('is a no-op when no active plan', () => {
    usePlanStore.setState({ plans: {}, activePlanId: null })
    expect(() => getState().deactivatePlan()).not.toThrow()
  })
})

// ── archivePlan ───────────────────────────────────────────────────────────────

describe('archivePlan', () => {
  it('sets plan status to archived', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().archivePlan('plan-1')
    expect(getState().plans['plan-1'].status).toBe('archived')
  })

  it('clears activePlanId when the archived plan was active', () => {
    const plan = makePlan('plan-1', 'active')
    usePlanStore.setState({ plans: { 'plan-1': plan }, activePlanId: 'plan-1' })
    getState().archivePlan('plan-1')
    expect(getState().activePlanId).toBeNull()
  })

  it('leaves activePlanId when a different plan is archived', () => {
    const planA = makePlan('plan-a', 'active')
    const planB = makePlan('plan-b', 'inactive')
    usePlanStore.setState({ plans: { 'plan-a': planA, 'plan-b': planB }, activePlanId: 'plan-a' })
    getState().archivePlan('plan-b')
    expect(getState().activePlanId).toBe('plan-a')
    expect(getState().plans['plan-b'].status).toBe('archived')
  })
})

// ── deletePlan ────────────────────────────────────────────────────────────────

describe('deletePlan', () => {
  it('removes the plan from the store', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().deletePlan('plan-1')
    expect(getState().plans['plan-1']).toBeUndefined()
  })

  it('clears activePlanId when the deleted plan was active', () => {
    const plan = makePlan('plan-1', 'active')
    usePlanStore.setState({ plans: { 'plan-1': plan }, activePlanId: 'plan-1' })
    getState().deletePlan('plan-1')
    expect(getState().activePlanId).toBeNull()
  })

  it('does not affect other plans', () => {
    const planA = makePlan('plan-a')
    const planB = makePlan('plan-b')
    usePlanStore.setState({ plans: { 'plan-a': planA, 'plan-b': planB } })
    getState().deletePlan('plan-a')
    expect(getState().plans['plan-b']).toBeDefined()
  })
})

// ── duplicatePlan ─────────────────────────────────────────────────────────────

describe('duplicatePlan', () => {
  it('creates a new plan with a different id', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    const newId = getState().duplicatePlan('plan-1')
    expect(newId).not.toBe('plan-1')
    expect(newId.length).toBeGreaterThan(0)
    expect(getState().plans[newId]).toBeDefined()
  })

  it('preserves name with "(copy)" suffix', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    const newId = getState().duplicatePlan('plan-1')
    expect(getState().plans[newId].name).toBe('Plan plan-1 (copy)')
  })

  it('sets copy status to inactive regardless of source status', () => {
    const plan = makePlan('plan-1', 'active')
    usePlanStore.setState({ plans: { 'plan-1': plan }, activePlanId: 'plan-1' })
    const newId = getState().duplicatePlan('plan-1')
    expect(getState().plans[newId].status).toBe('inactive')
  })

  it('creates new ids for duplicated days and slots', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    const newId = getState().duplicatePlan('plan-1')
    const origDay = plan.days[0]
    const copyDay = getState().plans[newId].days[0]
    expect(copyDay.id).not.toBe(origDay.id)
    expect(copyDay.slots[0].id).not.toBe(origDay.slots[0].id)
  })

  it('preserves the original plan unchanged', () => {
    const plan = makePlan('plan-1')
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    getState().duplicatePlan('plan-1')
    expect(getState().plans['plan-1']).toBeDefined()
    expect(getState().plans['plan-1'].status).toBe('inactive')
  })

  it('returns empty string for a nonexistent plan id', () => {
    const result = getState().duplicatePlan('does-not-exist')
    expect(result).toBe('')
  })

  it('deep-clones exercises array so edits to one plan do not affect the other', () => {
    const planWithExercises: Plan = {
      ...makePlan('plan-1'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'weights',
          name: 'Weights',
          exercises: [{ exercise: 'Squat', sets: 3, reps: '5', load: '135lb' }],
        }],
      }],
    }
    usePlanStore.setState({ plans: { 'plan-1': planWithExercises } })
    const newId = getState().duplicatePlan('plan-1')

    const origSlot = getState().plans['plan-1'].days[0].slots[0]
    const copySlot = getState().plans[newId].days[0].slots[0]

    // Array references must differ
    expect(origSlot.exercises).not.toBe(copySlot.exercises)
    // But content must be equal
    expect(copySlot.exercises).toEqual(origSlot.exercises)
  })

  it('deep-clones segments array so edits to one plan do not affect the other', () => {
    const planWithSegments: Plan = {
      ...makePlan('plan-1'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'run',
          name: 'Run',
          segments: [{ type: 'easy', duration: '10m', notes: 'warmup' }],
        }],
      }],
    }
    usePlanStore.setState({ plans: { 'plan-1': planWithSegments } })
    const newId = getState().duplicatePlan('plan-1')

    const origSlot = getState().plans['plan-1'].days[0].slots[0]
    const copySlot = getState().plans[newId].days[0].slots[0]

    expect(origSlot.segments).not.toBe(copySlot.segments)
    expect(copySlot.segments).toEqual(origSlot.segments)
  })

  it('deep-clones SetSpec[] within exercises so per-set edits do not cross plans', () => {
    const planWithSetSpecs: Plan = {
      ...makePlan('plan-1'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'weights',
          name: 'Weights',
          exercises: [{
            exercise: 'Squat',
            // sets is an array of SetSpec objects (not a plain number)
            sets: [
              { reps: 5, load: '135lb', rest: '3m' },
              { reps: 5, load: '135lb', rest: '3m' },
            ],
          }],
        }],
      }],
    }
    usePlanStore.setState({ plans: { 'plan-1': planWithSetSpecs } })
    const newId = getState().duplicatePlan('plan-1')

    const origSets = (getState().plans['plan-1'].days[0].slots[0].exercises as import('../../types/program').ExerciseSpec[])[0].sets as import('../../types/program').SetSpec[]
    const copySets = (getState().plans[newId].days[0].slots[0].exercises as import('../../types/program').ExerciseSpec[])[0].sets as import('../../types/program').SetSpec[]

    // The sets arrays must be different objects (not shared references)
    expect(origSets).not.toBe(copySets)
    // But the individual SetSpec objects must also be different (cloned)
    expect(origSets[0]).not.toBe(copySets[0])
    // Content must be equal
    expect(copySets).toEqual(origSets)
  })

  it('deep-clones DrillSpec[] within RunSegment.drills so drill edits do not cross plans', () => {
    const planWithDrills: Plan = {
      ...makePlan('plan-1'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'run',
          name: 'Run',
          segments: [{
            type: 'drills',
            drills: [
              { name: 'High Knees', sets: 2, reps: 20 },
              { name: 'A-Skips', sets: 2, duration: '30s' },
            ],
          }],
        }],
      }],
    }
    usePlanStore.setState({ plans: { 'plan-1': planWithDrills } })
    const newId = getState().duplicatePlan('plan-1')

    const origDrills = getState().plans['plan-1'].days[0].slots[0].segments![0].drills!
    const copyDrills = getState().plans[newId].days[0].slots[0].segments![0].drills!

    // The drills arrays must be different objects
    expect(origDrills).not.toBe(copyDrills)
    // Each DrillSpec must also be a distinct clone
    expect(origDrills[0]).not.toBe(copyDrills[0])
    // Content must be equal
    expect(copyDrills).toEqual(origDrills)
  })

  it('deep-clones SetSpec[] within warmup exercises', () => {
    const planWithWarmupSets: Plan = {
      ...makePlan('plan-1'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'weights',
          name: 'Weights',
          warmup: [{
            exercise: 'Warmup Row',
            sets: [
              { reps: 10, load: 'bodyweight' },
            ],
          }],
        }],
      }],
    }
    usePlanStore.setState({ plans: { 'plan-1': planWithWarmupSets } })
    const newId = getState().duplicatePlan('plan-1')

    const origWarmupSets = (getState().plans['plan-1'].days[0].slots[0].warmup as import('../../types/program').ExerciseSpec[])[0].sets as import('../../types/program').SetSpec[]
    const copyWarmupSets = (getState().plans[newId].days[0].slots[0].warmup as import('../../types/program').ExerciseSpec[])[0].sets as import('../../types/program').SetSpec[]

    expect(origWarmupSets).not.toBe(copyWarmupSets)
    expect(origWarmupSets[0]).not.toBe(copyWarmupSets[0])
    expect(copyWarmupSets).toEqual(origWarmupSets)
  })

  it('strips existing "(copy)" suffix before appending, avoiding accumulation', () => {
    // Source is "My Plan (copy)"; "(copy)" is already taken so copy is "(copy 2)".
    // The key guarantee: it is NOT "My Plan (copy) (copy)".
    const plan: Plan = { ...makePlan('plan-1'), name: 'My Plan (copy)' }
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    const newId = getState().duplicatePlan('plan-1')
    expect(getState().plans[newId].name).toBe('My Plan (copy 2)')
    expect(getState().plans[newId].name).not.toContain('(copy) (copy)')
  })

  it('uses a numeric counter "(copy 2)" when "(copy)" name is already taken', () => {
    const plan: Plan = { ...makePlan('plan-1'), name: 'My Plan' }
    const existing: Plan = { ...makePlan('plan-2'), name: 'My Plan (copy)' }
    usePlanStore.setState({ plans: { 'plan-1': plan, 'plan-2': existing } })
    const newId = getState().duplicatePlan('plan-1')
    expect(getState().plans[newId].name).toBe('My Plan (copy 2)')
  })

  it('strips "(copy N)" suffix before appending to avoid further accumulation', () => {
    const plan: Plan = { ...makePlan('plan-1'), name: 'Workout A (copy 3)' }
    usePlanStore.setState({ plans: { 'plan-1': plan } })
    const newId = getState().duplicatePlan('plan-1')
    // Base is "Workout A"; first available copy name is "Workout A (copy)"
    expect(getState().plans[newId].name).toBe('Workout A (copy)')
  })
})
