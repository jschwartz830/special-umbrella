import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

vi.mock('../supabase', () => ({
  supabase: { auth: {}, from: () => ({}) },
}))

import { buildBackup, parseBackup, applyBackup, backupFilename, BACKUP_FORMAT } from '../backup'
import { useHistoryStore } from '../../store/historyStore'
import { useSettingsStore } from '../../store/settingsStore'
import { usePlanStore } from '../../store/planStore'

beforeEach(() => {
  useHistoryStore.setState({ entries: [], overrides: [], extraEntries: [] })
  usePlanStore.setState({ plans: {}, activePlanId: null })
})

describe('buildBackup', () => {
  it('includes every synced store and strips functions', () => {
    const b = buildBackup()
    expect(b.format).toBe(BACKUP_FORMAT)
    expect(Object.keys(b.stores).sort()).toEqual([
      'wpt_exercise_history', 'wpt_history', 'wpt_mobility', 'wpt_outcomes',
      'wpt_plans', 'wpt_program_vars', 'wpt_settings',
    ])
    for (const data of Object.values(b.stores)) {
      expect(Object.values(data).some(v => typeof v === 'function')).toBe(false)
    }
  })
})

describe('parseBackup', () => {
  it('round-trips a built backup', () => {
    const b = buildBackup()
    expect(parseBackup(JSON.stringify(b)).stores).toEqual(JSON.parse(JSON.stringify(b.stores)))
  })

  it('rejects non-JSON, foreign JSON, newer versions and empty backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Workout Tracker backup/)
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, stores: {} }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores: { nope: {} } }))).toThrow(/no data/)
  })

  it('drops unknown store names and non-object store data', () => {
    const parsed = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT, version: 1, stores: { wpt_history: { entries: [] }, wpt_plans: null, other: {} },
    }))
    expect(Object.keys(parsed.stores)).toEqual(['wpt_history'])
  })
})

describe('applyBackup', () => {
  it('restores stores in the backup, runs migrations, and leaves others alone', () => {
    usePlanStore.setState({ plans: {}, activePlanId: 'keep-me' })
    const restored = applyBackup(parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      stores: {
        wpt_history: { entries: [], overrides: [], extraEntries: [{ id: 'x1', planId: 'p', calendarDate: '2026-01-01', workoutType: 'run', createdAt: 'x' }] },
        wpt_settings: { startDelaySeconds: 15 },
      },
    })))
    expect(restored.sort()).toEqual(['wpt_history', 'wpt_settings'])
    // migrateHistoryState backfills source; migrateSettingsState backfills weekStartsOn.
    expect(useHistoryStore.getState().extraEntries[0].source).toBe('history')
    expect(useSettingsStore.getState().startDelaySeconds).toBe(15)
    expect(useSettingsStore.getState().weekStartsOn).toBe(0)
    expect(usePlanStore.getState().activePlanId).toBe('keep-me')
  })
})

describe('backupFilename', () => {
  it('uses the local date', () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe('workout-tracker-backup-2026-01-05.json')
  })
})
