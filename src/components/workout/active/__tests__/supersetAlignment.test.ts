import { describe, it, expect } from 'vitest'
import { findSupersetMisalignments, conformSuperset, rampLoads } from '../supersetAlignment'
import { findNextSet, type SetTrackState } from '../trackerHelpers'

const set = (patch: Partial<SetTrackState> = {}): SetTrackState => ({
  setElapsedSeconds: 0, completed: false, actualReps: 5, actualLoad: 185, targetReps: 5, targetLoad: null,
  restSeconds: 120, actualRestSeconds: null, resolvedLoadLbs: 185, ...patch,
})
const warm = (load: number, completed = false) => set({ isWarmup: true, actualLoad: load, resolvedLoadLbs: load, completed })
const ex = (exercise: string, sets: SetTrackState[], supersetGroupId = 'g') => ({ exercise, sets, supersetGroupId })
const snap5 = () => (lbs: number) => Math.round(lbs / 5) * 5

describe('findSupersetMisalignments', () => {
  it('is empty when members match, or for single-member groups', () => {
    expect(findSupersetMisalignments([ex('A', [warm(95), set()]), ex('B', [warm(45), set()])])).toEqual([])
    expect(findSupersetMisalignments([ex('A', [set()]), ex('B', [set(), set()], 'other')])).toEqual([])
  })

  it('flags warmup and working-set mismatches with options both ways', () => {
    const [m] = findSupersetMisalignments([
      ex('Squat', [warm(95), warm(135), set(), set(), set()]),
      ex('Pull-ups', [set(), set()]),
    ])
    expect(m.warmups).toEqual([2, 0])
    expect(m.working).toEqual([3, 2])
    expect(m.summary).toEqual([
      'Squat: 2 warmups · Pull-ups: 0 warmups',
      'Squat: 3 working sets · Pull-ups: 2 working sets',
    ])
    expect(m.options.map(o => [o.part, o.target])).toEqual([
      ['warmups', 2], ['warmups', 0], ['working', 3], ['working', 2],
    ])
  })

  it('does not offer trimming below sets already done', () => {
    const [m] = findSupersetMisalignments([
      ex('A', [warm(95, true), warm(135, true), set()]),
      ex('B', [warm(45), set()]),
    ])
    expect(m.options.map(o => o.target)).toEqual([2])
  })
})

describe('conformSuperset', () => {
  it('adds an evenly spaced warmup ramp to a member with none', () => {
    const out = conformSuperset([ex('Squat', [warm(95), warm(135), set()]), ex('Row', [set({ actualLoad: 100, resolvedLoadLbs: 100 })])],
      'g', { part: 'warmups', target: 2 }, snap5)
    expect(out[1].sets.filter(s => s.isWarmup).map(s => s.actualLoad)).toEqual([40, 85])
    expect(findSupersetMisalignments(out)).toEqual([])
  })

  it('fills between finished warmups and the working weight', () => {
    const out = conformSuperset([ex('A', [warm(95, true), set({ actualLoad: 185 })]), ex('B', [warm(45), warm(65), warm(85), set()])],
      'g', { part: 'warmups', target: 3 }, snap5)
    expect(out[0].sets.map(s => [s.isWarmup ?? false, s.actualLoad])).toEqual([
      [true, 95], [true, 125], [true, 155], [false, 185],
    ])
  })

  it('trims the lightest unfinished warmups and trailing unfinished working sets', () => {
    const groups = [ex('A', [warm(45), warm(95), warm(135), set(), set(), set()]), ex('B', [warm(20), set(), set()])]
    const w = conformSuperset(groups, 'g', { part: 'warmups', target: 1 }, snap5)
    expect(w[0].sets.filter(s => s.isWarmup).map(s => s.actualLoad)).toEqual([135])
    const s = conformSuperset(w, 'g', { part: 'working', target: 2 }, snap5)
    expect(s.map(e => e.sets.filter(x => !x.isWarmup).length)).toEqual([2, 2])
  })

  it('adds working sets copied from the last one, unfinished', () => {
    const out = conformSuperset([ex('A', [set({ completed: true }), set()]), ex('B', [set({ actualLoad: 50, completed: true })])],
      'g', { part: 'working', target: 2 }, snap5)
    expect(out[1].sets).toHaveLength(2)
    expect(out[1].sets[1]).toMatchObject({ actualLoad: 50, completed: false })
  })

  it('leaves other groups alone, and the aligned superset alternates cleanly', () => {
    const other = ex('C', [set()], 'h')
    const out = conformSuperset([ex('A', [warm(95), warm(135), set(), set()]), ex('B', [set()]), other],
      'g', { part: 'warmups', target: 2 }, snap5)
    expect(out[2]).toBe(other)
    const aligned = conformSuperset(out, 'g', { part: 'working', target: 2 }, snap5)
    const order: string[] = []
    for (let i = 0; i < 8; i++) {
      const next = findNextSet(aligned.slice(0, 2))!
      const s = aligned[next.exIdx].sets[next.setIdx]
      order.push(`${aligned[next.exIdx].exercise}${s.isWarmup ? 'w' : ''}`)
      s.completed = true
    }
    expect(order).toEqual(['Aw', 'Bw', 'Aw', 'Bw', 'A', 'B', 'A', 'B'])
  })
})

describe('rampLoads', () => {
  it('spreads 40–85% and handles bodyweight', () => {
    expect(rampLoads(200, 3, x => x)).toEqual([80, 125, 170])
    expect(rampLoads(200, 1, x => x)).toEqual([120])
    expect(rampLoads(null, 2, x => x)).toEqual([null, null])
  })
})
