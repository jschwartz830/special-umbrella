import { describe, it, expect } from 'vitest'
import { planPlateLoading, plateChange, describePlateChange } from '../plateLoading'
import { DEFAULT_EQUIPMENT } from '../equipment'

const gym = DEFAULT_EQUIPMENT.gym
const home = DEFAULT_EQUIPMENT.home
const loads = (p: ReturnType<typeof planPlateLoading>) => p?.warmups.map(w => w.load)

describe('plateChange / describePlateChange', () => {
  it('strips outer plates until the stacks share a base, then adds', () => {
    expect(plateChange([25, 10], [25, 35])).toEqual({ remove: [10], add: [35] })
    expect(plateChange([25], [25, 10])).toEqual({ remove: [], add: [10] })
    expect(plateChange([10, 25], [25])).toEqual({ remove: [25, 10], add: [25] })
    expect(describePlateChange({ remove: [10], add: [35] }, [25, 35])).toBe('−10s, +35s')
    expect(describePlateChange({ remove: [], add: [45, 45] }, [45, 45])).toBe('+2×45s')
    expect(describePlateChange({ remove: [], add: [] }, [])).toBe('Empty bar')
  })
})

describe('planPlateLoading', () => {
  it('never needs more plate moves than the plain snapped ramp', () => {
    // 185 working, ideals 92.5 / 137.5: plain snapping is 95 → 135 → 185 as well, but must
    // not exceed it; a 75 (10 + 5) style warmup is avoided.
    const p = planPlateLoading(45, gym.plates, [92.5, 137.5], 185)!
    expect(loads(p)).toEqual([95, 135])
    expect(p.moves).toBe(4)
  })

  it('prefers one plate to a 10 + 5 for a light warmup', () => {
    const p = planPlateLoading(45, home.plates, [47.5, 72.5], 95)!
    expect(loads(p)).toEqual([45, 65])
    expect(p.warmups.map(w => describePlateChange(w.change, w.perSide))).toEqual(['Empty bar', '+10s'])
    expect(describePlateChange(p.working.change, p.working.perSide)).toBe('+10s + 5s')
  })

  it('stacks additively when the window allows: 115 → 185 → 205 → 255', () => {
    const p = planPlateLoading(45, gym.plates, [120, 180, 225], 255)!
    expect(loads(p)).toEqual([115, 185, 205])
    expect(p.warmups.every(w => w.change.remove.length === 0)).toBe(true)
    expect(p.working.change.remove).toEqual([])
    expect(45 + 2 * p.working.perSide.reduce((a, b) => a + b, 0)).toBe(255)
  })

  it('keeps every warmup within ±8% of the working weight of its target, increasing, and under 90%', () => {
    for (const [orm, w] of [[230, 185], [300, 255], [400, 315], [180, 135], [500, 405]]) {
      const ideals = [0.4, 0.6, 0.75].map(x => orm * x).filter(x => x <= w * 0.9 + 0.08 * w)
      const p = planPlateLoading(45, gym.plates, ideals, w)
      if (!p) continue
      p.warmups.forEach((x, i) => {
        expect(Math.abs(x.load - ideals[i])).toBeLessThanOrEqual(0.08 * w + 1e-9)
        expect(x.load).toBeLessThanOrEqual(w * 0.9)
        if (i > 0) expect(x.load).toBeGreaterThan(p.warmups[i - 1].load)
      })
    }
  })

  it('uses only plates you own', () => {
    // Home has one pair of 25s and one of 35s.
    const p = planPlateLoading(45, home.plates, [160, 240], 315)!
    for (const w of [...p.warmups.map(x => x.perSide), p.working.perSide]) {
      expect(w.filter(x => x === 25).length).toBeLessThanOrEqual(1)
      expect(w.filter(x => x === 35).length).toBeLessThanOrEqual(1)
    }
  })

  it('is null when the working weight cannot be loaded', () => {
    expect(planPlateLoading(45, home.plates, [100], 1000)).toBeNull()
    expect(planPlateLoading(45, gym.plates, [], 185)).toBeNull()
  })
})
