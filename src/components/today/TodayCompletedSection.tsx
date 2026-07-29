import { CheckCircle2, ChevronRight } from 'lucide-react'
import type { DayStatus, ExtraWorkoutEntry, PlanDay } from '../../types'
import { SwipeToDelete } from '../shared/SwipeToDelete'

interface TodayCompletedSectionProps {
  status: DayStatus
  primaryPlanDay: PlanDay
  todayExtras: ExtraWorkoutEntry[]
  onEditOutcome: () => void
  onEditExtra: (extra: ExtraWorkoutEntry) => void
  onDeleteExtra: (extra: ExtraWorkoutEntry) => void
}

export function TodayCompletedSection({
  status,
  primaryPlanDay,
  todayExtras,
  onEditOutcome,
  onEditExtra,
  onDeleteExtra,
}: TodayCompletedSectionProps) {
  if (status !== 'today_complete' && todayExtras.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Completed today</h2>
      {status === 'today_complete' && (
        <button
          onClick={onEditOutcome}
          className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors active:scale-[0.99]"
        >
          <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-200 font-medium truncate">{primaryPlanDay.label}</p>
            {primaryPlanDay.slots.length > 0 && (
              <p className="text-xs text-emerald-300/70 mt-0.5 truncate">
                {primaryPlanDay.slots.map(s => s.name).join(' + ')}
              </p>
            )}
          </div>
          <ChevronRight size={14} className="text-emerald-400/60 flex-shrink-0 mt-1" />
        </button>
      )}
      {todayExtras.map(extra => (
        <SwipeToDelete
          key={extra.id}
          onDelete={() => onDeleteExtra(extra)}
        >
          <button
            onClick={() => onEditExtra(extra)}
            className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors active:scale-[0.99]"
          >
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-emerald-200 font-medium truncate">{extra.workoutName}</p>
              <p className="text-xs text-emerald-300/70 mt-0.5 truncate capitalize">
                {extra.workoutType.replace(/_/g, ' ')}
              </p>
            </div>
            <ChevronRight size={14} className="text-emerald-400/60 flex-shrink-0 mt-1" />
          </button>
        </SwipeToDelete>
      ))}
    </section>
  )
}
