import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

/** Phone held sideways — keep in sync with the `ls` screen in tailwind.config.js. */
export const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 500px)'

interface MediaQueryLike {
  matches: boolean
  addEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
  removeEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
}

interface FocusModeAccess {
  getFocusMode: () => boolean
  setFocusMode: (enabled: boolean) => void
}

/**
 * Turning the phone sideways switches into focus mode; turning it back to
 * portrait returns to the detail view — but only if the switch was automatic,
 * so a user who chose focus mode stays in it. Undoes an automatic switch on
 * cleanup so the persisted focusMode preference isn't changed by rotation.
 * Returns the cleanup function.
 */
export function watchLandscapeAutoFocus(mql: MediaQueryLike, focus: FocusModeAccess): () => void {
  let autoEntered = false
  const apply = (landscape: boolean) => {
    if (landscape && !focus.getFocusMode()) {
      autoEntered = true
      focus.setFocusMode(true)
    } else if (!landscape && autoEntered) {
      autoEntered = false
      if (focus.getFocusMode()) focus.setFocusMode(false)
    }
  }
  const onChange = (e: { matches: boolean }) => apply(e.matches)
  apply(mql.matches)
  mql.addEventListener('change', onChange)
  return () => {
    mql.removeEventListener('change', onChange)
    if (autoEntered && focus.getFocusMode()) focus.setFocusMode(false)
  }
}

/** Auto-enter focus mode while the phone is in landscape (active workout only). */
export function useLandscapeAutoFocus() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    return watchLandscapeAutoFocus(window.matchMedia(LANDSCAPE_PHONE_QUERY), {
      getFocusMode: () => useSettingsStore.getState().focusMode,
      setFocusMode: enabled => useSettingsStore.getState().setFocusMode(enabled),
    })
  }, [])
}
