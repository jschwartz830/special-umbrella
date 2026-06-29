import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useSettingsStore } from '../settingsStore'

function resetStore() {
  useSettingsStore.setState({ startDelaySeconds: 0 })
}

describe('settingsStore', () => {
  beforeEach(resetStore)

  describe('default state', () => {
    it('startDelaySeconds defaults to 0', () => {
      expect(useSettingsStore.getState().startDelaySeconds).toBe(0)
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
})
