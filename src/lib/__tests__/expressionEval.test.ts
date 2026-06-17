import { describe, it, expect } from 'vitest'
import {
  evaluateExpression,
  evaluateCondition,
  evaluateUpdates,
  resolveLoad,
  resolveQuantityString,
  type EvalContext,
} from '../expressionEval'

// ── Fixtures ───────────────────────────────────────────────────────────────────

function ctx(
  vars: Record<string, number> = {},
  opts: { effort?: number | null; all_reps?: boolean; session_complete?: boolean } = {},
): EvalContext {
  return {
    vars,
    effort: opts.effort ?? null,
    all_reps: opts.all_reps ?? false,
    session_complete: opts.session_complete ?? false,
  }
}

// ── evaluateExpression ─────────────────────────────────────────────────────────

describe('evaluateExpression', () => {
  describe('numeric literals', () => {
    it('evaluates an integer literal', () => {
      expect(evaluateExpression('42', ctx())).toBe(42)
    })

    it('evaluates a decimal literal', () => {
      expect(evaluateExpression('3.14', ctx())).toBeCloseTo(3.14)
    })

    it('evaluates a negative number via unary minus', () => {
      expect(evaluateExpression('-5', ctx())).toBe(-5)
    })
  })

  describe('variable resolution', () => {
    it('resolves a variable from ctx.vars', () => {
      expect(evaluateExpression('squat', ctx({ squat: 135 }))).toBe(135)
    })

    it('returns 0 for an unknown variable', () => {
      expect(evaluateExpression('unknown_var', ctx())).toBe(0)
    })

    it('resolves effort from ctx.effort', () => {
      expect(evaluateExpression('effort', ctx({}, { effort: 3 }))).toBe(3)
    })

    it('resolves all_reps as 1 when true', () => {
      expect(evaluateExpression('all_reps', ctx({}, { all_reps: true }))).toBe(1)
    })

    it('resolves all_reps as 0 when false', () => {
      expect(evaluateExpression('all_reps', ctx({}, { all_reps: false }))).toBe(0)
    })

    it('resolves session_complete as 1 when true', () => {
      expect(evaluateExpression('session_complete', ctx({}, { session_complete: true }))).toBe(1)
    })
  })

  describe('arithmetic', () => {
    it('adds two numbers', () => {
      expect(evaluateExpression('2 + 3', ctx())).toBe(5)
    })

    it('subtracts two numbers', () => {
      expect(evaluateExpression('10 - 4', ctx())).toBe(6)
    })

    it('multiplies two numbers', () => {
      expect(evaluateExpression('3 * 4', ctx())).toBe(12)
    })

    it('divides two numbers', () => {
      expect(evaluateExpression('10 / 4', ctx())).toBe(2.5)
    })

    it('returns 0 for division by zero (safe guard)', () => {
      expect(evaluateExpression('5 / 0', ctx())).toBe(0)
    })

    it('respects operator precedence (* before +)', () => {
      expect(evaluateExpression('2 + 3 * 4', ctx())).toBe(14)
    })

    it('parentheses override precedence', () => {
      expect(evaluateExpression('(2 + 3) * 4', ctx())).toBe(20)
    })

    it('chains arithmetic with a variable', () => {
      expect(evaluateExpression('squat * 0.85', ctx({ squat: 200 }))).toBe(170)
    })
  })

  describe('comparison operators', () => {
    it('> returns 1 when true', () => expect(evaluateExpression('5 > 3', ctx())).toBe(1))
    it('> returns 0 when false', () => expect(evaluateExpression('3 > 5', ctx())).toBe(0))
    it('>= returns 1 when equal', () => expect(evaluateExpression('5 >= 5', ctx())).toBe(1))
    it('>= returns 0 when less', () => expect(evaluateExpression('4 >= 5', ctx())).toBe(0))
    it('< returns 1 when true', () => expect(evaluateExpression('2 < 4', ctx())).toBe(1))
    it('<= returns 1 when equal', () => expect(evaluateExpression('3 <= 3', ctx())).toBe(1))
    it('== returns 1 when equal', () => expect(evaluateExpression('4 == 4', ctx())).toBe(1))
    it('== returns 0 when not equal', () => expect(evaluateExpression('3 == 4', ctx())).toBe(0))
    it('!= returns 1 when not equal', () => expect(evaluateExpression('3 != 4', ctx())).toBe(1))
    it('!= returns 0 when equal', () => expect(evaluateExpression('4 != 4', ctx())).toBe(0))
  })

  describe('logical operators', () => {
    it('and: 1 and 1 = 1', () => {
      expect(evaluateExpression('1 and 1', ctx())).toBe(1)
    })

    it('and: 1 and 0 = 0', () => {
      expect(evaluateExpression('1 and 0', ctx())).toBe(0)
    })

    it('and: 0 and 1 = 0 (short-circuits)', () => {
      expect(evaluateExpression('0 and 1', ctx())).toBe(0)
    })

    it('or: 0 or 1 = 1', () => {
      expect(evaluateExpression('0 or 1', ctx())).toBe(1)
    })

    it('or: 1 or 0 = 1 (short-circuits)', () => {
      expect(evaluateExpression('1 or 0', ctx())).toBe(1)
    })

    it('or: 0 or 0 = 0', () => {
      expect(evaluateExpression('0 or 0', ctx())).toBe(0)
    })

    it('not: not 0 = 1', () => {
      expect(evaluateExpression('not 0', ctx())).toBe(1)
    })

    it('not: not 1 = 0', () => {
      expect(evaluateExpression('not 1', ctx())).toBe(0)
    })

    it('not: not 5 = 0 (any nonzero is truthy)', () => {
      expect(evaluateExpression('not 5', ctx())).toBe(0)
    })
  })

  describe('built-in functions', () => {
    it('min(a, b) returns the smaller value', () => {
      expect(evaluateExpression('min(3, 7)', ctx())).toBe(3)
    })

    it('max(a, b) returns the larger value', () => {
      expect(evaluateExpression('max(3, 7)', ctx())).toBe(7)
    })

    it('round(3.6) rounds to nearest integer', () => {
      expect(evaluateExpression('round(3.6)', ctx())).toBe(4)
    })

    it('round(3.4) rounds down', () => {
      expect(evaluateExpression('round(3.4)', ctx())).toBe(3)
    })

    it('floor(3.9) floors', () => {
      expect(evaluateExpression('floor(3.9)', ctx())).toBe(3)
    })

    it('ceil(3.1) ceils', () => {
      expect(evaluateExpression('ceil(3.1)', ctx())).toBe(4)
    })

    it('abs(-5) returns 5', () => {
      expect(evaluateExpression('abs(-5)', ctx())).toBe(5)
    })

    it('abs(5) returns 5', () => {
      expect(evaluateExpression('abs(5)', ctx())).toBe(5)
    })

    it('round5(137) rounds to nearest 5', () => {
      expect(evaluateExpression('round5(137)', ctx())).toBe(135)
    })

    it('round5(138) rounds to nearest 5 (up)', () => {
      expect(evaluateExpression('round5(138)', ctx())).toBe(140)
    })

    it('round2_5(136) rounds to nearest 2.5', () => {
      expect(evaluateExpression('round2_5(136)', ctx())).toBe(135)
    })

    it('round2_5(136.3) rounds to nearest 2.5 (137.5)', () => {
      // 136.3 / 2.5 = 54.52 → round to 55 → 55 * 2.5 = 137.5
      expect(evaluateExpression('round2_5(136.3)', ctx())).toBeCloseTo(137.5)
    })

    it('min with variable expression', () => {
      expect(evaluateExpression('min(easy_miles + 0.5, 8)', ctx({ easy_miles: 7.5 }))).toBe(8)
    })

    it('returns 0 for unknown function name', () => {
      expect(evaluateExpression('bogusFunc(5)', ctx())).toBe(0)
    })
  })

  describe('complex expressions', () => {
    it('evaluates real-world progression: round5(squat * 0.85)', () => {
      expect(evaluateExpression('round5(squat * 0.85)', ctx({ squat: 200 }))).toBe(170)
    })

    it('evaluates effort comparison', () => {
      expect(evaluateExpression('effort <= 3', ctx({}, { effort: 3 }))).toBe(1)
      expect(evaluateExpression('effort <= 3', ctx({}, { effort: 4 }))).toBe(0)
    })

    it('returns 0 for empty string (no-op)', () => {
      expect(evaluateExpression('', ctx())).toBe(0)
    })

    it('returns 0 for invalid syntax (parse error)', () => {
      expect(evaluateExpression('((unclosed', ctx())).toBe(0)
    })
  })
})

// ── evaluateCondition ──────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('returns true when condition is undefined (no condition = always fire)', () => {
    expect(evaluateCondition(undefined, ctx())).toBe(true)
  })

  it('returns true when condition is empty string', () => {
    expect(evaluateCondition('', ctx())).toBe(true)
  })

  it('all_reps returns true when ctx.all_reps is true', () => {
    expect(evaluateCondition('all_reps', ctx({}, { all_reps: true }))).toBe(true)
  })

  it('all_reps returns false when ctx.all_reps is false', () => {
    expect(evaluateCondition('all_reps', ctx({}, { all_reps: false }))).toBe(false)
  })

  it('session_complete returns true when ctx.session_complete is true', () => {
    expect(evaluateCondition('session_complete', ctx({}, { session_complete: true }))).toBe(true)
  })

  it('session_complete returns false when ctx.session_complete is false', () => {
    expect(evaluateCondition('session_complete', ctx({}, { session_complete: false }))).toBe(false)
  })

  it('evaluates effort <= 3 correctly', () => {
    expect(evaluateCondition('effort <= 3', ctx({}, { effort: 3 }))).toBe(true)
    expect(evaluateCondition('effort <= 3', ctx({}, { effort: 4 }))).toBe(false)
  })

  it('evaluates compound condition: all_reps and effort <= 4', () => {
    expect(evaluateCondition(
      'all_reps and effort <= 4',
      ctx({}, { all_reps: true, effort: 3 }),
    )).toBe(true)

    expect(evaluateCondition(
      'all_reps and effort <= 4',
      ctx({}, { all_reps: false, effort: 3 }),
    )).toBe(false)

    expect(evaluateCondition(
      'all_reps and effort <= 4',
      ctx({}, { all_reps: true, effort: 5 }),
    )).toBe(false)
  })

  it('evaluates or condition correctly', () => {
    expect(evaluateCondition(
      'all_reps or effort <= 2',
      ctx({}, { all_reps: false, effort: 2 }),
    )).toBe(true)
  })

  it('returns false for invalid condition syntax (parse error)', () => {
    expect(evaluateCondition('!!!invalid###', ctx())).toBe(false)
  })

  it('evaluates numeric expression as truthy (nonzero)', () => {
    expect(evaluateCondition('1', ctx())).toBe(true)
    expect(evaluateCondition('0', ctx())).toBe(false)
  })
})

// ── evaluateUpdates ────────────────────────────────────────────────────────────

describe('evaluateUpdates', () => {
  describe('assignment operators', () => {
    it('= sets var to evaluated value', () => {
      const result = evaluateUpdates('squat = 135', ctx({ squat: 100 }))
      expect(result).toEqual({ squat: 135 })
    })

    it('+= adds to current value', () => {
      const result = evaluateUpdates('squat += 5', ctx({ squat: 135 }))
      expect(result).toEqual({ squat: 140 })
    })

    it('-= subtracts from current value', () => {
      const result = evaluateUpdates('squat -= 5', ctx({ squat: 135 }))
      expect(result).toEqual({ squat: 130 })
    })

    it('*= multiplies current value', () => {
      const result = evaluateUpdates('squat *= 2', ctx({ squat: 50 }))
      expect(result).toEqual({ squat: 100 })
    })

    it('/= divides current value', () => {
      const result = evaluateUpdates('squat /= 2', ctx({ squat: 100 }))
      expect(result).toEqual({ squat: 50 })
    })

    it('/= by zero leaves value unchanged', () => {
      const result = evaluateUpdates('squat /= 0', ctx({ squat: 135 }))
      expect(result).toEqual({ squat: 135 })
    })
  })

  describe('rhs expressions', () => {
    it('rhs can reference ctx.vars', () => {
      const result = evaluateUpdates('squat = squat + 5', ctx({ squat: 135 }))
      expect(result).toEqual({ squat: 140 })
    })

    it('rhs can use functions', () => {
      const result = evaluateUpdates('squat = round5(squat * 0.85)', ctx({ squat: 200 }))
      expect(result).toEqual({ squat: 170 })
    })

    it('rhs can use min to cap a value', () => {
      const result = evaluateUpdates(
        'easy_miles = min(easy_miles + 0.5, 8)',
        ctx({ easy_miles: 7.8 }),
      )
      expect(result.easy_miles).toBe(8)
    })

    it('rhs can use min that does not cap', () => {
      const result = evaluateUpdates(
        'easy_miles = min(easy_miles + 0.5, 8)',
        ctx({ easy_miles: 3 }),
      )
      expect(result.easy_miles).toBe(3.5)
    })
  })

  describe('multi-statement (comma-separated)', () => {
    it('applies two updates in order', () => {
      const result = evaluateUpdates(
        'squat += 5, bench += 2.5',
        ctx({ squat: 135, bench: 95 }),
      )
      expect(result).toEqual({ squat: 140, bench: 97.5 })
    })

    it('second statement sees updated value from first', () => {
      // squat is updated to 140 in the first statement;
      // the second uses the already-updated result value.
      const result = evaluateUpdates(
        'squat += 5, press = squat',
        ctx({ squat: 135 }),
      )
      expect(result.squat).toBe(140)
      expect(result.press).toBe(140)
    })

    it('handles whitespace around comma', () => {
      const result = evaluateUpdates(
        'squat += 5 , bench += 5',
        ctx({ squat: 100, bench: 80 }),
      )
      expect(result.squat).toBe(105)
      expect(result.bench).toBe(85)
    })
  })

  describe('edge cases', () => {
    it('skips malformed statements (no variable name)', () => {
      const result = evaluateUpdates('= 5', ctx())
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('initialises unknown variable from 0 when using +=', () => {
      const result = evaluateUpdates('new_var += 10', ctx())
      expect(result).toEqual({ new_var: 10 })
    })

    it('uses current var when += references a var that exists', () => {
      const result = evaluateUpdates('squat += 10', ctx({ squat: 100 }))
      expect(result.squat).toBe(110)
    })

    it('returns empty object for an empty string', () => {
      expect(evaluateUpdates('', ctx())).toEqual({})
    })
  })

  describe('NaN / Infinity guard — corrupted program vars must not propagate', () => {
    it('keeps previous bench value when squat var is NaN in ctx.vars', () => {
      // If squat is corrupted (e.g. NaN persisted in programStore), a derived
      // assignment like bench = squat * 0.85 must not overwrite bench with NaN.
      const result = evaluateUpdates(
        'bench = squat * 0.85',
        ctx({ squat: NaN, bench: 135 }),
      )
      expect(result.bench).toBe(135)
      expect(isFinite(result.bench)).toBe(true)
    })

    it('keeps previous bench value when squat var is Infinity', () => {
      const result = evaluateUpdates(
        'bench = squat * 0.85',
        ctx({ squat: Infinity, bench: 135 }),
      )
      expect(result.bench).toBe(135)
      expect(isFinite(result.bench)).toBe(true)
    })

    it('chained updates: NaN-tainted first assignment does not corrupt second clean statement', () => {
      // bench = squat * 0.85 (NaN) → guard keeps bench at 100
      // ohp += 5 (clean) → ohp increments normally
      const result = evaluateUpdates(
        'bench = squat * 0.85, ohp += 5',
        ctx({ squat: NaN, bench: 100, ohp: 75 }),
      )
      expect(result.bench).toBe(100)
      expect(result.ohp).toBe(80)
    })

    it('squat += 5 on a NaN var stays NaN (guard cannot resurrect a corrupted source)', () => {
      // NaN + 5 = NaN; isFinite(NaN) = false; falls back to cur = NaN. Stays NaN.
      // This is expected — guard prevents cross-var contamination, not self-repair.
      const result = evaluateUpdates('squat += 5', ctx({ squat: NaN }))
      expect(Number.isNaN(result.squat)).toBe(true)
    })
  })

  describe('splitStatements — commas inside function calls are not separators', () => {
    it('treats comma inside min() as part of the expression, not a separator', () => {
      // The string has two statements separated by an outer comma,
      // but the first statement's RHS contains an inner comma inside min().
      const result = evaluateUpdates(
        'easy_miles = min(easy_miles + 0.5, 8), bench += 5',
        ctx({ easy_miles: 3, bench: 95 }),
      )
      expect(result.easy_miles).toBe(3.5)
      expect(result.bench).toBe(100)
    })

    it('handles deeply nested parens in a multi-statement update', () => {
      // round5(min(squat * 0.85, 200)) — two nested function calls
      const result = evaluateUpdates(
        'squat = round5(min(squat * 0.85, 200)), bench += 5',
        ctx({ squat: 240, bench: 185 }),
      )
      // squat * 0.85 = 204; min(204, 200) = 200; round5(200) = 200
      expect(result.squat).toBe(200)
      expect(result.bench).toBe(190)
    })
  })
})

// ── resolveLoad ────────────────────────────────────────────────────────────────

describe('resolveLoad', () => {
  it('returns null for undefined input', () => {
    expect(resolveLoad(undefined, ctx())).toBeNull()
  })

  it('returns numeric value for plain number string', () => {
    expect(resolveLoad('135', ctx())).toBe(135)
  })

  it('strips "lb" suffix and returns numeric value', () => {
    expect(resolveLoad('135lb', ctx())).toBe(135)
  })

  it('strips "kg" suffix and returns numeric value', () => {
    expect(resolveLoad('60kg', ctx())).toBe(60)
  })

  it('evaluates an expression referencing program vars', () => {
    expect(resolveLoad('0.75 * squat', ctx({ squat: 200 }))).toBe(150)
  })

  it('evaluates round5(squat * 0.85)', () => {
    expect(resolveLoad('round5(squat * 0.85)', ctx({ squat: 200 }))).toBe(170)
  })

  it('returns 0 for "bodyweight" (unknown var evaluates to 0)', () => {
    expect(resolveLoad('bodyweight', ctx())).toBe(0)
  })

  it('rounds result to 2 decimal places', () => {
    expect(resolveLoad('1 / 3', ctx())).toBeCloseTo(0.33, 2)
  })

  it('returns null for empty string', () => {
    expect(resolveLoad('', ctx())).toBeNull()
  })

  it('returns null for expression with unclosed parenthesis', () => {
    expect(resolveLoad('round5(135', ctx())).toBeNull()
  })

  it('strips case-insensitive "LB" suffix', () => {
    expect(resolveLoad('225LB', ctx())).toBe(225)
  })
})

// ── resolveQuantityString ──────────────────────────────────────────────────────

describe('resolveQuantityString', () => {
  it('returns null for undefined input', () => {
    expect(resolveQuantityString(undefined, ctx())).toBeNull()
  })

  it('returns raw number when input is already numeric', () => {
    expect(resolveQuantityString(5, ctx())).toEqual({ value: 5, unit: '' })
  })

  it('parses plain numeric string', () => {
    expect(resolveQuantityString('5', ctx())).toEqual({ value: 5, unit: '' })
  })

  it('parses "5.5 mi"', () => {
    expect(resolveQuantityString('5.5 mi', ctx())).toEqual({ value: 5.5, unit: 'mi' })
  })

  it('parses "800m"', () => {
    expect(resolveQuantityString('800m', ctx())).toEqual({ value: 800, unit: 'm' })
  })

  it('parses "10m" as meters not minutes', () => {
    expect(resolveQuantityString('10m', ctx())).toEqual({ value: 10, unit: 'm' })
  })

  it('parses "10min"', () => {
    expect(resolveQuantityString('10min', ctx())).toEqual({ value: 10, unit: 'min' })
  })

  it('parses "1.5 km"', () => {
    expect(resolveQuantityString('1.5 km', ctx())).toEqual({ value: 1.5, unit: 'km' })
  })

  it('resolves a variable reference with unit: "easy_miles mi"', () => {
    const result = resolveQuantityString('easy_miles mi', ctx({ easy_miles: 3.5 }))
    expect(result).toEqual({ value: 3.5, unit: 'mi' })
  })

  it('resolves a bare variable with no unit', () => {
    // "rep_count" does not end with a unit suffix so it is treated as a bare var
    const result = resolveQuantityString('rep_count', ctx({ rep_count: 6 }))
    expect(result).toEqual({ value: 6, unit: '' })
  })

  it('resolves expression with unit: "(easy_miles + 0.5) mi"', () => {
    const result = resolveQuantityString('(easy_miles + 0.5) mi', ctx({ easy_miles: 3 }))
    expect(result).toEqual({ value: 3.5, unit: 'mi' })
  })

  it('parses "30 s" (seconds unit)', () => {
    expect(resolveQuantityString('30 s', ctx())).toEqual({ value: 30, unit: 's' })
  })

  it('parses "1.5 h" (hours unit)', () => {
    expect(resolveQuantityString('1.5 h', ctx())).toEqual({ value: 1.5, unit: 'h' })
  })

  it('resolves a variable expression as bare (no unit)', () => {
    const result = resolveQuantityString('squat', ctx({ squat: 225 }))
    expect(result).toEqual({ value: 225, unit: '' })
  })
})
