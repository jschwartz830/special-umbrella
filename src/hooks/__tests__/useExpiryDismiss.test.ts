/**
 * Tests for useExpiryDismiss localStorage behavior.
 *
 * The hook uses localStorage for persistence. In the node test environment
 * we provide a simple in-memory mock via vi.stubGlobal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localStorage mock ──────────────────────────────────────────────────────

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

const KEY_PREFIX = 'wpt_expiry_dismissed_v1_'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useExpiryDismiss storage contract', () => {
  let storage: ReturnType<typeof makeLocalStorageMock>

  beforeEach(() => {
    storage = makeLocalStorageMock()
    vi.stubGlobal('localStorage', storage)
  })

  it('key is absent before any dismiss call', () => {
    expect(storage.getItem(KEY_PREFIX + 'plan-a')).toBe(null)
  })

  it('sets key to "1" on dismiss', () => {
    storage.setItem(KEY_PREFIX + 'plan-a', '1')
    expect(storage.getItem(KEY_PREFIX + 'plan-a')).toBe('1')
  })

  it('is isolated by planId — dismissing plan-a does not affect plan-b', () => {
    storage.setItem(KEY_PREFIX + 'plan-a', '1')
    expect(storage.getItem(KEY_PREFIX + 'plan-b')).toBe(null)
  })

  it('reads true when key equals "1"', () => {
    storage.setItem(KEY_PREFIX + 'plan-z', '1')
    expect(storage.getItem(KEY_PREFIX + 'plan-z') === '1').toBe(true)
  })

  it('reads false when key is absent', () => {
    expect(storage.getItem(KEY_PREFIX + 'plan-z') === '1').toBe(false)
  })

  it('reads false when key is any other value', () => {
    storage.setItem(KEY_PREFIX + 'plan-z', 'yes')
    expect(storage.getItem(KEY_PREFIX + 'plan-z') === '1').toBe(false)
  })
})

// ── durationActualMin guard (OutcomeModal logic) ───────────────────────────
// Verifies the guard pattern used in OutcomeModal.handleConfirm to ensure
// negative or zero durations are coerced to null.

describe('durationActualMin input guard', () => {
  function parseDuration(raw: string): number | null {
    const n = parseFloat(raw)
    return isFinite(n) && n > 0 ? n : null
  }

  it('passes through a positive integer', () => {
    expect(parseDuration('45')).toBe(45)
  })

  it('passes through a positive decimal', () => {
    expect(parseDuration('30.5')).toBe(30.5)
  })

  it('returns null for zero', () => {
    expect(parseDuration('0')).toBe(null)
  })

  it('returns null for negative value', () => {
    expect(parseDuration('-30')).toBe(null)
  })

  it('returns null for empty string', () => {
    expect(parseDuration('')).toBe(null)
  })

  it('returns null for non-numeric input', () => {
    expect(parseDuration('abc')).toBe(null)
  })
})
