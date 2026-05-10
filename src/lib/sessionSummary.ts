import type { HistoryEntry } from '../types'
import { formatPace } from '../modules/workout-outcomes/types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

/**
 * Find the most recent completed outcome for a specific planDayIndex, excluding
 * today's date. Used by TodayPage to surface a "Last session" hint without
 * requiring the user to open the outcome modal.
 *
 * Only `complete` history entries are considered — skips and day_offs are ignored
 * because they have no associated weights/run/swim outcome.
 */
export function findPreviousSessionForPlanDay(
  planId: string,
  planDayIndex: number,
  currentDate: string,
  entries: HistoryEntry[],
  outcomes: Record<string, WorkoutOutcome>,
): WorkoutOutcome | null {
  const candidates = entries.filter(
    e =>
      e.planId === planId &&
      e.action === 'complete' &&
      e.planDayIndex === planDayIndex &&
      e.calendarDate !== currentDate,
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))
  for (const e of candidates) {
    const outcome = outcomes[`${planId}_${e.calendarDate}`]
    if (outcome) return outcome
  }
  return null
}

/**
 * Format a compact one-line summary of a previous workout outcome.
 *
 * - Weights: "Last: 3×8 @ 135 lb Bench Press [· PB]"
 * - Run:     "Last: 2.5 mi · 28 min"
 * - Swim:    "Last: 800 m · 30 min"
 *
 * Pass `maxLoadByExercise` (a map of exercise name → all-time max load in lb)
 * to enable personal-best detection. When the displayed load equals the map's
 * value, " · PB" is appended.
 *
 * Returns null when the outcome has no data worth surfacing.
 */
export function buildLastSessionSummary(
  outcome: WorkoutOutcome,
  maxLoadByExercise?: Record<string, number>,
): string | null {
  // Weights: first exercise with at least one actual set
  const ex = outcome.weightsActual?.exercises?.find(
    e => e.sets.some(s => s.actualReps != null || s.actualLoad != null),
  )
  if (ex) {
    const activeSets = ex.sets.filter(s => s.actualReps != null || s.actualLoad != null)
    if (activeSets.length > 0) {
      // Use heaviest set for display and PB comparison; fall back to first active set
      const setsWithLoad = activeSets.filter(s => s.actualLoad != null)
      const s = setsWithLoad.length > 0
        ? setsWithLoad.reduce((best, cur) => (cur.actualLoad! > best.actualLoad! ? cur : best))
        : activeSets[0]
      const sets = activeSets.length
      const reps = s.actualReps != null ? s.actualReps : s.targetReps
      const load = s.actualLoad != null ? `@ ${s.actualLoad} lb` : ''
      const isPB =
        maxLoadByExercise != null &&
        s.actualLoad != null &&
        maxLoadByExercise[ex.exercise] === s.actualLoad
      return `Last: ${sets}×${reps}${load ? ' ' + load : ''} ${ex.exercise}${isPB ? ' · PB' : ''}`
    }
  }
  // Run: distance, duration, and pace when available
  const run = outcome.runActual
  if (run) {
    const parts: string[] = []
    if (run.actualDistanceMiles != null) {
      const dist = Math.round(run.actualDistanceMiles * 10) / 10
      parts.push(`${dist} mi`)
    }
    if (run.actualDurationMin != null) parts.push(`${run.actualDurationMin} min`)
    if (run.averagePaceSecondsPerMile != null && run.averagePaceSecondsPerMile > 0) parts.push(formatPace(run.averagePaceSecondsPerMile))
    if (parts.length) return `Last: ${parts.join(' · ')}`
  }
  // Swim: distance and/or duration
  const swim = outcome.swimActual
  if (swim) {
    const parts: string[] = []
    if (swim.actualDistanceMeters != null) parts.push(`${Math.round(swim.actualDistanceMeters)} m`)
    if (swim.actualDurationMin != null) parts.push(`${swim.actualDurationMin} min`)
    if (parts.length) return `Last: ${parts.join(' · ')}`
  }
  return null
}
