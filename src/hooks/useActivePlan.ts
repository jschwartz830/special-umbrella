import { useMemo } from 'react'
import { usePlanStore } from '../store/planStore'
import { useHistoryStore } from '../store/historyStore'
import { getTodayResolvedDay, getUpcomingDays } from '../engine/rotationEngine'
import { useToday } from './useToday'
import type { ResolvedDay } from '../types'

export function useActivePlan() {
  const plans = usePlanStore(s => s.plans)
  const activePlanId = usePlanStore(s => s.activePlanId)
  const entries = useHistoryStore(s => s.entries)
  const overrides = useHistoryStore(s => s.overrides)
  const extraEntries = useHistoryStore(s => s.extraEntries)

  const today = useToday()
  const plan = activePlanId ? plans[activePlanId] ?? null : null

  const planEntries = useMemo(
    () => entries.filter(e => e.planId === activePlanId),
    [entries, activePlanId],
  )

  const planOverrides = useMemo(
    () => overrides.filter(o => o.planId === activePlanId),
    [overrides, activePlanId],
  )

  const todayResolved = useMemo<ResolvedDay | null>(() => {
    if (!plan) return null
    return getTodayResolvedDay(plan, planEntries, planOverrides, today, extraEntries)
  }, [plan, planEntries, planOverrides, today, extraEntries])

  const upcoming = useMemo<ResolvedDay[]>(() => {
    if (!plan) return []
    return getUpcomingDays(plan, planEntries, planOverrides, today, 7, extraEntries)
  }, [plan, planEntries, planOverrides, today, extraEntries])

  return { plan, todayResolved, upcoming, today, planEntries, planOverrides }
}
