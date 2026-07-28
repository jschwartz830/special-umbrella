import { TrendingUp } from 'lucide-react'
import type { ResolvedDay } from '../../types'
import type { RunProgressionState } from '../../modules/run-adaptation/types'
import { WorkoutDayCard } from '../workout/WorkoutDayCard'
import { resolveWorkoutDisplayTarget } from '../../modules/run-adaptation/selectors'
import { isRunType } from '../../modules/workout-metadata/types'

interface TodayUpcomingListProps {
  upcoming: ResolvedDay[]
  extraIsNextInPlan: boolean
  planId: string | undefined
  getProgressionState: (progressionGroupId: string) => RunProgressionState | null
  upcomingSessionCounts: Record<string, number>
  upcomingSessionSummaries: Record<string, string | null>
  onSelectUpcoming: (rd: ResolvedDay) => void
}

export function TodayUpcomingList({
  upcoming,
  extraIsNextInPlan,
  planId,
  getProgressionState,
  upcomingSessionCounts,
  upcomingSessionSummaries,
  onSelectUpcoming,
}: TodayUpcomingListProps) {
  if (upcoming.length === 0) return null

  const start = extraIsNextInPlan ? 1 : 0
  const end = extraIsNextInPlan ? 6 : 5

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Upcoming
      </h2>
      <div className="space-y-2">
        {upcoming.slice(start, end).map(rd => {
          const runSlot = rd.planDay.slots.find(s => isRunType(s.type))
          const groupId = runSlot?.runConfig?.progressionGroupId
          const progression = groupId ? getProgressionState(groupId) : null
          const target = runSlot ? resolveWorkoutDisplayTarget(runSlot, progression) : null
          const adaptationNote = target?.adaptationNote

          return (
            <div key={rd.calendarDate} className="flex items-center gap-3">
              <div className="w-10 text-center flex-shrink-0">
                <p className="text-xs text-slate-500 font-medium">
                  {new Date(rd.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <WorkoutDayCard
                  resolved={rd}
                  planId={planId}
                  sessionCount={upcomingSessionCounts[rd.calendarDate]}
                  onClick={() => onSelectUpcoming(rd)}
                  collapsible
                />
                {adaptationNote && (
                  <p className="text-[10px] text-sky-400/80 mt-1 ml-1 flex items-center gap-1">
                    <TrendingUp size={10} />{adaptationNote}
                  </p>
                )}
                {upcomingSessionSummaries[rd.calendarDate] && (
                  <p className="text-[10px] text-slate-500 mt-0.5 ml-1 truncate">
                    Last: {upcomingSessionSummaries[rd.calendarDate]}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
