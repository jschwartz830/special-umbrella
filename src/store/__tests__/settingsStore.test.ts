import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useSettingsStore, migrateSettingsState } from '../settingsStore'

function resetStore() {
  useSettingsStore.setState({
    startDelaySeconds: 0,
    autoAdvanceSegments: true,
    focusMode: false,
    weekStartsOn: 0,
  })
}

describe('settingsStore', () => {
  beforeEach(resetStore)

  describe('default state', () => {
    it('startDelaySeconds defaults to 0', () => {
      expect(useSettingsStore.getState().startDelaySeconds).toBe(0)
    })

    it('autoAdvanceSegments defaults to true', () => {
      expect(useSettingsStore.getState().autoAdvanceSegments).toBe(true)
    })

    it('focusMode defaults to false', () => {
      expect(useSettingsStore.getState().focusMode).toBe(false)
    })
  })

  describe('setStartDelay', () => {
    it('updates startDelaySeconds', () => {
      useSettingsStore.getState().setStartDelay(10)
      expect(useSettingsStore.getState().startDelaySeconds).toBe(10)
    })

    it('accepts 0 (resets to no delay)', () => {
      useSettingsStore.getState().setStartDelay(30)
      useSettingsStore.getState().setStartDelay(0)
      expect(useSettingsStore.getState().startDelaySeconds).toBe(0)
    })

    it('handles large values without clamping', () => {
      useSettingsStore.getState().setStartDelay(300)
      expect(useSettingsStore.getState().startDelaySeconds).toBe(300)
    })

    it('overwrites a previous setting', () => {
      useSettingsStore.getState().setStartDelay(5)
      useSettingsStore.getState().setStartDelay(15)
      expect(useSettingsStore.getState().startDelaySeconds).toBe(15)
    })
  })

  describe('setAutoAdvanceSegments', () => {
    it('disables auto-advance', () => {
      useSettingsStore.getState().setAutoAdvanceSegments(false)
      expect(useSettingsStore.getState().autoAdvanceSegments).toBe(false)
    })

    it('re-enables auto-advance', () => {
      useSettingsStore.getState().setAutoAdvanceSegments(false)
      useSettingsStore.getState().setAutoAdvanceSegments(true)
      expect(useSettingsStore.getState().autoAdvanceSegments).toBe(true)
    })

    it('setting the same value is idempotent', () => {
      useSettingsStore.getState().setAutoAdvanceSegments(true)
      useSettingsStore.getState().setAutoAdvanceSegments(true)
      expect(useSettingsStore.getState().autoAdvanceSegments).toBe(true)
    })
  })

  describe('setFocusMode', () => {
    it('enables focus mode', () => {
      useSettingsStore.getState().setFocusMode(true)
      expect(useSettingsStore.getState().focusMode).toBe(true)
    })

    it('disables focus mode', () => {
      useSettingsStore.getState().setFocusMode(true)
      useSettingsStore.getState().setFocusMode(false)
      expect(useSettingsStore.getState().focusMode).toBe(false)
    })

    it('setting the same value is idempotent', () => {
      useSettingsStore.getState().setFocusMode(false)
      useSettingsStore.getState().setFocusMode(false)
      expect(useSettingsStore.getState().focusMode).toBe(false)
    })
  })

  describe('weekStartsOn', () => {
    it('defaults to 0 (Sunday)', () => {
      expect(useSettingsStore.getState().weekStartsOn).toBe(0)
    })

    it('setWeekStartsOn switches to Monday (1)', () => {
      useSettingsStore.getState().setWeekStartsOn(1)
      expect(useSettingsStore.getState().weekStartsOn).toBe(1)
    })

    it('setWeekStartsOn switches back to Sunday (0)', () => {
      useSettingsStore.getState().setWeekStartsOn(1)
      useSettingsStore.getState().setWeekStartsOn(0)
      expect(useSettingsStore.getState().weekStartsOn).toBe(0)
    })

    it('setting the same value is idempotent', () => {
      useSettingsStore.getState().setWeekStartsOn(1)
      useSettingsStore.getState().setWeekStartsOn(1)
      expect(useSettingsStore.getState().weekStartsOn).toBe(1)
    })
  })
})

// ── migrateSettingsState ──────────────────────────────────────────────────────

describe('migrateSettingsState', () => {
  it('returns correct defaults when persisted state is null', () => {
    const result = migrateSettingsState(null, 0)
    expect(result.startDelaySeconds).toBe(0)
    expect(result.autoAdvanceSegments).toBe(true)
    expect(result.focusMode).toBe(false)
    expect(result.weekStartsOn).toBe(0)
  })

  it('returns correct defaults when persisted state is an empty object', () => {
    const result = migrateSettingsState({}, 0)
    expect(result.startDelaySeconds).toBe(0)
    expect(result.autoAdvanceSegments).toBe(true)
    expect(result.focusMode).toBe(false)
    expect(result.weekStartsOn).toBe(0)
  })

  it('preserves existing settings values', () => {
    const result = migrateSettingsState({
      startDelaySeconds: 10,
      autoAdvanceSegments: false,
      focusMode: true,
      weekStartsOn: 1,
    }, 0)
    expect(result.startDelaySeconds).toBe(10)
    expect(result.autoAdvanceSegments).toBe(false)
    expect(result.focusMode).toBe(true)
    expect(result.weekStartsOn).toBe(1)
  })

  it('backfills weekStartsOn to 0 (Sunday) when missing from persisted state', () => {
    const result = migrateSettingsState({ startDelaySeconds: 5, autoAdvanceSegments: true, focusMode: false }, 0)
    expect(result.weekStartsOn).toBe(0)
  })

  it('backfills focusMode when missing (pre-v1 state without focusMode field)', () => {
    const result = migrateSettingsState({
      startDelaySeconds: 5,
      autoAdvanceSegments: true,
    }, 0)
    expect(result.focusMode).toBe(false)
    expect(result.startDelaySeconds).toBe(5)
  })

  it('backfills autoAdvanceSegments when missing', () => {
    const result = migrateSettingsState({ startDelaySeconds: 0 }, 0)
    expect(result.autoAdvanceSegments).toBe(true)
  })
})
