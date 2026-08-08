/**
 * Tests for mobilityStore business logic.
 * Covers: addExercise, removeExercise, reorderExercise, updateExercise,
 * addSet/updateSet/removeSet, logCompletion, removeCompletion, default
 * routine, addExerciseFromLibrary, loadPreset, startSession, saveCheckpoint,
 * clearSession, and the v2->v3 migration to the sets-based model.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage. This also bypasses the
 * v1->v2 migration, which adds { activeSession: null } to persisted state.
 * The migration itself is a trivial one-liner and is not separately tested here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { singleTimedSet } from '../../lib/mobilityLibrary'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useMobilityStore, migrateMobilityState } from '../mobilityStore'
import type { MobilityCompletion, MobilitySessionCheckpoint } from '../mobilityStore'

const DEFAULT_ROUTINE = [
  { id: 'hip-90-90',       name: 'Hip 90/90',                  sets: singleTimedSet(60) },
  { id: 'worlds-greatest', name: "World's Greatest Stretch",    sets: singleTimedSet(60) },
  { id: 'cat-cow',         name: 'Cat-Cow',                    sets: singleTimedSet(60) },
  { id: 'thread-needle',   name: 'Thread the Needle',          sets: singleTimedSet(45) },
  { id: 'pigeon-pose',     name: 'Pigeon Pose',                sets: singleTimedSet(60) },
  { id: 'shoulder-cars',   name: 'Shoulder CARs',              sets: singleTimedSet(30) },
  { id: 'ankle-circles',   name: 'Ankle Circles',              sets: singleTimedSet(30) },
]

function resetStore() {
  useMobilityStore.setState({
    routine: DEFAULT_ROUTINE,
    completions: {},
    activeSession: null,
    customTemplates: [],
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
    useMobilityStore.getState().addExercise('Dead Hang', singleTimedSet(30))
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.name).toBe('Dead Hang')
    expect(added.sets[0].durationSec).toBe(30)
  })

  it('defaults to a single 30s timed set when no sets are given', () => {
    useMobilityStore.getState().addExercise('Dead Hang')
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.sets).toEqual([{ durationSec: 30 }])
  })

  it('generates a unique id for the new exercise', () => {
    useMobilityStore.getState().addExercise('A', singleTimedSet(10))
    useMobilityStore.getState().addExercise('B', singleTimedSet(20))
    const { routine } = useMobilityStore.getState()
    const last2 = routine.slice(-2)
    expect(last2[0].id).toBeTruthy()
    expect(last2[1].id).toBeTruthy()
    expect(last2[0].id).not.toBe(last2[1].id)
  })

  it('increments the routine length by 1', () => {
    const before = useMobilityStore.getState().routine.length
    useMobilityStore.getState().addExercise('Nordic Curl', singleTimedSet(45))
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

describe('updateExercise', () => {
  beforeEach(resetStore)

  it('patches name/restSec/notes for the matching exercise', () => {
    const id = useMobilityStore.getState().routine[0].id
    useMobilityStore.getState().updateExercise(id, { name: 'Renamed', restSec: 15, notes: 'go slow' })
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.name).toBe('Renamed')
    expect(ex.restSec).toBe(15)
    expect(ex.notes).toBe('go slow')
  })

  it('leaves other exercises untouched', () => {
    const [first, second] = useMobilityStore.getState().routine
    useMobilityStore.getState().updateExercise(first.id, { name: 'Changed' })
    const after = useMobilityStore.getState().routine.find(e => e.id === second.id)!
    expect(after.name).toBe(second.name)
  })
})

describe('addSet / updateSet / removeSet', () => {
  beforeEach(resetStore)

  it('addSet duplicates the last set by default', () => {
    const id = useMobilityStore.getState().routine[0].id // Hip 90/90, sets: [{durationSec:60}]
    useMobilityStore.getState().addSet(id)
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.sets).toEqual([{ durationSec: 60 }, { durationSec: 60 }])
  })

  it('addSet uses the provided set when given', () => {
    const id = useMobilityStore.getState().routine[0].id
    useMobilityStore.getState().addSet(id, { reps: 10 })
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.sets[1]).toEqual({ reps: 10 })
  })

  it('updateSet replaces the set at the given index', () => {
    const id = useMobilityStore.getState().routine[0].id
    useMobilityStore.getState().updateSet(id, 0, { reps: 12 })
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.sets[0]).toEqual({ reps: 12 })
  })

  it('removeSet removes the set at the given index', () => {
    const id = useMobilityStore.getState().routine[0].id
    useMobilityStore.getState().addSet(id, { reps: 8 })
    useMobilityStore.getState().removeSet(id, 0)
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.sets).toEqual([{ reps: 8 }])
  })

  it('removeSet is a no-op when only one set remains', () => {
    const id = useMobilityStore.getState().routine[0].id
    useMobilityStore.getState().removeSet(id, 0)
    const ex = useMobilityStore.getState().routine.find(e => e.id === id)!
    expect(ex.sets).toHaveLength(1)
  })

  it('normalizes a legacy duration before editing or adding sets', () => {
    useMobilityStore.setState({
      routine: [{ id: 'legacy', name: 'Legacy Hold', durationSec: 75 } as never],
    })
    useMobilityStore.getState().updateSet('legacy', 0, { reps: 12 })
    useMobilityStore.getState().addSet('legacy')
    expect(useMobilityStore.getState().routine[0].sets).toEqual([{ reps: 12 }, { reps: 12 }])
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

  it('uses the library durationSec as a single timed set', () => {
    useMobilityStore.getState().addExerciseFromLibrary('lib-wall-slides')
    const { routine } = useMobilityStore.getState()
    const added = routine[routine.length - 1]
    expect(added.sets).toEqual([{ durationSec: 45 }])
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
    expect(ex.sets).toEqual([{ durationSec: 90 }]) // preset value, not library's 60
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
    expect(ex.sets).toEqual([{ durationSec: 30 }])
  })
})

// ── saveAsTemplate / renameTemplate / deleteTemplate / loadTemplate ──────────

describe('saveAsTemplate', () => {
  beforeEach(resetStore)

  it('appends a new template with the given name and a deep-cloned exercise list', () => {
    const exercises = [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }]
    useMobilityStore.getState().saveAsTemplate('Morning Routine', exercises)
    const { customTemplates } = useMobilityStore.getState()
    expect(customTemplates).toHaveLength(1)
    expect(customTemplates[0].name).toBe('Morning Routine')
    expect(customTemplates[0].exercises).toEqual(exercises)
    expect(customTemplates[0].exercises).not.toBe(exercises) // deep clone, not shared reference
  })

  it('trims the template name', () => {
    useMobilityStore.getState().saveAsTemplate('  Evening  ', [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }])
    expect(useMobilityStore.getState().customTemplates[0].name).toBe('Evening')
  })

  it('generates a unique id and createdAt timestamp', () => {
    const exercises = [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }]
    useMobilityStore.getState().saveAsTemplate('One', exercises)
    useMobilityStore.getState().saveAsTemplate('Two', exercises)
    const [first, second] = useMobilityStore.getState().customTemplates
    expect(first.id).toBeTruthy()
    expect(second.id).toBeTruthy()
    expect(first.id).not.toBe(second.id)
    expect(first.createdAt).toBeTruthy()
  })

  it('is a no-op for a blank name', () => {
    useMobilityStore.getState().saveAsTemplate('   ', [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }])
    expect(useMobilityStore.getState().customTemplates).toHaveLength(0)
  })

  it('is a no-op for an empty exercise list', () => {
    useMobilityStore.getState().saveAsTemplate('Empty', [])
    expect(useMobilityStore.getState().customTemplates).toHaveLength(0)
  })

  it('mutating the source exercises array after saving does not affect the stored template', () => {
    const exercises = [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }]
    useMobilityStore.getState().saveAsTemplate('Stable', exercises)
    exercises[0].sets[0].durationSec = 999
    expect(useMobilityStore.getState().customTemplates[0].exercises[0].sets[0].durationSec).toBe(30)
  })

  it('saves a legacy routine after normalizing its duration to a timed set', () => {
    useMobilityStore.getState().saveAsTemplate('Legacy', [
      { id: 'legacy', name: 'Legacy Hold', durationSec: 45 } as never,
    ])
    expect(useMobilityStore.getState().customTemplates[0].exercises[0].sets).toEqual([{ durationSec: 45 }])
  })
})

describe('renameTemplate', () => {
  beforeEach(() => {
    resetStore()
    useMobilityStore.getState().saveAsTemplate('Original', [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }])
  })

  it('renames the matching template', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().renameTemplate(id, 'Renamed')
    expect(useMobilityStore.getState().customTemplates[0].name).toBe('Renamed')
  })

  it('trims the new name', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().renameTemplate(id, '  Trimmed  ')
    expect(useMobilityStore.getState().customTemplates[0].name).toBe('Trimmed')
  })

  it('is a no-op for a blank name', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().renameTemplate(id, '   ')
    expect(useMobilityStore.getState().customTemplates[0].name).toBe('Original')
  })

  it('is a no-op for an unknown id', () => {
    useMobilityStore.getState().renameTemplate('nonexistent', 'Renamed')
    expect(useMobilityStore.getState().customTemplates[0].name).toBe('Original')
  })
})

describe('deleteTemplate', () => {
  beforeEach(() => {
    resetStore()
    useMobilityStore.getState().saveAsTemplate('First', [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }])
    useMobilityStore.getState().saveAsTemplate('Second', [{ id: 'b', name: 'B', sets: [{ durationSec: 30 }] }])
  })

  it('removes the matching template', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().deleteTemplate(id)
    const { customTemplates } = useMobilityStore.getState()
    expect(customTemplates).toHaveLength(1)
    expect(customTemplates[0].name).toBe('Second')
  })

  it('is a no-op for an unknown id', () => {
    const before = useMobilityStore.getState().customTemplates.length
    useMobilityStore.getState().deleteTemplate('nonexistent')
    expect(useMobilityStore.getState().customTemplates).toHaveLength(before)
  })
})

describe('loadTemplate', () => {
  beforeEach(() => {
    resetStore()
    useMobilityStore.getState().saveAsTemplate('Template A', [
      { id: 'hip-90-90', name: 'Hip 90/90 Custom', sets: [{ reps: 12 }] },
      { id: 'new-ex', name: 'New Exercise', sets: [{ durationSec: 40 }] },
    ])
  })

  it('replace mode replaces the entire routine with the template exercises', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().loadTemplate(id, 'replace')
    const { routine } = useMobilityStore.getState()
    expect(routine).toHaveLength(2)
    expect(routine[0]).toEqual({ id: 'hip-90-90', name: 'Hip 90/90 Custom', sets: [{ reps: 12 }] })
    expect(routine[1]).toEqual({ id: 'new-ex', name: 'New Exercise', sets: [{ durationSec: 40 }] })
  })

  it('append mode adds exercises not already in the routine', () => {
    const before = useMobilityStore.getState().routine.length
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().loadTemplate(id, 'append')
    // 'hip-90-90' already exists in DEFAULT_ROUTINE, so only 'new-ex' is added
    expect(useMobilityStore.getState().routine).toHaveLength(before + 1)
    expect(useMobilityStore.getState().routine.find(e => e.id === 'new-ex')).toBeTruthy()
  })

  it('append mode does not overwrite an existing exercise with the same id', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().loadTemplate(id, 'append')
    const hip = useMobilityStore.getState().routine.find(e => e.id === 'hip-90-90')!
    expect(hip.name).toBe('Hip 90/90') // original DEFAULT_ROUTINE name, not the template's override
  })

  it('is a no-op for an unknown template id', () => {
    const before = useMobilityStore.getState().routine
    useMobilityStore.getState().loadTemplate('nonexistent', 'replace')
    expect(useMobilityStore.getState().routine).toBe(before)
  })

  it('loading the same template twice in replace mode is idempotent', () => {
    const id = useMobilityStore.getState().customTemplates[0].id
    useMobilityStore.getState().loadTemplate(id, 'replace')
    const first = useMobilityStore.getState().routine
    useMobilityStore.getState().loadTemplate(id, 'replace')
    expect(useMobilityStore.getState().routine).toEqual(first)
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

  it('initializes currentIdx and currentSetIdx to 0', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    const s = useMobilityStore.getState().activeSession
    expect(s?.currentIdx).toBe(0)
    expect(s?.currentSetIdx).toBe(0)
  })

  it('initializes completedIds and completedSets to empty', () => {
    useMobilityStore.getState().startSession('2026-07-01', ['hip-90-90'])
    const s = useMobilityStore.getState().activeSession
    expect(s?.completedIds).toEqual([])
    expect(s?.completedSets).toEqual({})
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
    currentSetIdx: 0,
    completedIds: ['hip-90-90'],
    completedSets: { 'hip-90-90': [0] },
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

// ── resumeCompletion ──────────────────────────────────────────────────────────

describe('resumeCompletion', () => {
  beforeEach(resetStore)

  const ids = ['hip-90-90', 'worlds-greatest', 'cat-cow']

  it('seeds an activeSession from the logged completion', () => {
    useMobilityStore.getState().logCompletion('2026-07-01', {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 5,
      completedExerciseIds: ['hip-90-90'],
      completedSets: { 'hip-90-90': [0] },
    })
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    const s = useMobilityStore.getState().activeSession
    expect(s?.date).toBe('2026-07-01')
    expect(s?.completedIds).toEqual(['hip-90-90'])
    expect(s?.completedSets).toEqual({ 'hip-90-90': [0] })
    expect(s?.totalElapsedSec).toBe(300)
  })

  it('positions currentIdx at the first not-yet-completed exercise', () => {
    useMobilityStore.getState().logCompletion('2026-07-01', {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 5,
      completedExerciseIds: ['hip-90-90'],
    })
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    expect(useMobilityStore.getState().activeSession?.currentIdx).toBe(1) // worlds-greatest
  })

  it('lands on the last exercise when every exercise was already completed', () => {
    useMobilityStore.getState().logCompletion('2026-07-01', {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 5,
      completedExerciseIds: ids,
    })
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    expect(useMobilityStore.getState().activeSession?.currentIdx).toBe(ids.length - 1)
  })

  it('is a no-op when there is no completion for the date', () => {
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    expect(useMobilityStore.getState().activeSession).toBeNull()
  })

  it('does not clobber an already-active session for the same date', () => {
    useMobilityStore.getState().logCompletion('2026-07-01', {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 5,
      completedExerciseIds: ['hip-90-90'],
    })
    useMobilityStore.getState().startSession('2026-07-01', ids)
    useMobilityStore.getState().saveCheckpoint({
      date: '2026-07-01',
      exerciseIds: ids,
      currentIdx: 2,
      currentSetIdx: 0,
      completedIds: ['hip-90-90', 'worlds-greatest'],
      completedSets: {},
      totalElapsedSec: 999,
      exElapsedSec: 0,
    })
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    const s = useMobilityStore.getState().activeSession
    expect(s?.currentIdx).toBe(2)
    expect(s?.totalElapsedSec).toBe(999)
  })

  it('leaves the original completion untouched', () => {
    const completion = {
      completedAt: '2026-07-01T08:00:00.000Z',
      durationMin: 5,
      completedExerciseIds: ['hip-90-90'],
    }
    useMobilityStore.getState().logCompletion('2026-07-01', completion)
    useMobilityStore.getState().resumeCompletion('2026-07-01', ids)
    expect(useMobilityStore.getState().completions['2026-07-01']).toEqual(completion)
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

// ── v2 -> v3 migration ──────────────────────────────────────────────────────

describe('migrateMobilityState (v2 -> v3)', () => {
  it('converts legacy durationSec routine items into a single timed set', () => {
    const legacyState = {
      routine: [{ id: 'hip-90-90', name: 'Hip 90/90', durationSec: 60 }],
      completions: {},
      activeSession: null,
    }
    const migrated = migrateMobilityState(legacyState, 2) as { routine: Array<{ sets: Array<{ durationSec?: number }> }> }
    expect(migrated.routine[0].sets).toEqual([{ durationSec: 60 }])
  })

  it('nulls out an in-flight activeSession from before v3', () => {
    const legacyState = {
      routine: [],
      completions: {},
      activeSession: { date: '2026-01-01', exerciseIds: [], currentIdx: 0, completedIds: [], totalElapsedSec: 0, exElapsedSec: 0 },
    }
    const migrated = migrateMobilityState(legacyState, 2) as { activeSession: unknown }
    expect(migrated.activeSession).toBeNull()
  })

  it('preserves already-present sets when re-applying the v2->v3 step', () => {
    const state = {
      routine: [{ id: 'a', name: 'A', sets: [{ reps: 10 }] }],
      completions: {},
      activeSession: null,
    }
    const migrated = migrateMobilityState(state, 2) as { routine: typeof state.routine }
    expect(migrated.routine).toEqual(state.routine)
  })
})

// ── v3 -> v4 migration ──────────────────────────────────────────────────────

describe('migrateMobilityState (v3 -> v4)', () => {
  it('adds an empty customTemplates array when missing', () => {
    const legacyState = {
      routine: DEFAULT_ROUTINE,
      completions: {},
      activeSession: null,
    }
    const migrated = migrateMobilityState(legacyState, 3) as { customTemplates: unknown }
    expect(migrated.customTemplates).toEqual([])
  })

  it('preserves an existing customTemplates array', () => {
    const templates = [{ id: 't1', name: 'Existing', exercises: [], createdAt: '2026-01-01T00:00:00.000Z' }]
    const legacyState = {
      routine: DEFAULT_ROUTINE,
      completions: {},
      activeSession: null,
      customTemplates: templates,
    }
    const migrated = migrateMobilityState(legacyState, 3) as { customTemplates: unknown }
    expect(migrated.customTemplates).toEqual(templates)
  })

  it('leaves an already-migrated (v4) state untouched', () => {
    const state = {
      routine: DEFAULT_ROUTINE,
      completions: {},
      activeSession: null,
      customTemplates: [],
    }
    const migrated = migrateMobilityState(state, 4)
    expect(migrated).toBe(state)
  })
})
