import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  X,
  CheckCircle2,
  SkipForward,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
} from 'lucide-react'
import { format } from 'date-fns'
import { useActivePlan } from '../hooks/useActivePlan'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { buildMonthGrid } from '../engine/calendarProjection'
import { WorkoutBadge } from '../components/workout/WorkoutBadge'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import type { Plan, ResolvedDay, ActionType, WorkoutType, ExtraWorkoutEntry, PlanDay } from '../types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WORKOUT_TYPES: { type: WorkoutType; label: string }[] = [
  { type: 'weightlifting', label: 'Weightlifting' },
  { type: 'long_run', label: 'Long Run' },
  { type: 'recovery_run', label: 'Recovery Run' },
  { type: 'swim', label: 'Swim' },
  { type: 'yoga', label: 'Yoga' },
  { type: 'rest', label: 'Rest' },
]

/** Build a synthetic PlanDay from an ExtraWorkoutEntry so OutcomeModal can render it */
function extraToPlanDay(extra: ExtraWorkoutEntry): PlanDay {
  return {
    id: extra.id,
    label: extra.workoutName,
    slots: [{ id: extra.id, type: extra.workoutType, name: extra.workoutName }],
  }
}

export function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<ResolvedDay | null>(null)

  // Outcome modal state — null = closed, otherwise the props to pass
  const [outcomeTarget, setOutcomeTarget] = useState<{
    planId: string
    calendarDate: string
    planDay: PlanDay
    instanceId: string
  } | null>(null)

  const { plan, today } = useActivePlan()
  const entries = useHistoryStore(s => s.entries)
  const overrides = useHistoryStore(s => s.overrides)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const addEntry = useHistoryStore(s => s.addEntry)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const addOverride = useHistoryStore(s => s.addOverride)
  const removeRetroJumpForDate = useHistoryStore(s => s.removeRetroJumpForDate)
  const addExtraEntry = useHistoryStore(s => s.addExtraEntry)
  const updateExtraEntry = useHistoryStore(s => s.updateExtraEntry)
  const removeExtraEntry = useHistoryStore(s => s.removeExtraEntry)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)

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

    removeRetroJumpForDate(plan.id, rd.calendarDate)

    if (action !== 'day_off' && selectedPlanDayIdx !== rd.planDayIndex) {
      addOverride({
        planId: plan.id,
        type: 'jump',
        targetDayIndex: selectedPlanDayIdx,
        appliedAt: `${rd.calendarDate}T12:00:00.000`,
      })
    }

    addEntry({
      planId: plan.id,
      calendarDate: rd.calendarDate,
      planDayIndex: action === 'day_off' ? undefined : selectedPlanDayIdx,
      action,
    })

    // After logging complete, open OutcomeModal to capture details
    if (action === 'complete') {
      const planDay = plan.days[selectedPlanDayIdx]
      if (planDay) {
        setSelected(null)
        setOutcomeTarget({
          planId: plan.id,
          calendarDate: rd.calendarDate,
          planDay,
          instanceId: makeWorkoutInstanceId(plan.id, rd.calendarDate),
        })
        return
      }
    }

    setSelected(null)
  }

  function openEditOutcome(rd: ResolvedDay) {
    if (!plan) return
    const planDayIdx = rd.historyEntry?.planDayIndex ?? rd.planDayIndex
    const planDay = plan.days[planDayIdx]
    if (!planDay) return
    setSelected(null)
    setOutcomeTarget({
      planId: plan.id,
      calendarDate: rd.calendarDate,
      planDay,
      instanceId: makeWorkoutInstanceId(plan.id, rd.calendarDate),
    })
  }

  function openExtraOutcome(extra: ExtraWorkoutEntry) {
    if (!plan) return
    setSelected(null)
    setOutcomeTarget({
      planId: plan.id,
      calendarDate: extra.calendarDate,
      planDay: extraToPlanDay(extra),
      instanceId: makeExtraWorkoutInstanceId(plan.id, extra.calendarDate, extra.id),
    })
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!outcomeTarget) return
    // Find the slot for progression tracking (null-safe fallback)
    const planDay = outcomeTarget.planDay
    const slot = planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
    logOutcomeWithProgression(outcome, slot)

    // Ensure the history entry action is synced to the completion state
    const entry = entries.find(
      e => e.planId === outcomeTarget.planId && e.calendarDate === outcomeTarget.calendarDate,
    )
    if (entry) {
      const action = completionStateToAction(outcome.completionState)
      // Update in store only if action changed
      if (entry.action !== action) {
        addEntry({ ...entry, action })
      }
    }
    setOutcomeTarget(null)
  }

  function clearDate(rd: ResolvedDay) {
    if (!plan) return
    removeRetroJumpForDate(plan.id, rd.calendarDate)
    removeEntry(plan.id, rd.calendarDate)
    removeOutcome(makeWorkoutInstanceId(plan.id, rd.calendarDate))
    setSelected(null)
  }

  // Extra workout helpers
  function getExtrasForDate(calendarDate: string): ExtraWorkoutEntry[] {
    if (!plan) return []
    return extraEntries.filter(e => e.planId === plan.id && e.calendarDate === calendarDate)
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
                  const extras = rd ? getExtrasForDate(rd.calendarDate) : []

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
                          {extras.map(e => (
                            <span key={e.id} className="w-1 h-1 rounded-full bg-sky-400" />
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
          extras={getExtrasForDate(selected.calendarDate)}
          outcomes={outcomes}
          onLog={(action, idx) => logForDate(selected, action, idx)}
          onClear={() => clearDate(selected)}
          onEditOutcome={() => openEditOutcome(selected)}
          onEditExtraOutcome={(extra) => openExtraOutcome(extra)}
          onAddExtra={(type, name) => {
            if (!plan) return
            addExtraEntry({ planId: plan.id, calendarDate: selected.calendarDate, workoutType: type, workoutName: name })
          }}
          onUpdateExtra={(id, patch) => updateExtraEntry(id, patch)}
          onDeleteExtra={(extra) => {
            removeExtraEntry(extra.id)
            removeOutcome(makeExtraWorkoutInstanceId(plan.id, extra.calendarDate, extra.id))
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Outcome modal — shown after completing a workout or editing details */}
      {outcomeTarget && plan && (
        <OutcomeModal
          planId={outcomeTarget.planId}
          calendarDate={outcomeTarget.calendarDate}
          planDay={outcomeTarget.planDay}
          existingOutcome={outcomes[outcomeTarget.instanceId] ?? null}
          onConfirm={handleOutcomeConfirm}
          onClose={() => setOutcomeTarget(null)}
        />
      )}
    </div>
  )
}

function DayDetailModal({
  resolved,
  today,
  plan,
  extras,
  outcomes,
  onLog,
  onClear,
  onEditOutcome,
  onEditExtraOutcome,
  onAddExtra,
  onUpdateExtra,
  onDeleteExtra,
  onClose,
}: {
  resolved: ResolvedDay
  today: string
  plan: Plan
  extras: ExtraWorkoutEntry[]
  outcomes: Record<string, WorkoutOutcome>
  onLog: (action: ActionType, selectedPlanDayIdx: number) => void
  onClear: () => void
  onEditOutcome: () => void
  onEditExtraOutcome: (extra: ExtraWorkoutEntry) => void
  onAddExtra: (type: WorkoutType, name: string) => void
  onUpdateExtra: (id: string, patch: Partial<Pick<ExtraWorkoutEntry, 'workoutType' | 'workoutName' | 'notes'>>) => void
  onDeleteExtra: (extra: ExtraWorkoutEntry) => void
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

  const [selectedIdx, setSelectedIdx] = useState(planDayIndex)
  const selectedPlanDay = plan.days[selectedIdx]

  // Extra workout add form state
  const [showAddExtra, setShowAddExtra] = useState(false)
  const [extraType, setExtraType] = useState<WorkoutType>('yoga')
  const [extraName, setExtraName] = useState('')
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null)
  const [editingExtraName, setEditingExtraName] = useState('')
  const [editingExtraType, setEditingExtraType] = useState<WorkoutType>('yoga')

  const dateLabel = format(new Date(calendarDate + 'T00:00'), 'EEEE, MMMM d')

  function submitAddExtra() {
    const name = extraName.trim() || WORKOUT_TYPES.find(w => w.type === extraType)?.label || extraType
    onAddExtra(extraType, name)
    setExtraName('')
    setExtraType('yoga')
    setShowAddExtra(false)
  }

  function startEditExtra(extra: ExtraWorkoutEntry) {
    setEditingExtraId(extra.id)
    setEditingExtraName(extra.workoutName)
    setEditingExtraType(extra.workoutType)
  }

  function saveEditExtra() {
    if (!editingExtraId) return
    onUpdateExtra(editingExtraId, { workoutType: editingExtraType, workoutName: editingExtraName.trim() || editingExtraType })
    setEditingExtraId(null)
  }

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

        {/* Static workout details for future days */}
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

        {/* Selected workout details shown below picker */}
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

        {/* Current status + edit outcome */}
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
            <div className="flex items-center gap-1">
              {isComplete && (
                <button
                  onClick={onEditOutcome}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs transition-colors"
                >
                  <ClipboardList size={11} /> Details
                </button>
              )}
              <button
                onClick={onClear}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
              >
                <X size={12} /> Clear
              </button>
            </div>
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

        {/* ── Additional workouts ─────────────────────────────── */}
        {(canLog || extras.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Additional Workouts
              </p>
              {canLog && !showAddExtra && (
                <button
                  onClick={() => setShowAddExtra(true)}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {/* Existing extra workouts */}
            {extras.length > 0 && (
              <div className="space-y-2 mb-2">
                {extras.map(extra => {
                  const instanceId = makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id)
                  const outcome = outcomes[instanceId]
                  const isEditing = editingExtraId === extra.id
                  if (isEditing) {
                    return (
                      <div key={extra.id} className="bg-slate-700/60 border border-slate-600 rounded-xl p-3 space-y-2">
                        <select
                          value={editingExtraType}
                          onChange={e => setEditingExtraType(e.target.value as WorkoutType)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                          {WORKOUT_TYPES.map(w => (
                            <option key={w.type} value={w.type}>{w.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editingExtraName}
                          onChange={e => setEditingExtraName(e.target.value)}
                          placeholder="Workout name"
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEditExtra} className="flex-1 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">Save</button>
                          <button onClick={() => setEditingExtraId(null)} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={extra.id} className="flex items-center gap-2 bg-slate-700/40 rounded-xl px-3 py-2 border border-slate-700">
                      <WorkoutBadge type={extra.workoutType} size="sm" />
                      <span className="text-xs text-slate-300 flex-1 truncate">{extra.workoutName}</span>
                      {outcome && <span className="text-[10px] text-emerald-400">✓</span>}
                      <button
                        onClick={() => onEditExtraOutcome(extra)}
                        className="p-1 rounded text-sky-400 hover:text-sky-300 transition-colors"
                        title="Log/edit details"
                      >
                        <ClipboardList size={12} />
                      </button>
                      <button
                        onClick={() => startEditExtra(extra)}
                        className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteExtra(extra)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add extra workout form */}
            {showAddExtra && (
              <div className="bg-slate-700/60 border border-slate-600 rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-400 font-medium">New workout</p>
                <select
                  value={extraType}
                  onChange={e => setExtraType(e.target.value as WorkoutType)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {WORKOUT_TYPES.map(w => (
                    <option key={w.type} value={w.type}>{w.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={extraName}
                  onChange={e => setExtraName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="flex gap-2">
                  <button onClick={submitAddExtra} className="flex-1 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">Add</button>
                  <button onClick={() => { setShowAddExtra(false); setExtraName(''); }} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
