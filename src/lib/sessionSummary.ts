import type { HistoryEntry } from '../types'
import { formatPace, formatSwimPace } from '../modules/workout-outcomes/types'
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
 * - Run:     "Last: 2.5 mi · 28 min · 9:02 /mi"
 * - Swim:    "Last: 800 m · 30 min · 2:30 /100m"
 *
 * Pace (run) and pace (swim) are shown from the stored field when present and
 * > 0; otherwise derived from distance + duration when both are available.
 * A stored value of 0 is treated as bad data and triggers derivation.
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
    // Stored pace takes priority. A stored value of 0 is bad data — fall back to deriving
    // from distance+duration (same as when pace is absent). "0:00 /mi" is never displayed.
    const storedPace = run.averagePaceSecondsPerMile != null && run.averagePaceSecondsPerMile > 0
      ? run.averagePaceSecondsPerMile
      : null
    const derivedPace = storedPace == null &&
      run.actualDistanceMiles != null && run.actualDistanceMiles > 0 &&
      run.actualDurationMin != null && run.actualDurationMin > 0
        ? (run.actualDurationMin * 60) / run.actualDistanceMiles
        : null
    const pace = storedPace ?? derivedPace
    if (pace != null) parts.push(formatPace(pace))
    if (parts.length) return `Last: ${parts.join(' · ')}`
  }
  // Swim: distance, duration, and pace when available (derivation mirrors run)
  const swim = outcome.swimActual
  if (swim) {
    const parts: string[] = []
    if (swim.actualDistanceMeters != null) parts.push(`${Math.round(swim.actualDistanceMeters)} m`)
    if (swim.actualDurationMin != null) parts.push(`${swim.actualDurationMin} min`)
    const storedSwimPace = swim.averagePaceSecondsPer100m != null && swim.averagePaceSecondsPer100m > 0
      ? swim.averagePaceSecondsPer100m
      : null
    const derivedSwimPace = storedSwimPace == null &&
      swim.actualDistanceMeters != null && swim.actualDistanceMeters > 0 &&
      swim.actualDurationMin != null && swim.actualDurationMin > 0
        ? (swim.actualDurationMin * 60) / (swim.actualDistanceMeters / 100)
        : null
    const swimPace = storedSwimPace ?? derivedSwimPace
    if (swimPace != null) parts.push(formatSwimPace(swimPace))
    if (parts.length) return `Last: ${parts.join(' · ')}`
  }
  return null
}
