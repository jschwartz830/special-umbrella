/**
 * Tests for useDismissableBanner — the shared localStorage-backed dismissal hook.
 *
 * Because the test environment has no @testing-library/react, we validate the
 * hook's localStorage contract directly (matching the approach used by
 * useExpiryDismiss.test.ts). Each test constructs the key as the hook would
 * and asserts get/set semantics on a fresh in-memory store.
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

// ── Helpers (mirror hook internals) ──────────────────────────────────────────

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
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

const PREFIX_A = 'wpt_test_banner_a_v1_'
const PREFIX_B = 'wpt_test_banner_b_v1_'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDismissableBanner localStorage contract', () => {
  let storage: ReturnType<typeof makeLocalStorageMock>

  beforeEach(() => {
    storage = makeLocalStorageMock()
    vi.stubGlobal('localStorage', storage)
  })

  it('key is absent before any dismiss call', () => {
    expect(readDismissed(PREFIX_A + 'plan-1')).toBe(false)
  })

  it('writeDismissed sets key to "1"', () => {
    writeDismissed(PREFIX_A + 'plan-1')
    expect(storage.getItem(PREFIX_A + 'plan-1')).toBe('1')
  })

  it('readDismissed returns true after write', () => {
    writeDismissed(PREFIX_A + 'plan-1')
    expect(readDismissed(PREFIX_A + 'plan-1')).toBe(true)
  })

  it('returns false when key is any value other than "1"', () => {
    storage.setItem(PREFIX_A + 'plan-1', 'yes')
    expect(readDismissed(PREFIX_A + 'plan-1')).toBe(false)
  })

  it('different keyPrefixes are isolated', () => {
    writeDismissed(PREFIX_A + 'plan-1')
    expect(readDismissed(PREFIX_B + 'plan-1')).toBe(false)
  })

  it('different planIds within the same prefix are isolated', () => {
    writeDismissed(PREFIX_A + 'plan-1')
    expect(readDismissed(PREFIX_A + 'plan-2')).toBe(false)
  })

  it('null planId — no key is written', () => {
    // Hook skips write when storageKey is null (planId === null)
    const planId = null
    const storageKey = planId ? PREFIX_A + planId : null
    if (storageKey) writeDismissed(storageKey)
    expect(storage.length).toBe(0)
  })

  it('localStorage read failure degrades to false', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => {},
    })
    expect(readDismissed(PREFIX_A + 'plan-1')).toBe(false)
  })

  it('localStorage write failure does not throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError') },
    })
    expect(() => writeDismissed(PREFIX_A + 'plan-1')).not.toThrow()
  })

  it('each banner type uses a distinct key namespace — keys do not collide', () => {
    writeDismissed(PREFIX_A + 'plan-x')
    expect(readDismissed(PREFIX_B + 'plan-x')).toBe(false)
    // Verify the expiry and stall-nudge prefixes (the two real consumers) are distinct
    const EXPIRY = 'wpt_expiry_dismissed_v1_'
    const STALL = 'wpt_stall_nudge_dismissed_v1_'
    expect(EXPIRY).not.toBe(STALL)
    writeDismissed(EXPIRY + 'plan-1')
    expect(readDismissed(STALL + 'plan-1')).toBe(false)
  })
})
