/**
 * Tests for programStore business logic: initVars, getVars, setVars,
 * clearPlanVars, and applyProgressionRule.
 *
 * The persist middleware is mocked as a pass-through so the store
 * works in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useProgramStore } from '../programStore'
import type { ProgressionRule } from '../../types/program'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getState() {
  return useProgramStore.getState()
}

function rule(
  ifCond: string | undefined,
  thenStr: string,
  elseStr?: string,
): ProgressionRule {
  return { if: ifCond, then: thenStr, else: elseStr }
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  useProgramStore.setState({ vars: {} })
})

// ── initVars ──────────────────────────────────────────────────────────────────

describe('initVars', () => {
  it('sets initial values for a new plan', () => {
    getState().initVars('plan-1', { squat: 135, bench: 95 })
    expect(getState().getVars('plan-1')).toMatchObject({ squat: 135, bench: 95 })
  })

  it('does not overwrite existing values (idempotent on re-activation)', () => {
    getState().initVars('plan-1', { squat: 135 })
    getState().setVars('plan-1', { squat: 200 }) // user progressed
    getState().initVars('plan-1', { squat: 135 }) // re-activate: should not reset
    expect(getState().getVars('plan-1').squat).toBe(200)
  })

  it('adds new keys while preserving existing ones', () => {
    getState().initVars('plan-1', { squat: 135 })
    getState().initVars('plan-1', { squat: 135, bench: 95 })
    expect(getState().getVars('plan-1')).toMatchObject({ squat: 135, bench: 95 })
  })

  it('is isolated per plan', () => {
    getState().initVars('plan-1', { squat: 135 })
    getState().initVars('plan-2', { easy_miles: 3.5 })
    expect(Object.keys(getState().getVars('plan-1'))).not.toContain('easy_miles')
    expect(Object.keys(getState().getVars('plan-2'))).not.toContain('squat')
  })
})

// ── getVars ───────────────────────────────────────────────────────────────────

describe('getVars', () => {
  it('returns empty object for unknown plan', () => {
    expect(getState().getVars('unknown-plan')).toEqual({})
  })

  it('returns the current vars for a known plan', () => {
    getState().initVars('plan-1', { squat: 100 })
    expect(getState().getVars('plan-1').squat).toBe(100)
  })
})

// ── setVars ───────────────────────────────────────────────────────────────────

describe('setVars', () => {
  it('merges patch into existing vars without losing other keys', () => {
    getState().initVars('plan-1', { squat: 135, bench: 95 })
    getState().setVars('plan-1', { squat: 140 })
    const vars = getState().getVars('plan-1')
    expect(vars.squat).toBe(140)
    expect(vars.bench).toBe(95) // unchanged
  })

  it('creates vars for a plan that had no prior vars', () => {
    getState().setVars('new-plan', { overhead: 65 })
    expect(getState().getVars('new-plan').overhead).toBe(65)
  })

  it('does not affect vars for other plans', () => {
    getState().initVars('plan-1', { squat: 135 })
    getState().initVars('plan-2', { bench: 95 })
    getState().setVars('plan-1', { squat: 140 })
    expect(getState().getVars('plan-2').bench).toBe(95)
  })
})

// ── clearPlanVars ─────────────────────────────────────────────────────────────

describe('clearPlanVars', () => {
  it('removes all vars for the given plan', () => {
    getState().initVars('plan-1', { squat: 135, bench: 95 })
    getState().clearPlanVars('plan-1')
    expect(getState().getVars('plan-1')).toEqual({})
  })

  it('does not affect vars for other plans', () => {
    getState().initVars('plan-1', { squat: 135 })
    getState().initVars('plan-2', { easy_miles: 3.5 })
    getState().clearPlanVars('plan-1')
    expect(getState().getVars('plan-2')).toMatchObject({ easy_miles: 3.5 })
  })

  it('is a no-op for a plan with no vars', () => {
    expect(() => {
      getState().clearPlanVars('nonexistent-plan')
    }).not.toThrow()
    expect(getState().getVars('nonexistent-plan')).toEqual({})
  })
})

// ── applyProgressionRule ──────────────────────────────────────────────────────

describe('applyProgressionRule', () => {
  const BASE_CTX = { effort: null, all_reps: false, session_complete: false }

  describe('condition evaluation', () => {
    it('applies then-updates when condition is met', () => {
      getState().initVars('plan-1', { squat: 135 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule('all_reps', 'squat += 5'),
        { ...BASE_CTX, all_reps: true },
      )
      expect(updates).toEqual({ squat: 140 })
      expect(getState().getVars('plan-1').squat).toBe(140)
    })

    it('applies else-updates when condition is not met', () => {
      getState().initVars('plan-1', { squat: 135 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule('all_reps', 'squat += 5', 'squat -= 5'),
        { ...BASE_CTX, all_reps: false },
      )
      expect(updates).toEqual({ squat: 130 })
      expect(getState().getVars('plan-1').squat).toBe(130)
    })

    it('returns empty object and makes no changes when condition false with no else', () => {
      getState().initVars('plan-1', { squat: 135 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule('all_reps', 'squat += 5'),
        { ...BASE_CTX, all_reps: false },
      )
      expect(updates).toEqual({})
      expect(getState().getVars('plan-1').squat).toBe(135)
    })

    it('applies then when no condition (undefined condition = always fire)', () => {
      getState().initVars('plan-1', { squat: 135 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule(undefined, 'squat += 5'),
        BASE_CTX,
      )
      expect(updates).toEqual({ squat: 140 })
    })

    it('applies effort-based condition correctly', () => {
      getState().initVars('plan-1', { easy_miles: 3 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule('effort <= 3', 'easy_miles += 0.5'),
        { ...BASE_CTX, effort: 3 },
      )
      expect(updates).toEqual({ easy_miles: 3.5 })
    })

    it('does not apply when effort condition is not met', () => {
      getState().initVars('plan-1', { easy_miles: 3 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule('effort <= 3', 'easy_miles += 0.5'),
        { ...BASE_CTX, effort: 4 },
      )
      expect(updates).toEqual({})
      expect(getState().getVars('plan-1').easy_miles).toBe(3)
    })
  })

  describe('update expression evaluation', () => {
    it('evaluates complex rhs expression: round5(squat * 0.85)', () => {
      getState().initVars('plan-1', { squat: 200 })
      const updates = getState().applyProgressionRule(
        'plan-1',
        rule(undefined, 'squat = round5(squat * 0.85)'),
        BASE_CTX,
      )
      expect(updates.squat).toBe(170)
      expect(getState().getVars('plan-1').squat).toBe(170)
    })

    it('evaluates min-capped update', () => {
      getState().initVars('plan-1', { easy_miles: 7.8 })
      getState().applyProgressionRule(
        'plan-1',
        rule(undefined, 'easy_miles = min(easy_miles + 0.5, 8)'),
        BASE_CTX,
      )
      expect(getState().getVars('plan-1').easy_miles).toBe(8)
    })

    it('applies multi-variable update in a single rule', () => {
      getState().initVars('plan-1', { squat: 135, bench: 95 })
      getState().applyProgressionRule(
        'plan-1',
        rule(undefined, 'squat += 5, bench += 2.5'),
        BASE_CTX,
      )
      expect(getState().getVars('plan-1').squat).toBe(140)
      expect(getState().getVars('plan-1').bench).toBe(97.5)
    })
  })

  describe('persistence', () => {
    it('persists updated vars across multiple rule applications', () => {
      getState().initVars('plan-1', { squat: 100 })

      getState().applyProgressionRule('plan-1', rule(undefined, 'squat += 5'), BASE_CTX)
      expect(getState().getVars('plan-1').squat).toBe(105)

      getState().applyProgressionRule('plan-1', rule(undefined, 'squat += 5'), BASE_CTX)
      expect(getState().getVars('plan-1').squat).toBe(110)
    })

    it('does not leak updates to other plans', () => {
      getState().initVars('plan-1', { squat: 135 })
      getState().initVars('plan-2', { squat: 185 })

      getState().applyProgressionRule('plan-1', rule(undefined, 'squat += 5'), BASE_CTX)

      expect(getState().getVars('plan-1').squat).toBe(140)
      expect(getState().getVars('plan-2').squat).toBe(185) // untouched
    })
  })

  describe('error resilience', () => {
    // applyProgressionRule must never throw — a malformed YAML rule (bad condition
    // string or non-string then/else) must be caught silently so the caller's
    // workout log is not disrupted.

    it('returns {} and does not throw when rule.if is not evaluable', () => {
      getState().initVars('plan-1', { squat: 135 })
      // evaluateCondition catches parse errors internally and returns false,
      // so a weird condition string is safe.
      const result = getState().applyProgressionRule(
        'plan-1',
        rule('this is @#$ not valid expr', 'squat += 5'),
        BASE_CTX,
      )
      expect(result).toEqual({})
      expect(getState().getVars('plan-1').squat).toBe(135) // unchanged
    })

    it('returns {} and does not throw when rule.then is an empty string', () => {
      getState().initVars('plan-1', { squat: 135 })
      const result = getState().applyProgressionRule(
        'plan-1',
        { if: 'all_reps', then: '', else: undefined },
        { ...BASE_CTX, all_reps: true },
      )
      // Empty then-string means no-op (early return before evaluateUpdates)
      expect(result).toEqual({})
      expect(getState().getVars('plan-1').squat).toBe(135)
    })

    it('leaves vars unchanged after a catch — no partial mutation', () => {
      getState().initVars('plan-1', { squat: 135, bench: 95 })
      // Force a throw by passing a rule object where .then is not a string
      // (simulates malformed YAML parsed with a wrong type).
      const badRule = { if: undefined, then: null as unknown as string }
      expect(() => {
        getState().applyProgressionRule('plan-1', badRule, BASE_CTX)
      }).not.toThrow()
      // Vars must be untouched
      expect(getState().getVars('plan-1').squat).toBe(135)
      expect(getState().getVars('plan-1').bench).toBe(95)
    })
  })
})
