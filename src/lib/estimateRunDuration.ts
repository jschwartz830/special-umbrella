/**
 * Estimate the planned duration (in minutes) for a run slot.
 *
 * Resolution order:
 *   1. slot.durationMin (explicit total duration)
 *   2. slot.runConfig.targetDurationMin (run-specific target)
 *   3. sum of segment-level durations/distances
 *   4. slot.runConfig.targetDistanceMiles × assumed pace
 *   5. 20 minutes (fallback when nothing is available)
 *
 * Pace assumptions by segment type:
 *   - tempo:         8 min/mi
 *   - warmup/cooldown: 12 min/mi
 *   - everything else: 11 min/mi
 *
 * Variable references in `seg.distance` (e.g. `BASE_MILES`) are substituted
 * from `programVars` before parsing. Unknown variables are left as-is, which
 * causes `parseFloat` to return NaN and the segment to be skipped.
 */
export function estimateRunDurationMin(
  slot: {
    durationMin?: number
    runConfig?: { targetDurationMin?: number | null; targetDistanceMiles?: number | null } | null
    segments?: Array<{ type?: string; duration?: string; distance?: string }>
  },
  programVars: Record<string, unknown> = {},
): number {
  if (slot.durationMin) return slot.durationMin
  if (slot.runConfig?.targetDurationMin) return slot.runConfig.targetDurationMin

  let totalMin = 0
  for (const seg of slot.segments ?? []) {
    if (seg.duration) {
      const mMatch = seg.duration.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/)
      if (mMatch) { totalMin += parseFloat(mMatch[1]); continue }
    }
    if (seg.distance) {
      const resolved = seg.distance.replace(/\b([a-zA-Z_]\w*)\b/g, (m: string) =>
        programVars[m] !== undefined ? String(programVars[m]) : m,
      )
      const miles = parseFloat(resolved)
      if (!isNaN(miles)) {
        const minPerMile = seg.type === 'tempo' ? 8 : seg.type === 'warmup' || seg.type === 'cooldown' ? 12 : 11
        totalMin += miles * minPerMile
      }
    }
  }
  if (totalMin > 0) return Math.ceil(totalMin)

  const dist = slot.runConfig?.targetDistanceMiles
  if (dist) return Math.ceil(dist * 11)

  return 20
}
