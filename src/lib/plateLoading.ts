// ── Plate-aware warmup planning ──────────────────────────────────────────────
// Picks warmup weights that are quick to load: each warmup may land anywhere within
// ±tolerance (of the working weight) of its ideal ramp weight, and the plan with the
// fewest plate changes from the empty bar → warmups → working weight wins.
//
// The bar is modelled one side at a time as a stack of plates, innermost first.
// Going from one stack to the next removes outer plates until what's left starts the
// next stack, then adds the rest — e.g. [25, 10] → [25, 35] is "−10, +35" (2 moves).
// Plate order is free (a 10 may sit inside a 35). Every plate moved costs the same.
// Ties go to the plan with fewer plates on the bar, then the one closest to the ideal weights.
// Pure and deterministic.

import type { PlateSpec } from './equipment'

export const DEFAULT_WARMUP_TOLERANCE = 0.08
/** Warmups land at most this fraction of the working weight (matches generateWarmups). */
const WARMUP_CEILING = 0.9
/** Plates per side considered for a warmup — warmups shouldn't need a tall stack. */
const MAX_WARMUP_PLATES = 4
/** Change plates: kept on the outside of a warmup stack. */
const SMALL_PLATE = 5
/** 0.25 lb units keep 1.25 / 2.5 lb plates exact in integer math. */
const UNIT = 4

export interface PlateChange {
  /** Plates taken off each side, outermost first. */
  remove: number[]
  /** Plates put on each side, in loading order. */
  add: number[]
}

export interface PlateLoadingPlan {
  /** One per ideal warmup, in order. */
  warmups: Array<{ load: number; perSide: number[]; change: PlateChange }>
  /** The working weight's stack, reached from the last warmup with the fewest moves. */
  working: { perSide: number[]; change: PlateChange }
  /** Total plates moved (per side). */
  moves: number
}

const u = (lbs: number) => Math.round(lbs * UNIT)
const sum = (stack: number[]) => stack.reduce((a, b) => a + b, 0)

export function plateChange(from: number[], to: number[]): PlateChange {
  let k = 0
  while (k < from.length && k < to.length && from[k] === to[k]) k++
  return { remove: from.slice(k).reverse(), add: to.slice(k) }
}

/** Plates moved going from one stack to the next (no allocation; hot loop). */
function moves(from: number[], to: number[]): number {
  let k = 0
  while (k < from.length && k < to.length && from[k] === to[k]) k++
  return from.length + to.length - 2 * k
}

function fmtPlates(ws: number[]): string {
  const counts = new Map<number, number>()
  for (const w of ws) counts.set(w, (counts.get(w) ?? 0) + 1)
  return [...counts].map(([w, n]) => `${n > 1 ? `${n}×` : ''}${w}s`).join(' + ')
}

/** "+25s", "−10s, +35s", "+2×45s", "Empty bar", "No change". Each plate is one per side. */
export function describePlateChange(change: PlateChange, perSideAfter: number[]): string {
  if (perSideAfter.length === 0) return change.remove.length > 0 ? 'Strip to the empty bar' : 'Empty bar'
  const parts: string[] = []
  if (change.remove.length > 0) parts.push(`−${fmtPlates(change.remove)}`)
  if (change.add.length > 0) parts.push(`+${fmtPlates(change.add)}`)
  return parts.length > 0 ? parts.join(', ') : 'No change'
}

/** Owned plates per side as weight → count (one per side per pair). */
function inventory(plates: PlateSpec[]): Array<[number, number]> {
  return plates
    .filter(p => p.weight > 0 && p.pairs > 0)
    .map(p => [p.weight, Math.floor(p.pairs)] as [number, number])
    .sort((a, b) => b[0] - a[0])
}

/** Every ordered per-side stack (≤ maxLen plates, within inventory) whose weight is in [lo, hi] units. */
function stacksInRange(inv: Array<[number, number]>, lo: number, hi: number, maxLen: number): number[][] {
  const out: number[][] = []
  const used = new Map<number, number>()
  const walk = (stack: number[], total: number) => {
    if (total >= lo && total <= hi) out.push([...stack])
    if (stack.length >= maxLen) return
    const last = stack[stack.length - 1]
    for (const [w, n] of inv) {
      const next = total + u(w)
      if (next > hi || (used.get(w) ?? 0) >= n) continue
      // Change plates (≤ 5 lb) only go on the outside, heaviest first, one of each — two 5s
      // would just be a 10. Bigger plates can go in any order.
      if (last != null && last <= SMALL_PLATE && (w > SMALL_PLATE || w >= last)) continue
      if (w <= SMALL_PLATE && (used.get(w) ?? 0) >= 1) continue
      used.set(w, (used.get(w) ?? 0) + 1)
      stack.push(w)
      walk(stack, next)
      stack.pop()
      used.set(w, used.get(w)! - 1)
    }
  }
  walk([], 0)
  return out
}

/** Fewest plates (bounded by what's left in inventory) adding up to `target` units, or null. */
function fewestPlates(inv: Array<[number, number]>, used: number[], target: number): number[] | null {
  // 0/1 knapsack over individual plates, minimising plate count.
  const items: number[] = []
  for (const [w, n] of inv) {
    const left = n - used.filter(x => x === w).length
    for (let k = 0; k < left; k++) items.push(w)
  }
  const INF = 1e9
  const best = new Array<number>(target + 1).fill(INF)
  best[0] = 0
  const took = items.map(() => new Uint8Array(target + 1))
  items.forEach((w, i) => {
    const step = u(w)
    for (let v = target; v >= step; v--) {
      if (best[v - step] + 1 < best[v]) { best[v] = best[v - step] + 1; took[i][v] = 1 }
    }
  })
  if (best[target] >= INF) return null
  const out: number[] = []
  for (let i = items.length - 1, v = target; i >= 0 && v > 0; i--) {
    if (took[i][v]) { out.push(items[i]); v -= u(items[i]) }
  }
  return out
}

type Cost = [moves: number, plates: number, deviation: number]
const less = (a: Cost, b: Cost) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2] - 1e-9
const add = (a: Cost, b: Cost): Cost => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/**
 * Plan warmup plates for a barbell lift. `ideals` are the ramp's target weights (lbs).
 * Returns null when the working weight can't be loaded or some warmup has no loadable
 * weight in its window — callers then keep their plain snapped weights.
 */
export function planPlateLoading(
  barWeight: number,
  plates: PlateSpec[],
  ideals: number[],
  workingLoad: number,
  tolerance = DEFAULT_WARMUP_TOLERANCE,
): PlateLoadingPlan | null {
  const inv = inventory(plates)
  const workPerSide = u((workingLoad - barWeight) / 2)
  if (workPerSide < 0 || ideals.length === 0) return null
  if (!fewestPlates(inv, [], workPerSide)) return null

  const slack = tolerance * workingLoad
  const slots = ideals.map(ideal => {
    const lo = Math.max(barWeight, ideal - slack)
    const hi = Math.min(ideal + slack, workingLoad * WARMUP_CEILING)
    if (hi < lo) return []
    return stacksInRange(inv, u(Math.max(0, (lo - barWeight) / 2)), Math.floor(((hi - barWeight) / 2) * UNIT + 1e-9), MAX_WARMUP_PLATES)
      .map(stack => ({ stack, load: barWeight + 2 * sum(stack), dev: 0 }))
      .map(c => ({ ...c, dev: Math.abs(c.load - ideal) }))
  })
  if (slots.some(s => s.length === 0)) return null

  // DP over slots: best cost to reach each candidate, loads strictly increasing.
  type Node = { stack: number[]; load: number; cost: Cost; prev: Node | null }
  let layer: Node[] = slots[0].map(c => ({
    stack: c.stack, load: c.load, prev: null,
    cost: [c.stack.length, c.stack.length, c.dev],
  }))
  for (let i = 1; i < slots.length; i++) {
    const next: Node[] = []
    for (const c of slots[i]) {
      let bestNode: Node | null = null
      for (const p of layer) {
        if (c.load <= p.load) continue
        const cost = add(p.cost, [moves(p.stack, c.stack), c.stack.length, c.dev])
        if (!bestNode || less(cost, bestNode.cost)) bestNode = { stack: c.stack, load: c.load, cost, prev: p }
      }
      if (bestNode) next.push(bestNode)
    }
    if (next.length === 0) return null
    layer = next
  }

  // Finish at the working weight: keep the longest useful prefix of the last warmup's stack.
  const fills = new Map<string, number[] | null>()
  const fillFor = (prefix: number[], rest: number) => {
    const key = `${[...prefix].sort((a, b) => a - b).join(',')}|${rest}`
    if (!fills.has(key)) fills.set(key, fewestPlates(inv, prefix, rest))
    return fills.get(key)!
  }
  let best: { node: Node; working: number[]; cost: Cost } | null = null
  for (const node of layer) {
    for (let k = node.stack.length; k >= 0; k--) {
      const prefix = node.stack.slice(0, k)
      const rest = workPerSide - u(sum(prefix))
      if (rest < 0) continue
      const fill = fillFor(prefix, rest)
      if (!fill) continue
      const working = [...prefix, ...[...fill].sort((a, b) => b - a)]
      const cost = add(node.cost, [node.stack.length - k + fill.length, 0, 0])
      if (!best || less(cost, best.cost)) best = { node, working, cost }
    }
  }
  if (!best) return null

  const chain: Node[] = []
  for (let n: Node | null = best.node; n; n = n.prev) chain.unshift(n)
  const warmups = chain.map((n, i) => ({
    load: n.load,
    perSide: n.stack,
    change: plateChange(i === 0 ? [] : chain[i - 1].stack, n.stack),
  }))
  return {
    warmups,
    working: { perSide: best.working, change: plateChange(best.node.stack, best.working) },
    moves: best.cost[0],
  }
}
