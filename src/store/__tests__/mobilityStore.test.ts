/**
 * Tests for mobilityStore business logic.
 * Covers: addExercise, removeExercise, reorderExercise, logCompletion,
 * removeCompletion, and the default routine.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useMobilityStore } from '../mobilityStore'
import type { MobilityCompletion } from '../mobilityStore'

function resetStore() {
  useMobilityStore.setState({
    routine: useMobilityStore.getInitialState?.().routine ??
      [
        { id: 'hip-90-90',       name: 'Hip 90/90',                  durationSec: 60 },
        { id: 'worlds-greatest', name: "World's Greatest Stretch",    durationSec: 60 },
        { id: 'cat-cow',         name: 'Cat-Cow',                    durationSec: 60 },
        { id: 'thread-needle',   name: 'Thread the Needle',          durationSec: 45 },
        { id: 'pigeon-pose',     name: 'Pigeon Pose',                durationSec: 60 },
        { id: 'shoulder-cars',   name: 'Shoulder CARs',              durationSec: 30 },
        { id: 'ankle-circles',   name: 'Ankle Circles',              durationSec: 30 },
      ],
    completions: {},
  })
}

describe('default routine', () => {
  it('starts with 7 exercises', () => {
    resetStore()
    expect(useMobilityStore.getState().routine).toHaveLength(7)
  })

  it('starts with no completions', () => {
    resetStore()
    expect(useMobilityStore.getState().completions).toEqual({})
  })
})

describe('addExercise', () => {
  beforeEach(resetStore)

  it('appends a new exercise to the routine', () => {
    useMobilityStore.getState().addExercise('Dead Hang', 30)
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.name).toBe('Dead Hang')
    expect(added.durationSec).toBe(30)
  })

  it('generates a unique id for the new exercise', () => {
    useMobilityStore.getState().addExercise('A', 10)
    useMobilityStore.getState().addExercise('B', 20)
    const { routine } = useMobilityStore.getState()
    const last2 = routine.slice(-2)
    expect(last2[0].id).toBeTruthy()
    expect(last2[1].id).toBeTruthy()
    expect(last2[0].id).not.toBe(last2[1].id)
  })

  it('increments the routine length by 1', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().addExercise('Nordic Curl', 45)
    expect(useMobilityStore.getState().routine).toHaveLength(before + 1)
  })
})

describe('removeExercise', () => {
  beforeEach(resetStore)

  it('removes the exercise with the matching id', () => {
    const { routine } = useMobilityStore.getState()
    const target = routine[0]
    useMobilityStore.getState().removeExercise(target.id)
    const after = useMobilityStore.getState().routine
    expect(after.find(e => e.id === target.id)).toBeUndefined()
  })

  it('decrements routine length by 1', () => {
    const before = useMobilityStore.getState().routine.length
    const id = useMobilityStore.getState().routine[2].id
    useMobilityStore.getState().removeExercise(id)
    expect(useMobilityStore.getState().routine).toHaveLength(before - 1)
  })

  it('is a no-op when the id does not exist', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().removeExercise('nonexistent-id')
    expect(useMobilityStore.getState().routine).toHaveLength(before)
  })

  it('preserves order of remaining exercises', () => {
    const routine = useMobilityStore.getState().routine
    const target = routine[2]
    useMobilityStore.getState().removeExercise(target.id)
    const after = useMobilityStore.getState().routine
    expect(after[0].id).toBe(routine[0].id)
    expect(after[1].id).toBe(routine[1].id)
    expect(after[2].id).toBe(routine[3].id) // index 3 shifts to 2
  })
})

describe('reorderExercise', () => {
  beforeEach(resetStore)

  it('moves an exercise from fromIdx to toIdx', () => {
    const before = useMobilityStore.getState().routine.map(e => e.id)
    useMobilityStore.getState().reorderExercise(0, 2)
    const after = useMobilityStore.getState().routine.map(e => e.id)
    // item at index 0 is now at index 2
    expect(after[2]).toBe(before[0])
    // items that were at 1 and 2 shift left by 1
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[2])
  })

  it('moving to the same index leaves the routine unchanged', () => {
    const before = useMobilityStore.getState().routine.map(e => e.id)
    useMobilityStore.getState().reorderExercise(3, 3)
    const after = useMobilityStore.getState().routine.map(e => e.id)
    expect(after).toEqual(before)
  })

  it('preserves routine length after reorder', () => {
    const len = useMobilityStore.getState().routine.length
    useMobilityStore.getState().reorderExercise(0, len - 1)
    expect(useMobilityStore.getState().routine).toHaveLength(len)
  })
})

describe('logCompletion', () => {
  beforeEach(resetStore)

  const completion: MobilityCompletion = {
    completedAt: '2026-06-28T09:00:00.000Z',
    durationMin: 12,
    completedExerciseIds: ['hip-90-90', 'cat-cow'],
  }

  it('stores the completion keyed by date', () => {
    useMobilityStore.getState().logCompletion('2026-06-28', completion)
    expect(useMobilityStore.getState().completions['2026-06-28']).toEqual(completion)
  })

  it('overwrites an existing completion for the same date', () => {
    useMobilityStore.getState().logCompletion('2026-06-28', completion)
    const updated: MobilityCompletion = { ...completion, durationMin: 15 }
    useMobilityStore.getState().logCompletion('2026-06-28', updated)
    expect(useMobilityStore.getState().completions['2026-06-28'].durationMin).toBe(15)
  })

  it('keeps completions for different dates independent', () => {
    useMobilityStore.getState().logCompletion('2026-06-27', completion)
    useMobilityStore.getState().logCompletion('2026-06-28', { ...completion, durationMin: 8 })
    expect(useMobilityStore.getState().completions['2026-06-27'].durationMin).toBe(12)
    expect(useMobilityStore.getState().completions['2026-06-28'].durationMin).toBe(8)
  })
})

describe('removeCompletion', () => {
  beforeEach(resetStore)

  const completion: MobilityCompletion = {
    completedAt: '2026-06-28T09:00:00.000Z',
    durationMin: 12,
    completedExerciseIds: ['hip-90-90'],
  }

  it('removes the completion for the given date', () => {
    useMobilityStore.getState().logCompletion('2026-06-28', completion)
    useMobilityStore.getState().removeCompletion('2026-06-28')
    expect(useMobilityStore.getState().completions['2026-06-28']).toBeUndefined()
  })

  it('is a no-op when the date has no completion', () => {
    useMobilityStore.getState().logCompletion('2026-06-27', completion)
    useMobilityStore.getState().removeCompletion('2026-06-28') // different date
    expect(useMobilityStore.getState().completions['2026-06-27']).toEqual(completion)
  })

  it('leaves other dates intact after removal', () => {
    useMobilityStore.getState().logCompletion('2026-06-27', completion)
    useMobilityStore.getState().logCompletion('2026-06-28', { ...completion, durationMin: 5 })
    useMobilityStore.getState().removeCompletion('2026-06-28')
    expect(useMobilityStore.getState().completions['2026-06-27']).toEqual(completion)
    expect(useMobilityStore.getState().completions['2026-06-28']).toBeUndefined()
  })
})
