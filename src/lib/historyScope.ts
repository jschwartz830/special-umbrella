import type { Plan, HistoryEntry, ExtraWorkoutEntry } from '../types'

export function getPlansWithHistory(
  plans: Record<string, Plan>,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
): Plan[] {
  return Object.values(plans).filter(plan =>
    entries.some(e => e.planId === plan.id) || extras.some(e => e.planId === plan.id),
  )
}

export function hasPlanHistory(
  planId: string | null,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
): boolean {
  if (!planId) return false
  return entries.some(e => e.planId === planId) || extras.some(e => e.planId === planId)
}
