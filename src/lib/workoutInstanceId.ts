/**
 * Parse planId and calendarDate from a workoutInstanceId string.
 *
 * workoutInstanceId format: `${planId}_${calendarDate}[_extra_${extraId}]`
 * where calendarDate is always YYYY-MM-DD.
 *
 * Splitting naively on '_' is fragile because nanoid's default alphabet
 * includes '_', so planIds can legitimately contain it.  This helper
 * locates the date by regex and derives planId from the separator position.
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
