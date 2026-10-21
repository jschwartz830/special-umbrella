import { describe, it, expect } from 'vitest'
import { upgradeLegacyWeeklyPlan } from '../upgradeLegacyPlans'
import { parseYamlProgram } from '../../engine/programParser'
import { getTodayResolvedDay, getUpcomingDays } from '../../engine/rotationEngine'
import { PROGRAM_TEMPLATES } from '../../programs'
import type { HistoryEntry, OverrideEntry, Plan } from '../../types'

const template = parseYamlProgram(PROGRAM_TEMPLATES.find(t => t.id === 'hybrid-12w-strength-run-swim')!.yaml).plan

// How the template used to be imported: every week spelled out in one rotation
function legacyPlan(startDate: string): Plan {
  const days = Array.from({ length: template.duration.value }, (_, w) =>
    template.days.map(d => ({ ...d, label: `W${w + 1} · ${d.label}` }))).flat()
  return {
    ...template, id: 'p', status: 'active', startDate, startDayIndex: 0, createdAt: '', updatedAt: '', days,
    programMeta: { version: 1, vars: { ...template.programMeta!.vars, squat: 165 } },
  }
}
const log = (date: string, idx: number): HistoryEntry =>
  ({ id: date, planId: 'p', calendarDate: date, planDayIndex: idx, action: 'complete', createdAt: date })

describe('upgradeLegacyWeeklyPlan', () => {
  it('converts mid-week 1 in place: same id, Wed keeps Strength B, logs keep what was scheduled', () => {
    const plan = legacyPlan('2026-10-19')
    const entries = [log('2026-10-19', 0), log('2026-10-20', 1)]
    const r = upgradeLegacyWeeklyPlan(plan, template, entries, [], [], '2026-10-21')!

    expect(r.plan.id).toBe('p')
    expect(r.plan.days).toHaveLength(7)
    expect(r.plan.programMeta?.weekly).toBe(true)
    expect(r.plan.programMeta?.vars.squat).toBe(165)
    expect(r.plan.startDate).toBe('2026-10-19')
    expect(r.entries.map(e => e.planDayIndex)).toEqual([0, 1])
    expect(r.entries[0].workout?.dayLabel).toBe('W1 · Mon — Strength A')

    const today = getTodayResolvedDay(r.plan, r.entries, r.overrides, '2026-10-21', r.extraEntries)
    expect(today.planDay.label).toBe('Wed — Strength B')
    // Do Later on Wednesday → Thursday run, Friday Strength B
    const off: HistoryEntry = { id: 'off', planId: 'p', calendarDate: '2026-10-21', action: 'day_off', createdAt: '2026-10-21' }
    const defer: OverrideEntry = { id: 'd', planId: 'p', type: 'defer', targetDayIndex: 2, appliedAt: '2026-10-21T07:00:00' }
    const next = getUpcomingDays(r.plan, [...r.entries, off], [defer], '2026-10-21', 2, r.extraEntries)
    expect(next.map(d => d.planDay.label)).toEqual(['Thu — Easy Run + Mobility', 'Wed — Strength B'])
  })

  it('anchors later weeks on where the rotation stands, folding indices onto one week', () => {
    // 16 straight days logged from Oct 5 → today Oct 21 is old index 16 (W3 Wed)
    const entries = Array.from({ length: 16 }, (_, i) => log(`2026-10-${String(5 + i).padStart(2, '0')}`, i))
    const r = upgradeLegacyWeeklyPlan(legacyPlan('2026-10-05'), template, entries, [], [], '2026-10-21')!
    expect(r.plan.startDate).toBe('2026-10-05')
    expect(r.entries[15].planDayIndex).toBe(1)
    expect(getTodayResolvedDay(r.plan, r.entries, [], '2026-10-21').planDay.label).toBe('Wed — Strength B')
  })

  it('leaves other plans alone and is idempotent', () => {
    const edited = legacyPlan('2026-10-19')
    edited.days = edited.days.map((d, i) => (i === 3 ? { ...d, label: 'My own day' } : d))
    expect(upgradeLegacyWeeklyPlan(edited, template, [], [], [], '2026-10-21')).toBeNull()

    const r = upgradeLegacyWeeklyPlan(legacyPlan('2026-10-19'), template, [], [], [], '2026-10-21')!
    expect(upgradeLegacyWeeklyPlan(r.plan, template, r.entries, [], [], '2026-10-21')).toBeNull()
  })
})
