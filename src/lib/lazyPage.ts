import { lazy, type ComponentType } from 'react'

const RELOAD_FLAG = 'wpt_chunk_reload'

/**
 * React.lazy for a named page export, with one automatic reload if the chunk
 * fails to load. After a deploy, a page still running the old build can ask
 * for chunk files the new service worker has already cleaned up; reloading
 * picks up the new build instead of showing the error screen.
 */
export function lazyPage<T extends Record<string, unknown>, K extends keyof T>(
  load: () => Promise<T>,
  name: K,
) {
  return lazy(async () => {
    try {
      const mod = await load()
      try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* blocked */ }
      return { default: mod[name] as ComponentType<unknown> }
    } catch (err) {
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch { alreadyReloaded = true }
      if (!alreadyReloaded) {
        window.location.reload()
        // Keep Suspense showing its fallback until the reload happens.
        return new Promise<never>(() => {})
      }
      throw err
    }
  })
}
