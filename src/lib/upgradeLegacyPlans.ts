// ── One-time upgrade: spelled-out weekly templates → weekly programs ──────────
// Before weekly programs existed, a template like the Hybrid 12-week was imported
// as every week spelled out ("W1 · Mon — …" through "W12 · Sun — …") in one strict
// rotation. When the template is now a weekly program, convert such a plan in place:
// same id (history, outcomes and lift weights stay attached), the template's one
// week of days + schedule + deloads, and logged day indices folded onto that week.
// The program week is anchored so today keeps the session it shows now.

import { addDays, format, parseISO } from 'date-fns'
import type { ExtraWorkoutEntry, HistoryEntry, OverrideEntry, Plan } from '../types'
import { parseYamlProgram } from '../engine/programParser'
import { getTodayResolvedDay } from '../engine/rotationEngine'
import { snapshotPlanDay } from './planDayUtils'
import { PROGRAM_TEMPLATES } from '../programs'
import { usePlanStore } from '../store/planStore'
import { useHistoryStore } from '../store/historyStore'
import { useProgramStore } from '../store/programStore'

type Template = ReturnType<typeof parseYamlProgram>['plan']

export interface LegacyUpgrade {
  plan: Plan
  entries: HistoryEntry[]
  extraEntries: ExtraWorkoutEntry[]
  overrides: OverrideEntry[]
}

/** True when `plan` is `template`'s week repeated once per program week, labelled "W<n> · <day label>". */
function isSpelledOutVersionOf(plan: Plan, template: Template): boolean {
  const week = template.days.length
  if (!template.programMeta?.weekly || plan.programMeta?.weekly || plan.name !== template.name) return false
  if (week === 0 || plan.days.length !== week * template.duration.value) return false
  return plan.days.every((d, i) => d.label === `W${Math.floor(i / week) + 1} · ${template.days[i % week].label}`)
}

/** Pure: the converted plan and its re-indexed logs, or null when the plan isn't a spelled-out weekly template. */
export function upgradeLegacyWeeklyPlan(
  plan: Plan,
  template: Template,
  entries: HistoryEntry[],
  extraEntries: ExtraWorkoutEntry[],
  overrides: OverrideEntry[],
  today: string,
): LegacyUpgrade | null {
  if (!isSpelledOutVersionOf(plan, template)) return null
  const week = template.days.length
  const fold = (i: number | undefined) => (i == null ? i : i % week)

  // Where the old rotation stands today → the date its "W1 · Mon" would have fallen on
  const current = plan.status === 'active' ? getTodayResolvedDay(plan, entries, overrides, today, extraEntries).planDayIndex : 0
  const startDate = plan.status === 'active' ? format(addDays(parseISO(today), -current), 'yyyy-MM-dd') : plan.startDate

  const upgraded: Plan = {
    ...plan,
    description: template.description,
    days: template.days,
    duration: template.duration,
    programMeta: { ...template.programMeta!, vars: { ...template.programMeta!.vars, ...plan.programMeta?.vars } },
    startDate,
    startDayIndex: 0,
    updatedAt: new Date().toISOString(),
  }

  return {
    plan: upgraded,
    // Keep what was actually scheduled (old labels and all) on each log before re-indexing
    entries: entries.map(e => e.planId !== plan.id ? e : {
      ...e,
      planDayIndex: fold(e.planDayIndex),
      ...(e.workout || e.planDayIndex == null ? {} : { workout: snapshotPlanDay(plan, e.planDayIndex, e.calendarDate) }),
    }),
    extraEntries: extraEntries.map(x => x.planId !== plan.id || x.planDayIndex == null ? x : { ...x, planDayIndex: fold(x.planDayIndex) }),
    overrides: overrides.map(o => o.planId !== plan.id || o.targetDayIndex == null ? o : { ...o, targetDayIndex: fold(o.targetDayIndex) }),
  }
}

/** Convert any spelled-out weekly-template plans in the stores. Idempotent; run after cloud sync. */
export function upgradeLegacyPlans(today = format(new Date(), 'yyyy-MM-dd')): void {
  const templates = PROGRAM_TEMPLATES.map(t => parseYamlProgram(t.yaml).plan).filter(t => t.programMeta?.weekly)
  for (const plan of Object.values(usePlanStore.getState().plans)) {
    const template = templates.find(t => t.name === plan.name)
    if (!template) continue
    const { entries, extraEntries, overrides } = useHistoryStore.getState()
    const result = upgradeLegacyWeeklyPlan(plan, template, entries, extraEntries, overrides, today)
    if (!result) continue
    useHistoryStore.setState({ entries: result.entries, extraEntries: result.extraEntries, overrides: result.overrides })
    usePlanStore.setState(s => ({ plans: { ...s.plans, [plan.id]: result.plan } }))
    useProgramStore.getState().initVars(plan.id, result.plan.programMeta!.vars)
  }
}
