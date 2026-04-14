import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useActivePlan } from '../hooks/useActivePlan'
import { useHistoryStore } from '../store/historyStore'
import { buildMonthGrid } from '../engine/calendarProjection'
import { WorkoutBadge } from '../components/workout/WorkoutBadge'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import type { ResolvedDay } from '../types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<ResolvedDay | null>(null)

  const { plan, today } = useActivePlan()
  const entries = useHistoryStore(s => s.entries)
  const overrides = useHistoryStore(s => s.overrides)

  const weeks = useMemo(
    () => buildMonthGrid(year, month, plan, entries, overrides, today),
    [year, month, plan, entries, overrides, today],
  )

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
      </div>

      {!plan && (
        <EmptyState title="No active plan" description="Activate a plan to see your schedule." />
      )}

      {plan && (
        <>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-white">
              {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map(cell => {
                  const rd = cell.resolvedDay
                  const isComplete = rd?.status === 'past_complete' || rd?.status === 'today_complete'
                  const isSkip = rd?.status === 'past_skip' || rd?.status === 'today_skip'
                  const isDayOff = rd?.status === 'past_day_off' || rd?.status === 'today_day_off'
                  const isPending = rd?.status === 'today_pending'
                  const isFuture = rd?.status === 'future'

                  const bgClass = cell.isToday
                    ? 'bg-sky-500 text-white'
                    : isComplete
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isSkip
                        ? 'bg-slate-800 text-slate-600'
                        : isDayOff
                          ? 'bg-slate-800 text-slate-600'
                          : isPending
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : isFuture
                              ? 'bg-slate-800/50 text-slate-400'
                              : 'bg-slate-800/30 text-slate-600'

                  return (
                    <button
                      key={cell.date}
                      onClick={() => rd && cell.isCurrentMonth && setSelected(rd)}
                      className={`rounded-lg aspect-square flex flex-col items-center justify-center transition-colors relative ${cell.isCurrentMonth ? bgClass : 'text-slate-700'} ${rd && cell.isCurrentMonth ? 'hover:ring-1 hover:ring-white/20' : 'cursor-default'}`}
                    >
                      <span className="text-xs font-semibold leading-none">
                        {new Date(cell.date + 'T00:00').getDate()}
                      </span>
                      {rd && cell.isCurrentMonth && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {rd.planDay.slots.map(slot => (
                            <span
                              key={slot.id}
                              className={`w-1 h-1 rounded-full ${
                                isComplete ? 'bg-emerald-400' :
                                isSkip ? 'bg-slate-600' :
                                isDayOff ? 'bg-slate-600' :
                                'bg-slate-500'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 inline-block" />Complete</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/10 inline-block" />Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800/50 inline-block" />Upcoming</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />Skipped</span>
          </div>
        </>
      )}

      {/* Day detail modal */}
      {selected && (
        <Modal
          title={format(new Date(selected.calendarDate + 'T00:00'), 'EEEE, MMMM d')}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-400 font-medium">{selected.planDay.label}</p>
            {selected.planDay.slots.map(slot => (
              <div key={slot.id} className="flex items-center gap-2">
                <WorkoutBadge type={slot.type} />
                <span className="text-sm text-slate-200">{slot.name}</span>
              </div>
            ))}
            {selected.historyEntry && (
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Outcome</p>
                <span className={`text-sm font-medium capitalize ${
                  selected.historyEntry.action === 'complete' ? 'text-emerald-400' :
                  selected.historyEntry.action === 'skip' ? 'text-slate-400' : 'text-amber-400'
                }`}>
                  {selected.historyEntry.action.replace('_', ' ')}
                </span>
                {selected.historyEntry.notes && (
                  <p className="text-sm text-slate-400 italic mt-1">"{selected.historyEntry.notes}"</p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
