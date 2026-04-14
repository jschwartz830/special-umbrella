import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Coffee, X } from 'lucide-react'
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
  const addEntry = useHistoryStore(s => s.addEntry)

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

  function markDayOff(rd: ResolvedDay) {
    if (!plan) return
    addEntry({
      planId: plan.id,
      calendarDate: rd.calendarDate,
      planDayIndex: undefined,
      action: 'day_off',
    })
    setSelected(null)
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
                  const isDayOffCell = rd?.status === 'past_day_off' || rd?.status === 'today_day_off'
                  const isPending = rd?.status === 'today_pending'
                  const isFutureCell = rd?.status === 'future'
                  // Also check if a future date has a day_off entry logged proactively
                  const hasFutureDayOff = isFutureCell && rd?.historyEntry?.action === 'day_off'

                  const bgClass = cell.isToday
                    ? 'bg-sky-500 text-white'
                    : isComplete
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isSkip
                        ? 'bg-slate-800 text-slate-600'
                        : isDayOffCell || hasFutureDayOff
                          ? 'bg-amber-500/10 text-amber-500/60'
                          : isPending
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : isFutureCell
                              ? 'bg-slate-800/50 text-slate-400'
                              : 'bg-slate-800/30 text-slate-600'

                  return (
                    <button
                      key={cell.date}
                      onClick={() => rd && cell.isCurrentMonth && setSelected(rd)}
                      className={`rounded-lg aspect-square flex flex-col items-center justify-center transition-colors relative ${cell.isCurrentMonth ? bgClass : 'text-slate-700'} ${rd && cell.isCurrentMonth ? 'active:scale-95' : 'cursor-default'}`}
                    >
                      <span className="text-xs font-semibold leading-none">
                        {new Date(cell.date + 'T00:00').getDate()}
                      </span>
                      {rd && cell.isCurrentMonth && !isDayOffCell && !hasFutureDayOff && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {rd.planDay.slots.map(slot => (
                            <span
                              key={slot.id}
                              className={`w-1 h-1 rounded-full ${
                                isComplete ? 'bg-emerald-400' :
                                isSkip ? 'bg-slate-600' :
                                'bg-slate-500'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      {(isDayOffCell || hasFutureDayOff) && cell.isCurrentMonth && (
                        <Coffee size={8} className="mt-0.5 opacity-70" />
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
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/10 inline-block" />Day Off</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />Skipped</span>
          </div>
        </>
      )}

      {/* Day detail modal */}
      {selected && plan && (
        <DayDetailModal
          resolved={selected}
          today={today}
          onMarkDayOff={() => markDayOff(selected)}
          onRemoveDayOff={() => {
            // Re-log as a no-op removal: we delete the day_off by replacing with nothing.
            // Since addEntry replaces same date, we remove by calling store directly.
            useHistoryStore.getState().removeEntry(plan.id, selected.calendarDate)
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function DayDetailModal({
  resolved,
  today,
  onMarkDayOff,
  onRemoveDayOff,
  onClose,
}: {
  resolved: ResolvedDay
  today: string
  onMarkDayOff: () => void
  onRemoveDayOff: () => void
  onClose: () => void
}) {
  const { calendarDate, planDay, status, historyEntry } = resolved
  const isFutureOrToday = calendarDate >= today
  const isDayOff = historyEntry?.action === 'day_off' ||
    status === 'past_day_off' || status === 'today_day_off'
  const isComplete = status === 'past_complete' || status === 'today_complete'
  const isSkipped = status === 'past_skip' || status === 'today_skip'

  const dateLabel = format(new Date(calendarDate + 'T00:00'), 'EEEE, MMMM d')

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-4">
        {/* Workout day info */}
        {!isDayOff && (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Workout Day</p>
              <p className="text-sm font-semibold text-slate-200">{planDay.label}</p>
            </div>

            <div className="space-y-3">
              {planDay.slots.map((slot, i) => (
                <div key={slot.id} className={`space-y-1.5 ${i > 0 ? 'pt-3 border-t border-slate-700' : ''}`}>
                  <WorkoutBadge type={slot.type} />
                  <p className="text-sm font-medium text-slate-200">{slot.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    {slot.targetDistance && <span>{slot.targetDistance} mi</span>}
                    {slot.targetPace && <span>{slot.targetPace} min/mi</span>}
                    {slot.targetTime && <span>{slot.targetTime} min</span>}
                    {slot.targetDuration && <span>{slot.targetDuration} min</span>}
                    {slot.isDeload && <span className="text-yellow-400">Deload</span>}
                  </div>
                  {slot.notes && (
                    <p className="text-xs text-slate-500 italic">{slot.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Past outcome */}
        {historyEntry && !isDayOff && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Outcome</p>
            <span className={`text-sm font-medium capitalize ${
              isComplete ? 'text-emerald-400' : isSkipped ? 'text-slate-400' : 'text-amber-400'
            }`}>
              {historyEntry.action.replace('_', ' ')}
            </span>
            {historyEntry.notes && (
              <p className="text-sm text-slate-400 italic mt-1">"{historyEntry.notes}"</p>
            )}
          </div>
        )}

        {/* Day off state */}
        {isDayOff && (
          <div className="flex items-center gap-3 py-2">
            <Coffee size={20} className="text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Day Off</p>
              <p className="text-xs text-slate-500">The rotation pauses on this day.</p>
            </div>
          </div>
        )}

        {/* Actions for future/today days */}
        {isFutureOrToday && (
          <div className="pt-2 border-t border-slate-700 space-y-2">
            {isDayOff ? (
              <button
                onClick={onRemoveDayOff}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
              >
                <X size={15} /> Cancel Day Off
              </button>
            ) : (
              <button
                onClick={onMarkDayOff}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors"
              >
                <Coffee size={15} /> Mark as Day Off
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
