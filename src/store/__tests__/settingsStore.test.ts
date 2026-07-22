import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useSettingsStore } from '../settingsStore'

function resetStore() {
  useSettingsStore.setState({
    startDelaySeconds: 0,
    autoAdvanceSegments: true,
    focusMode: false,
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
})
