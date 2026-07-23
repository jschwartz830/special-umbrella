/**
 * Tests for useStallNudgeDismiss — the per-plan localStorage-backed dismissal
 * hook for the stalled-rotation nudge banner.
 *
 * No @testing-library/react in this environment; we validate the localStorage
 * contract directly (same approach as useDismissableBanner.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    get length() { return Object.keys(store).length },
    key: (n: number) => Object.keys(store)[n] ?? null,
  }
}

// ── Key contract helpers (mirror hook internals) ─────────────────────────────

const STALL_PREFIX = 'wpt_stall_nudge_dismissed_v1_'

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeDismissed(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch { /* degrade gracefully */ }
}

function clearDismissed(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* degrade gracefully */ }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useStallNudgeDismiss localStorage contract', () => {
  beforeEach(() => {
    const storage = makeLocalStorageMock()
    vi.stubGlobal('localStorage', storage)
  })

  it('is not dismissed by default (key absent)', () => {
    expect(readDismissed(STALL_PREFIX + 'plan-1')).toBe(false)
  })

  it('writeDismissed sets key to "1"', () => {
    writeDismissed(STALL_PREFIX + 'plan-1')
    expect(localStorage.getItem(STALL_PREFIX + 'plan-1')).toBe('1')
  })

  it('readDismissed returns true after write', () => {
    writeDismissed(STALL_PREFIX + 'plan-1')
    expect(readDismissed(STALL_PREFIX + 'plan-1')).toBe(true)
  })

  it('clearDismissed removes the key', () => {
    writeDismissed(STALL_PREFIX + 'plan-1')
    clearDismissed(STALL_PREFIX + 'plan-1')
    expect(readDismissed(STALL_PREFIX + 'plan-1')).toBe(false)
  })

  it('is isolated per plan — dismissing plan-1 does not affect plan-2', () => {
    writeDismissed(STALL_PREFIX + 'plan-1')
    expect(readDismissed(STALL_PREFIX + 'plan-2')).toBe(false)
  })

  it('null planId produces no localStorage write', () => {
    const planId: string | null = null
    const key = planId ? STALL_PREFIX + planId : null
    if (key) writeDismissed(key)
    expect(localStorage.length).toBe(0)
  })

  it('prefix is distinct from the expiry-banner prefix', () => {
    const EXPIRY_PREFIX = 'wpt_expiry_dismissed_v1_'
    expect(STALL_PREFIX).not.toBe(EXPIRY_PREFIX)
    writeDismissed(STALL_PREFIX + 'plan-x')
    expect(readDismissed(EXPIRY_PREFIX + 'plan-x')).toBe(false)
  })

  it('prefix is distinct from the streak-milestone prefix', () => {
    const STREAK_PREFIX = 'wpt_streak_ms_v1_'
    writeDismissed(STALL_PREFIX + 'plan-x')
    expect(readDismissed(STREAK_PREFIX + 'plan-x_7')).toBe(false)
  })

  it('localStorage read failure degrades to false', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => {},
    })
    expect(readDismissed(STALL_PREFIX + 'plan-1')).toBe(false)
  })

  it('localStorage write failure does not throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError') },
    })
    expect(() => writeDismissed(STALL_PREFIX + 'plan-1')).not.toThrow()
  })
})
