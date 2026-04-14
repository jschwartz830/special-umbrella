import { format } from 'date-fns'
import { useHistoryStore } from '../store/historyStore'
import type { WorkoutType } from '../types'

export function usePlanActions(planId: string | null) {
  const logAction = useHistoryStore(s => s.logAction)
  const logOverride = useHistoryStore(s => s.logOverride)
  const today = format(new Date(), 'yyyy-MM-dd')

  function complete(planDayIndex: number, notes?: string) {
    if (!planId) return
    logAction(planId, today, planDayIndex, 'complete', notes)
  }

  function skip(planDayIndex: number) {
    if (!planId) return
    logAction(planId, today, planDayIndex, 'skip')
  }

  function dayOff() {
    if (!planId) return
    logAction(planId, today, -1, 'day_off')
  }

  function advance() {
    if (!planId) return
    logOverride(planId, 'advance', { delta: 1 })
  }

  function goBack() {
    if (!planId) return
    logOverride(planId, 'go_back', { delta: -1 })
  }

  function jumpTo(targetDayIndex: number) {
    if (!planId) return
    logOverride(planId, 'jump', { targetDayIndex })
  }

  function swapSlot(slotId: string, newSlotType: WorkoutType) {
    if (!planId) return
    logOverride(planId, 'swap_slot', { slotId, newSlotType })
  }

  return { complete, skip, dayOff, advance, goBack, jumpTo, swapSlot }
}
