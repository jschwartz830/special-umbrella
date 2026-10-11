import { describe, it, expect } from 'vitest'
import { watchLandscapeAutoFocus } from '../useLandscapeAutoFocus'

function setup(initialLandscape: boolean, initialFocus = false) {
  let cb: ((e: { matches: boolean }) => void) | null = null
  const mql = {
    matches: initialLandscape,
    addEventListener: (_: 'change', fn: (e: { matches: boolean }) => void) => { cb = fn },
    removeEventListener: () => { cb = null },
  }
  const state = { focusMode: initialFocus }
  const cleanup = watchLandscapeAutoFocus(mql, {
    getFocusMode: () => state.focusMode,
    setFocusMode: v => { state.focusMode = v },
  })
  const rotate = (landscape: boolean) => cb?.({ matches: landscape })
  return { state, rotate, cleanup }
}

describe('watchLandscapeAutoFocus', () => {
  it('enters focus mode on rotate to landscape and leaves it on rotate back', () => {
    const { state, rotate } = setup(false)
    rotate(true)
    expect(state.focusMode).toBe(true)
    rotate(false)
    expect(state.focusMode).toBe(false)
  })

  it('enters focus mode immediately when opened in landscape', () => {
    const { state } = setup(true)
    expect(state.focusMode).toBe(true)
  })

  it('leaves a user-chosen focus mode alone when rotating back to portrait', () => {
    const { state, rotate } = setup(false, true)
    rotate(true)
    rotate(false)
    expect(state.focusMode).toBe(true)
  })

  it('re-enters focus mode on the next rotation after a manual exit', () => {
    const { state, rotate } = setup(false)
    rotate(true)
    state.focusMode = false // user taps "exit focus" while sideways
    rotate(false)
    expect(state.focusMode).toBe(false)
    rotate(true)
    expect(state.focusMode).toBe(true)
  })

  it('cleanup undoes an automatic switch so the saved preference is unchanged', () => {
    const { state, cleanup } = setup(true)
    cleanup()
    expect(state.focusMode).toBe(false)
  })
})
