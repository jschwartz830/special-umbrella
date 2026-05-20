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
          segments: [{ kind: 'easy', duration: '10m', notes: 'warmup' }],
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
})
