/**
 * Tests for mobilityStore business logic.
 * Covers: addExercise, removeExercise, reorderExercise, logCompletion,
 * removeCompletion, default routine, addExerciseFromLibrary, loadPreset,
 * startSession, saveCheckpoint, clearSession.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage. This also bypasses the
 * v1→v2 migration, which adds { activeSession: null } to persisted state.
 * The migration itself is a trivial one-liner and is not separately tested here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useMobilityStore } from '../mobilityStore'
import type { MobilityCompletion, MobilitySessionCheckpoint } from '../mobilityStore'

const DEFAULT_ROUTINE = [
  { id: 'hip-90-90',       name: 'Hip 90/90',                  durationSec: 60 },
  { id: 'worlds-greatest', name: "World's Greatest Stretch",    durationSec: 60 },
  { id: 'cat-cow',         name: 'Cat-Cow',                    durationSec: 60 },
  { id: 'thread-needle',   name: 'Thread the Needle',          durationSec: 45 },
  { id: 'pigeon-pose',     name: 'Pigeon Pose',                durationSec: 60 },
  { id: 'shoulder-cars',   name: 'Shoulder CARs',              durationSec: 30 },
  { id: 'ankle-circles',   name: 'Ankle Circles',              durationSec: 30 },
]

function resetStore() {
  useMobilityStore.setState({
    routine: DEFAULT_ROUTINE,
    completions: {},
    activeSession: null,
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

// ── addExerciseFromLibrary ────────────────────────────────────────────────────

describe('addExerciseFromLibrary', () => {
  beforeEach(resetStore)

  it('appends a known library exercise by ID', () => {
    useMobilityStore.getState().addExerciseFromLibrary('lib-wall-slides')
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.id).toBe('lib-wall-slides')
    expect(added.name).toBe('Wall Slides')
  })

  it('uses the library durationSec for the added exercise', () => {
    useMobilityStore.getState().addExerciseFromLibrary('lib-wall-slides')
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.durationSec).toBe(45)
  })

  it('increments routine length by 1 for a new exercise', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().addExerciseFromLibrary('lib-ankle-cars')
    expect(useMobilityStore.getState().routine).toHaveLength(before + 1)
  })

  it('is a no-op when the exercise is already in the routine', () => {
    useMobilityStore.getState().addExerciseFromLibrary('lib-wall-slides')
    const afterFirst = useMobilityStore.getState().routine.length
    useMobilityStore.getState().addExerciseFromLibrary('lib-wall-slides')
    expect(useMobilityStore.getState().routine).toHaveLength(afterFirst)
  })

  it('is a no-op for an unknown library ID', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().addExerciseFromLibrary('does-not-exist')
    expect(useMobilityStore.getState().routine).toHaveLength(before)
  })
})

// ── loadPreset ────────────────────────────────────────────────────────────────

describe('loadPreset', () => {
  // Minimal test preset using real library exercise IDs
  const testPreset = {
    id: 'test-preset',
    name: 'Test Preset',
    description: 'For testing',
    durationMin: 2,
    categories: ['general' as const],
    exercises: [
      { exerciseId: 'lib-ankle-cars', durationSec: 90 },  // library default is 60; preset overrides to 90
      { exerciseId: 'lib-hip-9090',   durationSec: 60 },
    ],
  }

  beforeEach(resetStore)

  it('replace mode replaces the entire routine', () => {
    useMobilityStore.getState().loadPreset(testPreset, 'replace')
    expect(useMobilityStore.getState().routine).toHaveLength(2)
    expect(useMobilityStore.getState().routine[0].id).toBe('lib-ankle-cars')
    expect(useMobilityStore.getState().routine[1].id).toBe('lib-hip-9090')
  })

  it('replace mode uses preset durationSec, not library default', () => {
    useMobilityStore.getState().loadPreset(testPreset, 'replace')
    const ex = useMobilityStore.getState().routine[0]
    expect(ex.durationSec).toBe(90)  // preset value, not library's 60
  })

  it('append mode adds exercises not already in the routine', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().loadPreset(testPreset, 'append')
    expect(useMobilityStore.getState().routine).toHaveLength(before + 2)
  })

  it('append mode skips exercises already in the routine', () => {
    useMobilityStore.getState().addExerciseFromLibrary('lib-ankle-cars')
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().loadPreset(testPreset, 'append')
    // Only lib-hip-9090 should be added; lib-ankle-cars already present
    expect(useMobilityStore.getState().routine).toHaveLength(before + 1)
    const ids = useMobilityStore.getState().routine.map(e => e.id)
    expect(ids.filter(id => id === 'lib-ankle-cars')).toHaveLength(1)
  })

  it('falls back to exerciseId as name when ID not in library', () => {
    const unknownPreset = {
      ...testPreset,
      exercises: [{ exerciseId: 'custom-unknown', durationSec: 30 }],
    }
    useMobilityStore.getState().loadPreset(unknownPreset, 'replace')
    const ex = useMobilityStore.getState().routine[0]
    expect(ex.id).toBe('custom-unknown')
    expect(ex.name).toBe('custom-unknown')
    expect(ex.durationSec).toBe(30)
  })
})

// ── startSession ──────────────────────────────────────────────────────────────

describe('startSession', () => {
  beforeEach(resetStore)

  it('creates an activeSession with the given date and exerciseIds', () => {
    const ids = ['hip-90-90', 'cat-cow']
    useMobilityStore.getState().startSession('2026-07-01', ids)
    const s = useMobilityStore.getState().activeSession
    expect(s?.date).toBe('2026-07-01')
    expect(s?.exerciseIds).toEqual(ids)
  })

  it('initializes currentIdx to 0', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    expect(useMobilityStore.getState().activeSession?.currentIdx).toBe(0)
  })

  it('initializes completedIds to an empty array', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    expect(useMobilityStore.getState().activeSession?.completedIds).toEqual([])
  })

  it('initializes totalElapsedSec and exElapsedSec to 0', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    const s = useMobilityStore.getState().activeSession
    expect(s?.totalElapsedSec).toBe(0)
    expect(s?.exElapsedSec).toBe(0)
  })

  it('overwrites any existing activeSession', () => {
    useMobilityStore.getState().startSession('2026-06-30', ['hip-90-90'])
    useMobilityStore.getState().startSession('2026-07-01', ['cat-cow'])
    const s = useMobilityStore.getState().activeSession
    expect(s?.date).toBe('2026-07-01')
    expect(s?.exerciseIds).toEqual(['cat-cow'])
  })
})

// ── saveCheckpoint ────────────────────────────────────────────────────────────

describe('saveCheckpoint', () => {
  beforeEach(resetStore)

  const checkpoint: MobilitySessionCheckpoint = {
    date: '2026-07-01',
    exerciseIds: ['hip-90-90', 'cat-cow', 'pigeon-pose'],
    currentIdx: 1,
    completedIds: ['hip-90-90'],
    totalElapsedSec: 75,
    exElapsedSec: 12.5,
  }

  it('replaces activeSession with the provided checkpoint', () => {
    useMobilityStore.getState().saveCheckpoint(checkpoint)
    expect(useMobilityStore.getState().activeSession).toEqual(checkpoint)
  })

  it('stores all checkpoint fields correctly', () => {
    useMobilityStore.getState().saveCheckpoint(checkpoint)
    const s = useMobilityStore.getState().activeSession!
    expect(s.currentIdx).toBe(1)
    expect(s.completedIds).toEqual(['hip-90-90'])
    expect(s.totalElapsedSec).toBe(75)
    expect(s.exElapsedSec).toBe(12.5)
  })

  it('overwrites a previously saved checkpoint', () => {
    useMobilityStore.getState().saveCheckpoint(checkpoint)
    const updated: MobilitySessionCheckpoint = { ...checkpoint, currentIdx: 2, completedIds: ['hip-90-90', 'cat-cow'] }
    useMobilityStore.getState().saveCheckpoint(updated)
    expect(useMobilityStore.getState().activeSession?.currentIdx).toBe(2)
    expect(useMobilityStore.getState().activeSession?.completedIds).toHaveLength(2)
  })
})

// ── clearSession ──────────────────────────────────────────────────────────────

describe('clearSession', () => {
  beforeEach(resetStore)

  it('sets activeSession to null', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    useMobilityStore.getState().clearSession()
    expect(useMobilityStore.getState().activeSession).toBeNull()
  })

  it('is a no-op when activeSession is already null', () => {
    expect(useMobilityStore.getState().activeSession).toBeNull()
    useMobilityStore.getState().clearSession()
    expect(useMobilityStore.getState().activeSession).toBeNull()
  })

  it('leaves routine and completions intact after clear', () => {
    const completion: MobilityCompletion = {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 10,
      completedExerciseIds: ['hip-90-90'],
    }
    useMobilityStore.getState().logCompletion('2026-07-01', completion)
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    useMobilityStore.getState().clearSession()
    expect(useMobilityStore.getState().routine).toHaveLength(DEFAULT_ROUTINE.length)
    expect(useMobilityStore.getState().completions['2026-07-01']).toEqual(completion)
  })
})
