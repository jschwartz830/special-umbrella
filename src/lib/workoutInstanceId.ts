/**
 * workoutInstanceId format: `${planId}_${calendarDate}[_extra_${extraId}]`
 * where calendarDate is always YYYY-MM-DD.
 *
 * The custom nanoid in lib/utils uses base-36 (0-9, a-z) so current IDs
 * never include '_', but all helpers here are written defensively so the
 * format remains correct even if the ID alphabet changes in the future.
 */

/** Build the workoutInstanceId for a rotation-day workout */
export function makeWorkoutInstanceId(planId: string, calendarDate: string): string {
  return `${planId}_${calendarDate}`
}

/** Build the workoutInstanceId for an extra (ad-hoc) workout entry */
export function makeExtraWorkoutInstanceId(
  planId: string,
  calendarDate: string,
  extraId: string,
): string {
  return `${planId}_${calendarDate}_extra_${extraId}`
}

/**
 * Parse planId and calendarDate from a workoutInstanceId string.
 *
 * Splitting naively on '_' is fragile when planIds contain underscores.
 * This helper locates the date by regex and derives planId from the
 * separator position so the parser remains correct even if the ID
 * alphabet changes in the future.
 */
export function parseWorkoutInstanceId(
  instanceId: string,
): { planId: string; calendarDate: string } | null {
  const dateMatch = instanceId.match(/(\d{4}-\d{2}-\d{2})/)
  if (!dateMatch) return null
  const calendarDate = dateMatch[1]
  const sep = instanceId.indexOf(`_${calendarDate}`)
  if (sep === -1) return null
  return { planId: instanceId.slice(0, sep), calendarDate }
}

/**
 * Parse planId, calendarDate, and extraId from an extra workout instanceId.
 * Format: `${planId}_${calendarDate}_extra_${extraId}`
 *
 * Returns null if the instanceId is not an extra workout instance (i.e. does
 * not contain `_extra_` after the date segment).
 */
export function parseExtraWorkoutInstanceId(
  instanceId: string,
): { planId: string; calendarDate: string; extraId: string } | null {
  const base = parseWorkoutInstanceId(instanceId)
  if (!base) return null
  const extraMarker = `${base.planId}_${base.calendarDate}_extra_`
  if (!instanceId.startsWith(extraMarker)) return null
  const extraId = instanceId.slice(extraMarker.length)
  if (!extraId) return null
  return { ...base, extraId }
}
