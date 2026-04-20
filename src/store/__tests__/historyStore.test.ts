/**
 * Tests for historyStore business logic.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock zustand/middleware before any store imports so the store
// initialises without persistence.
vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useHistoryStore } from '../historyStore'
import type { HistoryEntry, OverrideEntry } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(
  calendarDate: string,
  action: 'complete' | 'skip' | 'day_off',
  opts: Partial<HistoryEntry> = {},
): Omit<HistoryEntry, 'id' | 'createdAt'> {
  return {
    planId: 'plan-1',
    calendarDate,
    planDayIndex: action === 'day_off' ? undefined : 0,
    action,
    ...opts,
  }
}

function makeOverride(
  appliedAt: string,
  type: OverrideEntry['type'],
  opts: Partial<OverrideEntry> = {},
): Omit<OverrideEntry, 'id' | 'appliedAt'> & { appliedAt?: string } {
  return {
    planId: 'plan-1',
    type,
    appliedAt,
    ...opts,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getState() {
  return useHistoryStore.getState()
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  useHistoryStore.setState({ entries: [], overrides: [], extraEntries: [] })
})

// ── addEntry ──────────────────────────────────────────────────────────────────

describe('addEntry', () => {
  it('adds an entry to an empty store', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    expect(getState().entries).toHaveLength(1)
    expect(getState().entries[0].action).toBe('complete')
    expect(getState().entries[0].calendarDate).toBe('2026-01-01')
  })

  it('assigns a unique id and createdAt timestamp', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    const e = getState().entries[0]
    expect(typeof e.id).toBe('string')
    expect(e.id.length).toBeGreaterThan(0)
    expect(typeof e.createdAt).toBe('string')
  })

  it('deduplicates: a second entry for the same (planId, calendarDate) replaces the first', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 0 }))
    getState().addEntry(makeEntry('2026-01-01', 'skip', { planDayIndex: 0 }))
    const entries = getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].action).toBe('skip')
  })

  it('keeps entries for different calendar dates', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    getState().addEntry(makeEntry('2026-01-02', 'skip'))
    expect(getState().entries).toHaveLength(2)
  })

  it('keeps entries for different plans on the same date', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-a' }))
    getState().addEntry(makeEntry('2026-01-01', 'skip', { planId: 'plan-b' }))
    expect(getState().entries).toHaveLength(2)
  })
})

// ── logAction ─────────────────────────────────────────────────────────────────

describe('logAction', () => {
  it('stores planDayIndex for complete entries', () => {
    getState().logAction('plan-1', '2026-01-01', 2, 'complete')
    expect(getState().entries[0].planDayIndex).toBe(2)
  })

  it('stores planDayIndex for skip entries', () => {
    getState().logAction('plan-1', '2026-01-01', 3, 'skip')
    expect(getState().entries[0].planDayIndex).toBe(3)
  })

  it('stores undefined planDayIndex for day_off entries', () => {
    getState().logAction('plan-1', '2026-01-01', 5, 'day_off')
    expect(getState().entries[0].planDayIndex).toBeUndefined()
  })

  it('stores notes when provided', () => {
    getState().logAction('plan-1', '2026-01-01', 0, 'complete', 'Great session')
    expect(getState().entries[0].notes).toBe('Great session')
  })

  it('stores undefined notes when not provided', () => {
    getState().logAction('plan-1', '2026-01-01', 0, 'complete')
    expect(getState().entries[0].notes).toBeUndefined()
  })
})

// ── updateEntryAction ─────────────────────────────────────────────────────────

describe('updateEntryAction', () => {
  it('changes action from complete to skip', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 1 }))
    const id = getState().entries[0].id
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip')
    const updated = getState().entries.find(e => e.id === id)!
    expect(updated.action).toBe('skip')
  })

  it('preserves existing planDayIndex when changing complete → skip without providing index', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 3 }))
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip')
    expect(getState().entries[0].planDayIndex).toBe(3)
  })

  it('sets planDayIndex to undefined when changing to day_off', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 2 }))
    getState().updateEntryAction('plan-1', '2026-01-01', 'day_off')
    expect(getState().entries[0].planDayIndex).toBeUndefined()
    expect(getState().entries[0].action).toBe('day_off')
  })

  it('restores planDayIndex when changing day_off → complete with provided index', () => {
    // First, create a day_off entry (planDayIndex=undefined)
    getState().addEntry(makeEntry('2026-01-01', 'day_off'))
    expect(getState().entries[0].planDayIndex).toBeUndefined()

    // Change to complete and provide the planDayIndex
    getState().updateEntryAction('plan-1', '2026-01-01', 'complete', 4)
    expect(getState().entries[0].action).toBe('complete')
    expect(getState().entries[0].planDayIndex).toBe(4)
  })

  it('restores planDayIndex when changing day_off → skip with provided index', () => {
    getState().addEntry(makeEntry('2026-01-01', 'day_off'))
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip', 2)
    expect(getState().entries[0].action).toBe('skip')
    expect(getState().entries[0].planDayIndex).toBe(2)
  })

  it('uses provided planDayIndex over existing when explicitly passed', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 1 }))
    getState().updateEntryAction('plan-1', '2026-01-01', 'complete', 7)
    expect(getState().entries[0].planDayIndex).toBe(7)
  })

  it('does not affect entries on different dates', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 0 }))
    getState().addEntry(makeEntry('2026-01-02', 'complete', { planDayIndex: 1 }))
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip')
    expect(getState().entries.find(e => e.calendarDate === '2026-01-02')!.action).toBe('complete')
  })

  it('does not affect entries for different plans', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-1', planDayIndex: 0 }))
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-2', planDayIndex: 0 }))
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip')
    expect(getState().entries.find(e => e.planId === 'plan-2')!.action).toBe('complete')
  })

  it('preserves id and createdAt across an action change', () => {
    // CalendarPage and HistoryPage both rely on the entry identity
    // surviving an outcome-driven action sync (e.g. complete → complete
    // with different completionState). If a future rewrite were to
    // delete-and-reinsert the entry here, any outcome or downstream
    // reference keyed by the entry's id would break.
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 0 }))
    const before = getState().entries[0]
    getState().updateEntryAction('plan-1', '2026-01-01', 'skip')
    const after = getState().entries[0]
    expect(after.id).toBe(before.id)
    expect(after.createdAt).toBe(before.createdAt)
  })
})

// ── removeRetroJumpForDate ────────────────────────────────────────────────────

describe('removeRetroJumpForDate', () => {
  it('removes a jump override whose local date matches calendarDate', () => {
    // Use a mid-day UTC time so the date is the same in all common timezones
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'jump', { targetDayIndex: 2 }))
    expect(getState().overrides).toHaveLength(1)

    getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    expect(getState().overrides).toHaveLength(0)
  })

  it('keeps a jump override whose date does NOT match calendarDate', () => {
    getState().addOverride(makeOverride('2026-01-14T12:00:00.000Z', 'jump', { targetDayIndex: 2 }))
    getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    expect(getState().overrides).toHaveLength(1)
  })

  it('only removes jump type overrides, leaves advance/go_back intact', () => {
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'advance'))
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'go_back'))
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'jump', { targetDayIndex: 1 }))
    expect(getState().overrides).toHaveLength(3)

    getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    expect(getState().overrides).toHaveLength(2)
    expect(getState().overrides.every(o => o.type !== 'jump')).toBe(true)
  })

  it('only removes overrides for the matching planId', () => {
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'jump', { planId: 'plan-1', targetDayIndex: 0 }))
    getState().addOverride(makeOverride('2026-01-15T12:00:00.000Z', 'jump', { planId: 'plan-2', targetDayIndex: 0 }))
    getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    expect(getState().overrides).toHaveLength(1)
    expect(getState().overrides[0].planId).toBe('plan-2')
  })

  it('removes all jump overrides for the same date (not just the first)', () => {
    getState().addOverride(makeOverride('2026-01-15T10:00:00.000Z', 'jump', { targetDayIndex: 1 }))
    getState().addOverride(makeOverride('2026-01-15T14:00:00.000Z', 'jump', { targetDayIndex: 2 }))
    getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    expect(getState().overrides).toHaveLength(0)
  })

  it('is a no-op when there are no overrides', () => {
    expect(() => {
      getState().removeRetroJumpForDate('plan-1', '2026-01-15')
    }).not.toThrow()
    expect(getState().overrides).toHaveLength(0)
  })
})

// ── removeEntry ───────────────────────────────────────────────────────────────

describe('removeEntry', () => {
  it('removes the entry matching (planId, calendarDate)', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    getState().addEntry(makeEntry('2026-01-02', 'skip'))
    getState().removeEntry('plan-1', '2026-01-01')
    expect(getState().entries).toHaveLength(1)
    expect(getState().entries[0].calendarDate).toBe('2026-01-02')
  })

  it('does not remove entries for different plans', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-1' }))
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-2' }))
    getState().removeEntry('plan-1', '2026-01-01')
    expect(getState().entries).toHaveLength(1)
    expect(getState().entries[0].planId).toBe('plan-2')
  })
})

// ── clearPlanHistory ──────────────────────────────────────────────────────────

describe('clearPlanHistory', () => {
  it('removes all entries and overrides for a plan', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-1' }))
    getState().addEntry(makeEntry('2026-01-02', 'skip', { planId: 'plan-1' }))
    getState().addOverride(makeOverride('2026-01-01T12:00:00Z', 'advance', { planId: 'plan-1' }))
    getState().clearPlanHistory('plan-1')
    expect(getState().entries).toHaveLength(0)
    expect(getState().overrides).toHaveLength(0)
  })

  it('keeps history for other plans intact', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-1' }))
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planId: 'plan-2' }))
    getState().addOverride(makeOverride('2026-01-01T12:00:00Z', 'advance', { planId: 'plan-1' }))
    getState().addOverride(makeOverride('2026-01-01T12:00:00Z', 'advance', { planId: 'plan-2' }))
    getState().clearPlanHistory('plan-1')
    expect(getState().entries).toHaveLength(1)
    expect(getState().entries[0].planId).toBe('plan-2')
    expect(getState().overrides).toHaveLength(1)
    expect(getState().overrides[0].planId).toBe('plan-2')
  })
})

// ── extraEntries ──────────────────────────────────────────────────────────────
// These cover the invariants the double-day bonus logging relies on:
//   - A primary HistoryEntry and an ExtraWorkoutEntry on the same
//     (planId, calendarDate) coexist instead of replacing each other.
//   - Multiple ExtraWorkoutEntries on the same date accumulate and each
//     returns a distinct id usable for keying outcomes.

describe('addExtraEntry alongside a primary HistoryEntry', () => {
  it('keeps both records when logged on the same (planId, date)', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 0 }))
    const extraId = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'recovery_run',
      workoutName: 'Bonus Recovery',
    })
    expect(getState().entries).toHaveLength(1)
    expect(getState().entries[0].action).toBe('complete')
    expect(getState().extraEntries).toHaveLength(1)
    expect(getState().extraEntries[0].id).toBe(extraId)
    expect(getState().extraEntries[0].workoutName).toBe('Bonus Recovery')
  })

  it('accumulates multiple extras on the same date with distinct ids', () => {
    const idA = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Morning Yoga',
    })
    const idB = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'swim',
      workoutName: 'Evening Swim',
    })
    expect(idA).not.toBe(idB)
    expect(getState().extraEntries).toHaveLength(2)
  })

  it('removeEntry does not touch extraEntries for the same date', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Bonus',
    })
    getState().removeEntry('plan-1', '2026-01-01')
    expect(getState().entries).toHaveLength(0)
    expect(getState().extraEntries).toHaveLength(1)
  })
})

// ── updateEntryDate ───────────────────────────────────────────────────────────

describe('updateEntryDate', () => {
  it('moves a rotation entry to the new date by id', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    const id = getState().entries[0].id
    getState().updateEntryDate(id, '2026-01-05')
    expect(getState().entries[0].calendarDate).toBe('2026-01-05')
  })

  it('does not affect other entries', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete'))
    getState().addEntry(makeEntry('2026-01-02', 'skip'))
    const firstId = getState().entries.find(e => e.calendarDate === '2026-01-01')!.id
    getState().updateEntryDate(firstId, '2026-01-10')
    expect(getState().entries.find(e => e.id === firstId)!.calendarDate).toBe('2026-01-10')
    expect(getState().entries.find(e => e.calendarDate === '2026-01-02')).toBeTruthy()
  })

  it('preserves all other fields on the moved entry', () => {
    getState().addEntry(makeEntry('2026-01-01', 'complete', { planDayIndex: 3, notes: 'Good run' }))
    const id = getState().entries[0].id
    getState().updateEntryDate(id, '2026-01-07')
    const moved = getState().entries[0]
    expect(moved.action).toBe('complete')
    expect(moved.planDayIndex).toBe(3)
    expect(moved.notes).toBe('Good run')
  })
})

// ── updateExtraEntryDate ──────────────────────────────────────────────────────

describe('updateExtraEntryDate', () => {
  it('moves an extra entry to the new date by id', () => {
    const id = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Yoga',
    })
    getState().updateExtraEntryDate(id, '2026-01-08')
    expect(getState().extraEntries[0].calendarDate).toBe('2026-01-08')
  })

  it('does not affect other extra entries', () => {
    const idA = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Yoga',
    })
    getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-02',
      workoutType: 'swim',
      workoutName: 'Swim',
    })
    getState().updateExtraEntryDate(idA, '2026-01-10')
    expect(getState().extraEntries.find(e => e.id === idA)!.calendarDate).toBe('2026-01-10')
    expect(getState().extraEntries.find(e => e.workoutName === 'Swim')!.calendarDate).toBe('2026-01-02')
  })

  it('preserves all other fields on the moved extra entry', () => {
    const id = getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'long_run',
      workoutName: 'Morning Run',
    })
    getState().updateExtraEntryDate(id, '2026-01-09')
    const moved = getState().extraEntries[0]
    expect(moved.workoutType).toBe('long_run')
    expect(moved.workoutName).toBe('Morning Run')
  })
})

// ── clearExtraEntriesForDate ──────────────────────────────────────────────────

describe('clearExtraEntriesForDate', () => {
  it('removes all extras for the given (planId, calendarDate)', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'yoga', workoutName: 'A' })
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'swim', workoutName: 'B' })
    getState().clearExtraEntriesForDate('plan-1', '2026-01-01')
    expect(getState().extraEntries).toHaveLength(0)
  })

  it('leaves extras on other dates intact', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'yoga', workoutName: 'A' })
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-02', workoutType: 'swim', workoutName: 'B' })
    getState().clearExtraEntriesForDate('plan-1', '2026-01-01')
    expect(getState().extraEntries).toHaveLength(1)
    expect(getState().extraEntries[0].calendarDate).toBe('2026-01-02')
  })

  it('leaves extras for other plans on the same date intact', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'yoga', workoutName: 'A' })
    getState().addExtraEntry({ planId: 'plan-2', calendarDate: '2026-01-01', workoutType: 'swim', workoutName: 'B' })
    getState().clearExtraEntriesForDate('plan-1', '2026-01-01')
    expect(getState().extraEntries).toHaveLength(1)
    expect(getState().extraEntries[0].planId).toBe('plan-2')
  })

  it('is a no-op when there are no extras for the date', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-02', workoutType: 'yoga', workoutName: 'A' })
    getState().clearExtraEntriesForDate('plan-1', '2026-01-01')
    expect(getState().extraEntries).toHaveLength(1)
  })
})

// ── ExtraWorkoutEntry.source ──────────────────────────────────────────────────
// The source field lets callers tag each extra as user-initiated ('history')
// or part of the double-day flow ('double_day'). TodayPage Undo removes
// only extras where source !== 'history'.

describe('ExtraWorkoutEntry.source field', () => {
  it('persists source: double_day when provided', () => {
    getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'recovery_run',
      workoutName: 'Bonus',
      source: 'double_day',
    })
    expect(getState().extraEntries[0].source).toBe('double_day')
  })

  it('persists source: history when provided', () => {
    getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Manual',
      source: 'history',
    })
    expect(getState().extraEntries[0].source).toBe('history')
  })

  it('source is undefined when not provided (old-record shape)', () => {
    getState().addExtraEntry({
      planId: 'plan-1',
      calendarDate: '2026-01-01',
      workoutType: 'yoga',
      workoutName: 'Legacy',
    })
    expect(getState().extraEntries[0].source).toBeUndefined()
  })

  it('Undo logic: removes double_day and legacy (undefined) extras, keeps history extras', () => {
    // Simulate mixed extras for the same plan+date
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'recovery_run', workoutName: 'BonusRun', source: 'double_day' })
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'yoga', workoutName: 'ManualYoga', source: 'history' })
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'swim', workoutName: 'LegacySwim' })

    // Simulate what TodayPage Undo does: remove extras where source !== 'history'
    const toRemove = getState().extraEntries.filter(
      ex => ex.planId === 'plan-1' && ex.calendarDate === '2026-01-01' && ex.source !== 'history',
    )
    for (const ex of toRemove) {
      getState().removeExtraEntry(ex.id)
    }

    expect(getState().extraEntries).toHaveLength(1)
    expect(getState().extraEntries[0].workoutName).toBe('ManualYoga')
    expect(getState().extraEntries[0].source).toBe('history')
  })

  it('Undo logic: removes all extras when all are double_day', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'recovery_run', workoutName: 'Bonus', source: 'double_day' })

    const toRemove = getState().extraEntries.filter(
      ex => ex.planId === 'plan-1' && ex.calendarDate === '2026-01-01' && ex.source !== 'history',
    )
    for (const ex of toRemove) getState().removeExtraEntry(ex.id)

    expect(getState().extraEntries).toHaveLength(0)
  })

  it('Undo logic: leaves all extras when all are history', () => {
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'yoga', workoutName: 'ManualA', source: 'history' })
    getState().addExtraEntry({ planId: 'plan-1', calendarDate: '2026-01-01', workoutType: 'swim', workoutName: 'ManualB', source: 'history' })

    const toRemove = getState().extraEntries.filter(
      ex => ex.planId === 'plan-1' && ex.calendarDate === '2026-01-01' && ex.source !== 'history',
    )
    for (const ex of toRemove) getState().removeExtraEntry(ex.id)

    expect(getState().extraEntries).toHaveLength(2)
  })
})
