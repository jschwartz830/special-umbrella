import { useState } from 'react'
import { Play, ChevronDown, ChevronUp } from 'lucide-react'
import type { PlanDay, WorkoutSlot } from '../../types'
import type { WorkoutMeta } from '../../lib/constants'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'
import { WorkoutSlotDetails } from '../workout/WorkoutSlotDetails'
import { isRunType } from '../../modules/workout-metadata/types'

interface TodayPendingCardProps {
  planId: string
  primaryPlanDay: PlanDay
  primarySlotMeta: WorkoutMeta | null
  totalExercises: number
  estimatedDurationMin: number | null
  todaySessionCount: number | undefined
  activeWorkoutHidden: boolean
  onStartWorkout: () => void
  lastSessionSummary: string | null
  prevSessionOutcome: WorkoutOutcome | null
  prevSessionDaysAgo: number | null
  todayRunSlot: WorkoutSlot | null
}

export function TodayPendingCard({
  planId,
  primaryPlanDay,
  primarySlotMeta,
  totalExercises,
  estimatedDurationMin,
  todaySessionCount,
  activeWorkoutHidden,
  onStartWorkout,
  lastSessionSummary,
  prevSessionOutcome,
  prevSessionDaysAgo,
  todayRunSlot,
}: TodayPendingCardProps) {
  const [previewExpanded, setPreviewExpanded] = useState(false)

  return (
    <div className={`rounded-xl border bg-slate-800/80 overflow-hidden ${primarySlotMeta ? `border-l-4 ${primarySlotMeta.borderColor} border-slate-700/50` : 'border-slate-700/50'}`}>
      <div className="p-4 space-y-2">
        {/* Today label + title */}
        <div>
          <p className="text-[10px] font-medium text-sky-400 uppercase tracking-wider mb-0.5">Today</p>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200">{primaryPlanDay.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {primarySlotMeta?.label ?? 'Workout'}
                {totalExercises > 0 && ` · ${totalExercises} exercise${totalExercises === 1 ? '' : 's'}`}
                {estimatedDurationMin != null && ` · ~${estimatedDurationMin} min`}
                {todaySessionCount !== undefined && todaySessionCount > 0 && (
                  <span className="text-slate-500"> · ×{todaySessionCount} done</span>
                )}
              </p>
            </div>
            {activeWorkoutHidden && (
              <button
                onClick={onStartWorkout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs transition-colors active:scale-[0.98] flex-shrink-0"
              >
                <Play size={13} />
                Start
              </button>
            )}
          </div>
        </div>

        {/* Last session hint */}
        {(lastSessionSummary || (prevSessionOutcome?.progressionRecommendation?.action === 'progress' && !todayRunSlot)) && (
          <div className="space-y-0.5">
            {lastSessionSummary && (
              <p className="text-xs text-slate-500 truncate">
                {lastSessionSummary.endsWith(' · PB')
                  ? <>{lastSessionSummary.slice(0, -5)}<span className="text-amber-400 font-medium"> · PB</span></>
                  : lastSessionSummary}
                {prevSessionDaysAgo !== null && (
                  <span className="text-slate-600 ml-1">
                    · {prevSessionDaysAgo === 1 ? 'yesterday' : `${prevSessionDaysAgo}d ago`}
                  </span>
                )}
              </p>
            )}
            {prevSessionOutcome?.notes && (
              <p className="text-xs text-slate-600 italic truncate">"{prevSessionOutcome.notes}"</p>
            )}
            {!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.action === 'progress' && (
              <p className="text-xs text-sky-700 truncate">↗ {prevSessionOutcome.progressionRecommendation.note}</p>
            )}
          </div>
        )}

        {/* Preview exercises toggle */}
        {primaryPlanDay.slots.some(s => (s.exercises?.length ?? 0) > 0 || isRunType(s.type)) && (
          <button
            onClick={() => setPreviewExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {previewExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {previewExpanded ? 'Hide exercises' : 'Preview exercises'}
          </button>
        )}
      </div>

      {/* Expanded exercise list */}
      {previewExpanded && (
        <div className={`border-t border-slate-700/50 px-4 py-3 space-y-3 ${primaryPlanDay.slots.length > 1 ? 'divide-y divide-slate-700/50' : ''}`}>
          {primaryPlanDay.slots.map((slot, i) => (
            <div key={slot.id} className={i > 0 ? 'pt-3' : ''}>
              <WorkoutSlotDetails slot={slot} planId={planId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
