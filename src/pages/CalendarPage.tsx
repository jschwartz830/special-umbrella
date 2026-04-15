import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Coffee, X, CheckCircle2, SkipForward } from 'lucide-react'
import { format } from 'date-fns'
import { useActivePlan } from '../hooks/useActivePlan'
import { useHistoryStore } from '../store/historyStore'
import { buildMonthGrid } from '../engine/calendarProjection'
import { WorkoutBadge } from '../components/workout/WorkoutBadge'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import type { Plan, ResolvedDay, ActionType } from '../types'

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
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const addOverride = useHistoryStore(s => s.addOverride)
  const removeRetroJumpForDate = useHistoryStore(s => s.removeRetroJumpForDate)

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

  function logForDate(rd: ResolvedDay, action: ActionType, selectedPlanDayIdx: number) {
    if (!plan) return

    // Clear any previously-written retroactive jump override for this date
    removeRetroJumpForDate(plan.id, rd.calendarDate)

    // If the user chose a different workout than the rotation computed, pin it
    // with a jump override so the engine shows (and propagates from) that day.
    if (action !== 'day_off' && selectedPlanDayIdx !== rd.planDayIndex) {
      addOverride({
        planId: plan.id,
        type: 'jump',
        targetDayIndex: selectedPlanDayIdx,
        // Noon local time — converts back to the same local date in all timezones
        appliedAt: `${rd.calendarDate}T12:00:00.000`,
      })
    }

    addEntry({
      planId: plan.id,
      calendarDate: rd.calendarDate,
      planDayIndex: action === 'day_off' ? undefined : selectedPlanDayIdx,
      action,
    })
    setSelected(null)
  }

  function clearDate(rd: ResolvedDay) {
    if (!plan) return
    removeRetroJumpForDate(plan.id, rd.calendarDate)
    removeEntry(plan.id, rd.calendarDate)
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
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map(cell => {
                  const rd = cell.resolvedDay
                  const isUnlogged = rd?.status === 'past_unlogged'
                  const isComplete = rd?.status === 'past_complete' || rd?.status === 'today_complete'
                  const isSkip = rd?.status === 'past_skip' || rd?.status === 'today_skip'
                  const isDayOff = rd?.status === 'past_day_off' || rd?.status === 'today_day_off'
                  const isPending = rd?.status === 'today_pending'
                  const hasFutureDayOff = rd?.status === 'future' && rd.historyEntry?.action === 'day_off'

                  const bgClass = cell.isToday
                    ? 'bg-sky-500 text-white'
                    : isComplete
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isDayOff || hasFutureDayOff
                        ? 'bg-amber-500/10 text-amber-500/60'
                        : isSkip
                          ? 'bg-slate-800 text-slate-600'
                          : isPending
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : rd?.status === 'future'
                              ? 'bg-slate-800/50 text-slate-400'
                              : isUnlogged
                                ? 'bg-slate-800/20 text-slate-600'
                                : 'bg-slate-800/30 text-slate-600'

                  return (
                    <button
                      key={cell.date}
                      onClick={() => rd && cell.isCurrentMonth && setSelected(rd)}
                      className={`rounded-lg aspect-square flex flex-col items-center justify-center transition-colors ${cell.isCurrentMonth ? bgClass : 'text-slate-700'} ${rd && cell.isCurrentMonth ? 'active:scale-95' : 'cursor-default'}`}
                    >
                      <span className="text-xs font-semibold leading-none">
                        {new Date(cell.date + 'T00:00').getDate()}
                      </span>
                      {rd && cell.isCurrentMonth && !isUnlogged && !isDayOff && !hasFutureDayOff && (
                        <div className="flex gap-0.5 mt-0.5">
                          {rd.planDay.slots.map(slot => (
                            <span key={slot.id} className={`w-1 h-1 rounded-full ${isComplete ? 'bg-emerald-400' : isSkip ? 'bg-slate-600' : 'bg-slate-500'}`} />
                          ))}
                        </div>
                      )}
                      {(isDayOff || hasFutureDayOff) && cell.isCurrentMonth && (
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
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 inline-block" />Done</span>
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
          plan={plan}
          onLog={(action, idx) => logForDate(selected, action, idx)}
          onClear={() => clearDate(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function DayDetailModal({
  resolved,
  today,
  plan,
  onLog,
  onClear,
  onClose,
}: {
  resolved: ResolvedDay
  today: string
  plan: Plan
  onLog: (action: ActionType, selectedPlanDayIdx: number) => void
  onClear: () => void
  onClose: () => void
}) {
  const { calendarDate, planDayIndex, status, historyEntry } = resolved
  const isPast = calendarDate < today
  const isToday = calendarDate === today
  const isFuture = calendarDate > today
  const hasEntry = !!historyEntry
  const isDayOff = historyEntry?.action === 'day_off' || status === 'past_day_off' || status === 'today_day_off'
  const isComplete = status === 'past_complete' || status === 'today_complete'
  const isSkipped = status === 'past_skip' || status === 'today_skip'

  const canLog = isPast || isToday
  const canDayOff = isToday || isFuture

  // Which plan day the user wants to log — defaults to the computed rotation index
  const [selectedIdx, setSelectedIdx] = useState(planDayIndex)
  const selectedPlanDay = plan.days[selectedIdx]

  const dateLabel = format(new Date(calendarDate + 'T00:00'), 'EEEE, MMMM d')

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-4">
        {/* Workout picker — shown whenever the user can log */}
        {canLog && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
              Which workout?
            </p>
            <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
              {plan.days.map((day, idx) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selectedIdx === idx
                      ? 'bg-sky-500/15 border-sky-500/50'
                      : 'bg-slate-700/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    selectedIdx === idx ? 'bg-sky-500 text-white' : 'bg-slate-600 text-slate-300'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedIdx === idx ? 'text-sky-300' : 'text-slate-300'}`}>
                      {day.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {day.slots.map(s => s.name).join(' + ')}
                    </p>
                  </div>
                  {selectedIdx === idx && (
                    <CheckCircle2 size={14} className="flex-shrink-0 text-sky-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Static workout details for future days (no picker shown there) */}
        {!canLog && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{resolved.planDay.label}</p>
            {resolved.planDay.slots.map((slot, i) => (
              <div key={slot.id} className={i > 0 ? 'pt-3 border-t border-slate-700' : ''}>
                <WorkoutBadge type={slot.type} />
                <p className="text-sm font-medium text-slate-200 mt-1">{slot.name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                  {slot.targetDistance && <span>{slot.targetDistance} mi</span>}
                  {slot.targetPace && <span>{slot.targetPace} min/mi</span>}
                  {slot.targetTime && <span>{slot.targetTime} min</span>}
                  {slot.targetDuration && <span>{slot.targetDuration} min</span>}
                  {slot.isDeload && <span className="text-yellow-400">Deload</span>}
                </div>
                {slot.notes && <p className="text-xs text-slate-500 italic mt-1">{slot.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Selected workout details shown below the picker for past/today */}
        {canLog && selectedPlanDay && (
          <div className="space-y-1.5 px-1">
            {selectedPlanDay.slots.map((slot, i) => (
              <div key={slot.id} className={`flex items-center gap-2 ${i > 0 ? 'pt-1.5 border-t border-slate-700/50' : ''}`}>
                <WorkoutBadge type={slot.type} size="sm" />
                <span className="text-xs text-slate-300 truncate">{slot.name}</span>
                {slot.targetDistance && <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{slot.targetDistance} mi</span>}
                {slot.targetTime && !slot.targetDistance && <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{slot.targetTime} min</span>}
              </div>
            ))}
          </div>
        )}

        {/* Current status */}
        {hasEntry && (
          <div className={`flex items-center justify-between py-2 px-3 rounded-xl ${
            isComplete ? 'bg-emerald-500/10 border border-emerald-500/20' :
            isSkipped ? 'bg-slate-700/50 border border-slate-600' :
            'bg-amber-500/10 border border-amber-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {isComplete && <CheckCircle2 size={16} className="text-emerald-400" />}
              {isSkipped && <SkipForward size={16} className="text-slate-400" />}
              {isDayOff && <Coffee size={16} className="text-amber-400" />}
              <span className={`text-sm font-medium capitalize ${
                isComplete ? 'text-emerald-400' : isSkipped ? 'text-slate-300' : 'text-amber-400'
              }`}>
                {historyEntry?.action.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
            >
              <X size={12} /> Clear
            </button>
          </div>
        )}
        {historyEntry?.notes && (
          <p className="text-sm text-slate-400 italic">"{historyEntry.notes}"</p>
        )}

        {/* Log actions */}
        <div className="space-y-2">
          {canLog && (
            <>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                {hasEntry ? 'Change to' : 'Log as'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onLog('complete', selectedIdx)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors active:scale-95"
                >
                  <CheckCircle2 size={16} /> Complete
                </button>
                <button
                  onClick={() => onLog('skip', selectedIdx)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm font-medium transition-colors active:scale-95"
                >
                  <SkipForward size={16} /> Skip
                </button>
              </div>
            </>
          )}

          {canDayOff && !isDayOff && (
            <button
              onClick={() => onLog('day_off', selectedIdx)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors active:scale-95"
            >
              <Coffee size={16} /> Mark Day Off
            </button>
          )}
          {isDayOff && (
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
            >
              <X size={16} /> Cancel Day Off
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
