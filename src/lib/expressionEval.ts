// ── Safe expression evaluator ─────────────────────────────────────────────────
// Recursive-descent parser + evaluator. No eval() or Function() used.
//
// Supported syntax:
//   Arithmetic     : +  -  *  /
//   Comparison     : >  >=  <  <=  ==  !=
//   Logical        : and  or  not
//   Functions      : min  max  round  floor  ceil  abs  round5  round2_5
//   Parentheses    : (expr)
//   Numeric literals: 135  3.14
//   Variable refs  : squat  easy_miles  (looked up in ctx.vars)
//   Keywords       : all_reps  session_complete  (injected as 0/1 in ctx.vars)
//
// Update expression format (for ProgressionRule.then / .else):
//   "squat += 5"
//   "squat = round5(squat * 0.85)"
//   "easy_miles = min(easy_miles + 0.5, 8)"
//   Multiple updates can be comma-separated: "a += 1, b = max(b - 1, 0)"

// ── Tokens ────────────────────────────────────────────────────────────────────

type TokType =
  | 'num' | 'ident'
  | 'plus' | 'minus' | 'star' | 'slash'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'lparen' | 'rparen' | 'comma'
  | 'eof'

interface Tok { type: TokType; value?: number | string }

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue }

    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      let n = ''
      while (i < src.length && /[\d.]/.test(src[i])) n += src[i++]
      toks.push({ type: 'num', value: parseFloat(n) })
      continue
    }

    if (/[a-zA-Z_]/.test(c)) {
      let w = ''
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) w += src[i++]
      toks.push({ type: 'ident', value: w })
      continue
    }

    const two = src.slice(i, i + 2)
    if (two === '>=') { toks.push({ type: 'gte' }); i += 2; continue }
    if (two === '<=') { toks.push({ type: 'lte' }); i += 2; continue }
    if (two === '==') { toks.push({ type: 'eq' });  i += 2; continue }
    if (two === '!=') { toks.push({ type: 'neq' }); i += 2; continue }

    if (c === '>') { toks.push({ type: 'gt' }); i++; continue }
    if (c === '<') { toks.push({ type: 'lt' }); i++; continue }
    if (c === '+') { toks.push({ type: 'plus' }); i++; continue }
    if (c === '-') { toks.push({ type: 'minus' }); i++; continue }
    if (c === '*') { toks.push({ type: 'star' }); i++; continue }
    if (c === '/') { toks.push({ type: 'slash' }); i++; continue }
    if (c === '(') { toks.push({ type: 'lparen' }); i++; continue }
    if (c === ')') { toks.push({ type: 'rparen' }); i++; continue }
    if (c === ',') { toks.push({ type: 'comma' }); i++; continue }
    i++ // skip unknown char
  }
  toks.push({ type: 'eof' })
  return toks
}

// ── AST ───────────────────────────────────────────────────────────────────────

type Expr =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'binop'; op: string; l: Expr; r: Expr }
  | { k: 'unary'; op: string; x: Expr }
  | { k: 'call'; fn: string; args: Expr[] }

// ── Parser ────────────────────────────────────────────────────────────────────

class Parser {
  private pos = 0
  constructor(private toks: Tok[]) {}

  private peek(): Tok { return this.toks[this.pos] }
  private consume(): Tok { return this.toks[this.pos++] }
  private eat(type: TokType): Tok {
    const t = this.consume()
    if (t.type !== type) throw new Error(`Expected ${type} got ${t.type}`)
    return t
  }

  parseExpr(): Expr { return this.parseOr() }

  private parseOr(): Expr {
    let l = this.parseAnd()
    while (this.peek().type === 'ident' && this.peek().value === 'or') {
      this.consume()
      l = { k: 'binop', op: 'or', l, r: this.parseAnd() }
    }
    return l
  }

  private parseAnd(): Expr {
    let l = this.parseNot()
    while (this.peek().type === 'ident' && this.peek().value === 'and') {
      this.consume()
      l = { k: 'binop', op: 'and', l, r: this.parseNot() }
    }
    return l
  }

  private parseNot(): Expr {
    if (this.peek().type === 'ident' && this.peek().value === 'not') {
      this.consume()
      return { k: 'unary', op: 'not', x: this.parseNot() }
    }
    return this.parseCmp()
  }

  private parseCmp(): Expr {
    let l = this.parseAdd()
    const cmpOps: TokType[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq']
    while (cmpOps.includes(this.peek().type)) {
      const op = this.consume().type
      l = { k: 'binop', op, l, r: this.parseAdd() }
    }
    return l
  }

  private parseAdd(): Expr {
    let l = this.parseMul()
    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.consume().type
      l = { k: 'binop', op, l, r: this.parseMul() }
    }
    return l
  }

  private parseMul(): Expr {
    let l = this.parseUnary()
    while (this.peek().type === 'star' || this.peek().type === 'slash') {
      const op = this.consume().type
      l = { k: 'binop', op, l, r: this.parseUnary() }
    }
    return l
  }

  private parseUnary(): Expr {
    if (this.peek().type === 'minus') {
      this.consume()
      return { k: 'unary', op: 'neg', x: this.parsePrimary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expr {
    const t = this.peek()
    if (t.type === 'num') { this.consume(); return { k: 'num', v: t.value as number } }

    if (t.type === 'ident') {
      this.consume()
      const name = t.value as string
      if (this.peek().type === 'lparen') {
        this.consume() // (
        const args: Expr[] = []
        while (this.peek().type !== 'rparen' && this.peek().type !== 'eof') {
          args.push(this.parseExpr())
          if (this.peek().type === 'comma') this.consume()
        }
        this.eat('rparen')
        return { k: 'call', fn: name, args }
      }
      return { k: 'var', name }
    }

    if (t.type === 'lparen') {
      this.consume()
      const e = this.parseExpr()
      this.eat('rparen')
      return e
    }

    return { k: 'num', v: 0 }
  }
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  abs: (x) => Math.abs(x),
  round5: (x) => Math.round(x / 5) * 5,
  round2_5: (x) => Math.round(x / 2.5) * 2.5,
}

function evalExpr(expr: Expr, vars: Record<string, number>): number {
  switch (expr.k) {
    case 'num': return expr.v
    case 'var': return vars[expr.name] ?? 0
    case 'unary':
      if (expr.op === 'neg') return -evalExpr(expr.x, vars)
      if (expr.op === 'not') return evalExpr(expr.x, vars) === 0 ? 1 : 0
      return 0
    case 'call': {
      const fn = FUNCS[expr.fn]
      if (!fn) return 0
      return fn(...expr.args.map(a => evalExpr(a, vars)))
    }
    case 'binop': {
      // Short-circuit logical ops before evaluating both sides
      if (expr.op === 'and') {
        const lv = evalExpr(expr.l, vars)
        return lv !== 0 ? (evalExpr(expr.r, vars) !== 0 ? 1 : 0) : 0
      }
      if (expr.op === 'or') {
        const lv = evalExpr(expr.l, vars)
        return lv !== 0 ? 1 : (evalExpr(expr.r, vars) !== 0 ? 1 : 0)
      }
      const l = evalExpr(expr.l, vars)
      const r = evalExpr(expr.r, vars)
      switch (expr.op) {
        case 'plus': return l + r
        case 'minus': return l - r
        case 'star': return l * r
        case 'slash': return r !== 0 ? l / r : 0
        case 'gt': return l > r ? 1 : 0
        case 'gte': return l >= r ? 1 : 0
        case 'lt': return l < r ? 1 : 0
        case 'lte': return l <= r ? 1 : 0
        case 'eq': return l === r ? 1 : 0
        case 'neq': return l !== r ? 1 : 0
        default: return 0
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EvalContext {
  vars: Record<string, number>
  effort?: number | null
  all_reps?: boolean
  session_complete?: boolean
}

function buildVars(ctx: EvalContext): Record<string, number> {
  return {
    ...ctx.vars,
    effort: ctx.effort ?? 0,
    all_reps: ctx.all_reps ? 1 : 0,
    session_complete: ctx.session_complete ? 1 : 0,
  }
}

/** Evaluate a numeric expression, returning the result. */
export function evaluateExpression(expr: string, ctx: EvalContext): number {
  try {
    const toks = tokenize(expr.trim())
    const ast = new Parser(toks).parseExpr()
    return evalExpr(ast, buildVars(ctx))
  } catch {
    return 0
  }
}

/**
 * Evaluate a boolean/condition string.
 * Bare keywords "all_reps" / "session_complete" are valid standalone conditions.
 */
export function evaluateCondition(cond: string | undefined, ctx: EvalContext): boolean {
  if (!cond) return true // no condition = always fire
  const trimmed = cond.trim()
  if (trimmed === 'all_reps') return ctx.all_reps === true
  if (trimmed === 'session_complete') return ctx.session_complete === true
  try {
    const toks = tokenize(trimmed)
    const ast = new Parser(toks).parseExpr()
    return evalExpr(ast, buildVars(ctx)) !== 0
  } catch {
    return false
  }
}

/**
 * Parse and apply one or more update expressions (comma-separated).
 * Returns an object of { varName: newValue } for all updated vars.
 *
 * Supported forms:
 *   squat += 5
 *   squat -= 5
 *   squat *= 0.85
 *   squat /= 2
 *   squat = round5(squat * 0.85)
 */
export function evaluateUpdates(
  updateStr: string,
  ctx: EvalContext,
): Record<string, number> {
  const vars = buildVars(ctx)
  const result: Record<string, number> = {}

  const statements = updateStr.split(',').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    // Match: varName [+|-|*|/]= expression
    const m = stmt.match(/^([a-zA-Z_]\w*)\s*(\+|-|\*|\/)?=\s*(.+)$/)
    if (!m) continue
    const [, varName, op, rhs] = m
    const rhsVal = (() => {
      try {
        const toks = tokenize(rhs.trim())
        return evalExpr(new Parser(toks).parseExpr(), { ...vars, ...result })
      } catch { return 0 }
    })()
    const cur = result[varName] ?? vars[varName] ?? 0
    switch (op) {
      case '+': result[varName] = cur + rhsVal; break
      case '-': result[varName] = cur - rhsVal; break
      case '*': result[varName] = cur * rhsVal; break
      case '/': result[varName] = rhsVal !== 0 ? cur / rhsVal : cur; break
      default:  result[varName] = rhsVal; break
    }
  }
  return result
}

/**
 * Resolve a load expression string to a number (in lbs or the base unit).
 * "135lb" → 135, "0.75 * squat" → 0.75 * ctx.vars.squat, "bodyweight" → 0
 */
export function resolveLoad(loadExpr: string | undefined, ctx: EvalContext): number | null {
  if (!loadExpr) return null
  const stripped = loadExpr.replace(/lb$/i, '').replace(/kg$/i, '').trim()
  try {
    const toks = tokenize(stripped)
    const ast = new Parser(toks).parseExpr()
    return Math.round(evalExpr(ast, buildVars(ctx)) * 100) / 100
  } catch {
    return null
  }
}

/**
 * Resolve a distance/duration expression to its numeric part.
 * "easy_miles mi" → { value: ctx.vars.easy_miles, unit: 'mi' }
 * "800m"          → { value: 800, unit: 'm' }
 * "10m"           → { value: 10, unit: 'min' }  (ambiguity: context-dependent)
 * "interval_reps" → { value: ctx.vars.interval_reps, unit: '' }
 */
export function resolveQuantityString(
  raw: string | number | undefined,
  ctx: EvalContext,
): { value: number; unit: string } | null {
  if (raw == null) return null
  const s = String(raw).trim()

  // Numeric already
  if (/^\d+(\.\d+)?$/.test(s)) return { value: parseFloat(s), unit: '' }

  // Check for trailing unit
  const unitMatch = s.match(/^(.+?)\s*(mi|km|m|s|min|h)$/i)
  if (unitMatch) {
    const [, exprPart, unit] = unitMatch
    try {
      const toks = tokenize(exprPart.trim())
      const val = evalExpr(new Parser(toks).parseExpr(), buildVars(ctx))
      return { value: val, unit: unit.toLowerCase() }
    } catch { return null }
  }

  // No explicit unit — try to evaluate as expression (e.g. bare var name)
  try {
    const toks = tokenize(s)
    const val = evalExpr(new Parser(toks).parseExpr(), buildVars(ctx))
    return { value: val, unit: '' }
  } catch { return null }
}
