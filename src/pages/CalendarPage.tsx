import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  X,
  CheckCircle2,
  SkipForward,
  Plus,
  Trash2,
  ClipboardList,
  Play,
  Copy,
} from 'lucide-react'
import { format } from 'date-fns'
import { useActivePlan } from '../hooks/useActivePlan'
import { useToday } from '../hooks/useToday'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { useMobilityStore } from '../store/mobilityStore'
import { buildMonthGrid } from '../engine/calendarProjection'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { ActiveWorkoutTracker } from '../components/workout/ActiveWorkoutTracker'
import { WorkoutBadge } from '../components/workout/WorkoutBadge'
import { OutcomeMetrics } from '../components/workout/OutcomeMetrics'
import { WorkoutSlotDetails } from '../components/workout/WorkoutSlotDetails'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import type { Plan, ResolvedDay, ActionType, WorkoutType, ExtraWorkoutEntry, PlanDay } from '../types'
import type { WorkoutOutcome, LoggedExerciseActual } from '../modules/workout-outcomes/types'
import { useProgramStore } from '../store/programStore'
import type { WorkoutSessionMeta } from '../components/workout/ActiveWorkoutTracker'
import { extraToPlanDay } from '../lib/planDayUtils'
import { findPreviousSetsByExercise } from '../lib/previousSetsHelper'
import { formatWorkoutForClipboard } from '../lib/shareWorkout'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WORKOUT_TYPES: { type: WorkoutType; label: string }[] = [
  { type: 'weights', label: 'Weights' },
  { type: 'run', label: 'Run' },
  { type: 'swim', label: 'Swim' },
  { type: 'yoga', label: 'Yoga' },
  { type: 'other', label: 'Other' },
]

export function CalendarPage() {
  const todayStr = useToday()
  const [nowYear, nowMonth] = todayStr.split('-').map(Number)
  const [year, setYear] = useState(nowYear)
  const [month, setMonth] = useState(nowMonth - 1)
  const [selected, setSelected] = useState<ResolvedDay | null>(null)

  // Outcome modal state — null = closed, otherwise the props to pass
  const [outcomeTarget, setOutcomeTarget] = useState<{
    planId: string
    calendarDate: string
    planDay: PlanDay
    instanceId: string
  } | null>(null)
  const [activeWorkoutState, setActiveWorkoutState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  const [activeWorkoutTarget, setActiveWorkoutTarget] = useState<{
    calendarDate: string
    planDay: PlanDay
    slotId: string
    workoutInstanceId: string
  } | null>(null)
  const [activeTrackedExercises, setActiveTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [activeTrackedDurationMin, setActiveTrackedDurationMin] = useState<number | null>(null)

  const { plan, today } = useActivePlan()
  const entries = useHistoryStore(s => s.entries)
  const overrides = useHistoryStore(s => s.overrides)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const addEntry = useHistoryStore(s => s.addEntry)
  const updateEntryAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const addOverride = useHistoryStore(s => s.addOverride)
  const removeRetroJumpForDate = useHistoryStore(s => s.removeRetroJumpForDate)
  const updateEntryDate = useHistoryStore(s => s.updateEntryDate)
  const updateExtraEntryDate = useHistoryStore(s => s.updateExtraEntryDate)
  const addExtraEntry = useHistoryStore(s => s.addExtraEntry)
  const removeExtraEntry = useHistoryStore(s => s.removeExtraEntry)
  const mobilityCompletions = useMobilityStore(s => s.completions)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const moveOutcome = useOutcomeStore(s => s.moveOutcome)
  const programVarsMap = useProgramStore(s => s.vars)

  const planProgramVars = useMemo(
    () => (plan ? (programVarsMap[plan.id] ?? {}) : {}),
    [plan, programVarsMap],
  )

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

  function goToToday() {
    setYear(nowYear)
    setMonth(nowMonth - 1)
  }

  const isCurrentMonth = year === nowYear && month === nowMonth - 1

  function logForDate(rd: ResolvedDay, action: ActionType, selectedPlanDayIdx: number) {
    if (!plan) return

    // Check for an existing jump *before* removing it. rd.planDayIndex was
    // computed WITH that jump applied, so if we remove it and the user
    // confirmed the same index, the condition below would incorrectly skip
    // re-anchoring — shifting the rotation for all subsequent dates.
    const hadJump = overrides.some(o => {
      if (o.planId !== plan.id || o.type !== 'jump') return false
      return format(new Date(o.appliedAt), 'yyyy-MM-dd') === rd.calendarDate
    })

    removeRetroJumpForDate(plan.id, rd.calendarDate)

    if (action !== 'day_off' && (hadJump || selectedPlanDayIdx !== rd.planDayIndex)) {
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
    const originalDate = outcomeTarget.calendarDate
    const completedDate = outcome.completedAt
      ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
      : originalDate
    const isExtra = outcomeTarget.instanceId.includes('_extra_')
    let finalOutcome = outcome

    if (completedDate !== originalDate) {
      if (isExtra) {
        const extraId = outcomeTarget.instanceId.split('_extra_')[1]
        if (extraId) {
          updateExtraEntryDate(extraId, completedDate)
          const nextId = makeExtraWorkoutInstanceId(outcomeTarget.planId, completedDate, extraId)
          moveOutcome(outcomeTarget.instanceId, nextId)
          finalOutcome = { ...outcome, workoutInstanceId: nextId }
        }
      } else {
        const entry = entries.find(
          e => e.planId === outcomeTarget.planId && e.calendarDate === originalDate,
        )
        if (entry) {
          removeEntry(outcomeTarget.planId, completedDate)
          updateEntryDate(entry.id, completedDate)
        }
        const nextId = makeWorkoutInstanceId(outcomeTarget.planId, completedDate)
        // Remove any existing outcome at the target date so its exercise history
        // records don't become orphaned when the new outcome overwrites the key.
        removeOutcome(nextId)
        moveOutcome(outcomeTarget.instanceId, nextId)
        finalOutcome = { ...outcome, workoutInstanceId: nextId }
      }
    }

    // Find the slot for progression tracking (null-safe fallback)
    const planDay = outcomeTarget.planDay
    const slot = planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
    logOutcomeWithProgression(finalOutcome, slot)

    // Ensure the history entry action is synced to the completion state.
    // Read from the live store — if the date changed, updateEntryDate already
    // moved the entry and the closure-captured `entries` would miss it.
    const liveEntries = useHistoryStore.getState().entries
    const entry = liveEntries.find(
      e => e.planId === outcomeTarget.planId && e.calendarDate === completedDate,
    )
    if (entry) {
      const action = completionStateToAction(outcome.completionState)
      if (entry.action !== action) {
        updateEntryAction(entry.planId, entry.calendarDate, action, entry.planDayIndex)
      }
    }
    setOutcomeTarget(null)
    setActiveTrackedExercises(null)
    setActiveTrackedDurationMin(null)
  }

  function clearDate(rd: ResolvedDay) {
    if (!plan) return
    removeRetroJumpForDate(plan.id, rd.calendarDate)
    removeEntry(plan.id, rd.calendarDate)
    removeOutcome(makeWorkoutInstanceId(plan.id, rd.calendarDate))
    setSelected(null)
  }

  function startHistoricalResume(planDay: PlanDay, calendarDate: string, instanceId: string, slotId?: string) {
    const slot = slotId ? planDay.slots.find(s => s.id === slotId) : planDay.slots[0]
    if (!slot) return
    setSelected(null)
    setOutcomeTarget(null)
    setActiveTrackedExercises(null)
    setActiveTrackedDurationMin(null)
    setActiveWorkoutTarget({
      calendarDate,
      planDay,
      slotId: slot.id,
      workoutInstanceId: instanceId,
    })
    setActiveWorkoutState('open')
  }

  function handleHistoricalActiveComplete(exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) {
    if (!activeWorkoutTarget || !plan) return
    setActiveTrackedExercises(exercises)
    setActiveTrackedDurationMin(Math.round(meta.totalElapsedSeconds / 60) || null)
    setActiveWorkoutState('hidden')
    setOutcomeTarget({
      planId: plan.id,
      calendarDate: activeWorkoutTarget.calendarDate,
      planDay: activeWorkoutTarget.planDay,
      instanceId: activeWorkoutTarget.workoutInstanceId,
    })
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              {!isCurrentMonth && (
                <button
                  onClick={goToToday}
                  className="text-xs text-sky-400 hover:text-sky-200 font-medium px-2 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                >
                  Today
                </button>
              )}
            </div>
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
                  const hasMobility = cell.isCurrentMonth && !!mobilityCompletions[cell.date]

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
                      className={`rounded-lg aspect-square flex flex-col items-center justify-center transition-colors ${cell.isCurrentMonth ? bgClass : 'text-slate-700'} ${rd && cell.isCurrentMonth ? 'active:scale-95' : 'cursor-default'} ${hasMobility ? 'ring-1 ring-emerald-400' : ''}`}
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
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800/20 inline-block" />Unlogged</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800/50 inline-block" />Upcoming</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/10 inline-block" />Day Off</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />Skipped</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm ring-1 ring-emerald-400 inline-block" />Mobility</span>
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
          onResumeRotation={(planDay, calendarDate) => startHistoricalResume(
            planDay,
            calendarDate,
            makeWorkoutInstanceId(plan.id, calendarDate),
            planDay.slots[0]?.id,
          )}
          onResumeExtra={(extra) => startHistoricalResume(
            extraToPlanDay(extra),
            extra.calendarDate,
            makeExtraWorkoutInstanceId(plan.id, extra.calendarDate, extra.id),
            extra.id,
          )}
          onAddExtra={(type, name) => {
            if (!plan) return
            addExtraEntry({ planId: plan.id, calendarDate: selected.calendarDate, workoutType: type, workoutName: name, source: 'history' })
          }}
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
          existingOutcome={
            activeTrackedExercises
              ? {
                  workoutInstanceId: outcomeTarget.instanceId,
                  completionState: 'completed',
                  completedAt: new Date().toISOString(),
                  durationActualMin: activeTrackedDurationMin,
                  perceivedEffort: null,
                  notes: null,
                  runActual: null,
                  swimActual: null,
                  weightsActual: { exercises: activeTrackedExercises },
                }
              : (outcomes[outcomeTarget.instanceId] ?? null)
          }
          previousSetsByExercise={plan ? findPreviousSetsByExercise(plan.id, outcomeTarget.calendarDate, outcomes, outcomeTarget.instanceId) : {}}
          workoutInstanceId={outcomeTarget.instanceId}
          onConfirm={handleOutcomeConfirm}
          onClose={() => {
            setOutcomeTarget(null)
            setActiveTrackedExercises(null)
            setActiveTrackedDurationMin(null)
          }}
        />
      )}

      {activeWorkoutState !== 'hidden' && activeWorkoutTarget && plan && (() => {
        const slot = activeWorkoutTarget.planDay.slots.find(s => s.id === activeWorkoutTarget.slotId)
          ?? activeWorkoutTarget.planDay.slots[0]
        if (!slot) return null
        return (
          <ActiveWorkoutTracker
            planId={plan.id}
            workoutInstanceId={activeWorkoutTarget.workoutInstanceId}
            planDay={activeWorkoutTarget.planDay}
            slot={slot}
            programVars={planProgramVars}
            previousOutcome={null}
            resumeOutcome={outcomes[activeWorkoutTarget.workoutInstanceId] ?? null}
            previousSetsByExercise={plan ? findPreviousSetsByExercise(plan.id, activeWorkoutTarget.calendarDate, outcomes, activeWorkoutTarget.workoutInstanceId) : {}}
            minimized={activeWorkoutState === 'minimized'}
            onMinimize={() => setActiveWorkoutState('minimized')}
            onResume={() => setActiveWorkoutState('open')}
            onCancel={() => setActiveWorkoutState('hidden')}
            onComplete={handleHistoricalActiveComplete}
          />
        )
      })()}
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
  onResumeRotation,
  onResumeExtra,
  onAddExtra,
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
  onResumeRotation: (planDay: PlanDay, calendarDate: string) => void
  onResumeExtra: (extra: ExtraWorkoutEntry) => void
  onAddExtra: (type: WorkoutType, name: string) => void
  onDeleteExtra: (extra: ExtraWorkoutEntry) => void
  onClose: () => void
}) {
  const isCompleteForDirect = resolved.status === 'past_complete' || resolved.status === 'today_complete'
  const { calendarDate, planDayIndex, status, historyEntry } = resolved
  const isPast = calendarDate < today
  const isToday = calendarDate === today
  const isFuture = calendarDate > today
  const hasEntry = !!historyEntry
  const isDayOff = historyEntry?.action === 'day_off' || status === 'past_day_off' || status === 'today_day_off'
  const isComplete = status === 'past_complete' || status === 'today_complete'
  const isSkipped = status === 'past_skip' || status === 'today_skip'
  const canLog = isPast || isToday
  // Past dates can also be marked Day Off — mirrors TodayPage's catch-up flow
  // which calls markDaysAsOff for unlogged past days.
  const canDayOff = isPast || isToday || isFuture

  const [detailTarget, setDetailTarget] = useState<
    | { kind: 'rotation' }
    | { kind: 'extra'; extraId: string }
    | null
  >(null)
  const [selectedIdx, setSelectedIdx] = useState(planDayIndex)
  const [showPicker, setShowPicker] = useState(false)
  const [showAddExtra, setShowAddExtra] = useState(false)
  const [extraType, setExtraType] = useState<WorkoutType>('yoga')
  const [extraName, setExtraName] = useState('')
  const [confirmDeleteExtraId, setConfirmDeleteExtraId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // If we're showing an extra's detail but the extra was deleted (e.g. another tab), reset.
  // Use useEffect rather than calling setState during render to avoid the strict-mode warning.
  useEffect(() => {
    if (detailTarget?.kind === 'extra') {
      const stillExists = extras.some(e => e.id === detailTarget.extraId)
      if (!stillExists) setDetailTarget(null)
    }
  }, [detailTarget, extras])

  const dateLabel = format(new Date(calendarDate + 'T00:00'), 'EEEE, MMMM d')

  function submitAddExtra() {
    const name = extraName.trim() || WORKOUT_TYPES.find(w => w.type === extraType)?.label || extraType
    onAddExtra(extraType, name)
    setExtraName('')
    setExtraType('yoga')
    setShowAddExtra(false)
  }

  // ─── Level 1: Overview ───────────────────────────────────────────────────
  const rotOutcomeLevel1 = outcomes[makeWorkoutInstanceId(plan.id, calendarDate)] ?? null
  const effortLabels = ['', '●', '●●', '●●●', '●●●●', '●●●●●'] as const
  const effortColors = ['', 'text-emerald-400', 'text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400'] as const

  if (!detailTarget) {
    const statusInfo = isDayOff
      ? { label: 'Day Off', cls: 'text-amber-400 bg-amber-400/10' }
      : isComplete
        ? { label: 'Done', cls: 'text-emerald-400 bg-emerald-400/10' }
        : isSkipped
          ? { label: 'Skipped', cls: 'text-slate-400 bg-slate-700' }
          : status === 'today_pending'
            ? { label: 'Today', cls: 'text-sky-400 bg-sky-400/10' }
            : status === 'future'
              ? { label: 'Upcoming', cls: 'text-slate-500 bg-slate-700/50' }
              : { label: 'Unlogged', cls: 'text-rose-400 bg-rose-400/10' }

    return (
      <Modal title={dateLabel} onClose={onClose}>
        <div className="space-y-2">
          {/* Rotation entry row — completed entries go directly to OutcomeModal */}
          <div className="space-y-1">
            <button
              onClick={() => isCompleteForDirect ? onEditOutcome() : setDetailTarget({ kind: 'rotation' })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-700/40 border border-slate-700 hover:border-slate-600 text-left transition-colors active:scale-[0.98]"
            >
              {resolved.planDay.slots[0] && !isDayOff && (
                <WorkoutBadge type={resolved.planDay.slots[0].type} size="sm" />
              )}
              {isDayOff && <Coffee size={14} className="text-amber-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {isDayOff ? 'Day Off' : resolved.planDay.slots.map(s => s.name).join(' + ')}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
              <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            </button>
            {isCompleteForDirect && rotOutcomeLevel1?.perceivedEffort && (
              <p className={`text-[10px] px-1 leading-none ${effortColors[rotOutcomeLevel1.perceivedEffort]}`}>
                {effortLabels[rotOutcomeLevel1.perceivedEffort]}
              </p>
            )}
            {isCompleteForDirect && rotOutcomeLevel1?.notes && (
              <p className="text-[11px] text-slate-500 italic truncate px-1">
                "{rotOutcomeLevel1.notes}"
              </p>
            )}
            {isCompleteForDirect && (
              <div className="flex items-center gap-3 px-1">
                <button
                  onClick={() => setDetailTarget({ kind: 'rotation' })}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Manage entry (clear, change day…)
                </button>
                {!isFuture && !isDayOff && (
                  <button
                    onClick={() => {
                      const loggedIdx = resolved.historyEntry?.planDayIndex ?? resolved.planDayIndex
                      const resumeDay = plan.days[loggedIdx] ?? resolved.planDay
                      onResumeRotation(resumeDay, calendarDate)
                    }}
                    className="text-[10px] text-sky-500 hover:text-sky-400 transition-colors"
                  >
                    Resume workout
                  </button>
                )}
              </div>
            )}
            {hasEntry && (
              <button
                onClick={onClear}
                className="text-[10px] text-rose-500 hover:text-rose-400 transition-colors px-1"
              >
                Delete workout entry
              </button>
            )}
          </div>

          {/* Extra entries */}
          {extras.map(extra => {
            const iid = makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id)
            const hasOutcome = !!outcomes[iid]
            return (
              <button
                key={extra.id}
                onClick={() => hasOutcome ? onEditExtraOutcome(extra) : setDetailTarget({ kind: 'extra', extraId: extra.id })}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-700/30 border border-slate-700/50 hover:border-slate-600 text-left transition-colors active:scale-[0.98]"
              >
                <WorkoutBadge type={extra.workoutType} size="sm" />
                <span className="flex-1 text-sm text-slate-200 truncate">{extra.workoutName}</span>
                <span className="text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Extra</span>
                {hasOutcome && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
                <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
              </button>
            )
          })}

          {/* Add workout */}
          {!showAddExtra ? (
            <button
              onClick={() => setShowAddExtra(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-600 hover:border-sky-500/50 text-slate-500 hover:text-sky-400 text-sm transition-colors"
            >
              <Plus size={14} /> Add workout for this day
            </button>
          ) : (
            <div className="bg-slate-700/60 border border-slate-600 rounded-xl p-3 space-y-2">
              <p className="text-xs text-slate-400 font-medium">New workout</p>
              <select
                value={extraType}
                onChange={e => setExtraType(e.target.value as WorkoutType)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {WORKOUT_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
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
                <button onClick={() => { setShowAddExtra(false); setExtraName('') }} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // ─── Level 2: Extra detail ────────────────────────────────────────────────
  if (detailTarget.kind === 'extra') {
    const extra = extras.find(e => e.id === detailTarget.extraId)
    if (!extra) return null // useEffect above will reset detailTarget on next render
    const iid = makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id)
    const extraOutcome = outcomes[iid] ?? null

    return (
      <Modal title={dateLabel} onClose={onClose}>
        <div className="space-y-4">
          <button
            onClick={() => { setDetailTarget(null); setConfirmDeleteExtraId(null) }}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-2">
            <WorkoutBadge type={extra.workoutType} size="sm" />
            <span className="text-sm font-semibold text-slate-200 flex-1">{extra.workoutName}</span>
            <span className="text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-full font-medium">Extra</span>
          </div>

          {extraOutcome && <OutcomeMetrics outcome={extraOutcome} />}

          <button
            onClick={() => onEditExtraOutcome(extra)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
          >
            <ClipboardList size={15} /> {extraOutcome ? 'Edit Details' : 'Log Details'}
          </button>
          {!isFuture && (
            <button
              onClick={() => onResumeExtra(extra)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
            >
              <Play size={15} /> Resume Workout
            </button>
          )}

          {confirmDeleteExtraId === extra.id ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-slate-400 text-center">Delete this workout?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteExtraId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={() => { onDeleteExtra(extra); setDetailTarget(null) }} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteExtraId(extra.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </Modal>
    )
  }

  // ─── Level 2: Rotation detail ─────────────────────────────────────────────
  const rotOutcome = outcomes[makeWorkoutInstanceId(plan.id, calendarDate)] ?? null
  const displayDay = plan.days[selectedIdx] ?? resolved.planDay

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-4">
        <button
          onClick={() => { setDetailTarget(null); setShowPicker(false) }}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {/* Workout slots */}
        {isDayOff ? (
          <div className="flex items-center gap-2">
            <Coffee size={16} className="text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Day Off</span>
          </div>
        ) : (
          <>
            <div className={`space-y-2 ${displayDay.slots.length > 1 ? 'divide-y divide-slate-700/50' : ''}`}>
              {displayDay.slots.map((slot, i) => (
                <WorkoutSlotDetails key={slot.id} slot={slot} planId={plan.id} className={i > 0 ? 'pt-2' : ''} />
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  try {
                    const shortDate = format(new Date(calendarDate + 'T00:00'), 'EEE, MMM d')
                    await navigator.clipboard.writeText(
                      formatWorkoutForClipboard(displayDay, plan.name, shortDate),
                    )
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch { /* clipboard access denied */ }
                }}
                title="Copy workout to clipboard"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  copied
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy workout'}
              </button>
            </div>
          </>
        )}

        {/* Already logged */}
        {hasEntry && !isDayOff && (
          <div className="space-y-3">
            {isComplete && (
              <button
                onClick={onEditOutcome}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-sm font-semibold transition-colors"
              >
                <ClipboardList size={16} /> View &amp; Edit Workout Details
              </button>
            )}

            <div className={`flex items-center gap-2 py-2 px-3 rounded-xl ${
              isComplete ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-slate-700/50 border border-slate-600'
            }`}>
              {isComplete && <CheckCircle2 size={16} className="text-emerald-400" />}
              {isSkipped && <SkipForward size={16} className="text-slate-400" />}
              <span className={`text-sm font-medium capitalize ${isComplete ? 'text-emerald-400' : 'text-slate-300'}`}>
                {historyEntry?.action.replace(/_/g, ' ')}
              </span>
            </div>

            {rotOutcome && <OutcomeMetrics outcome={rotOutcome} />}

            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-red-500/20 border border-slate-600 hover:border-red-500/30 text-slate-400 hover:text-red-400 text-sm font-medium transition-colors"
            >
              <X size={14} /> Clear entry
            </button>
          </div>
        )}

        {/* Logged day off */}
        {isDayOff && hasEntry && (
          <button
            onClick={onClear}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
          >
            <X size={14} /> Cancel Day Off
          </button>
        )}

        {/* Not yet logged */}
        {!hasEntry && (canLog || canDayOff) && (
          <div className="space-y-2">
            {canLog && (
              <>
                <button
                  onClick={() => setShowPicker(v => !v)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ChevronRight size={12} className={`transition-transform ${showPicker ? 'rotate-90' : ''}`} />
                  Change rotation day
                </button>
                {showPicker && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {plan.days.map((day, idx) => (
                      <button
                        key={day.id}
                        onClick={() => setSelectedIdx(idx)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${
                          selectedIdx === idx
                            ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                            : 'bg-slate-700/60 border-slate-700 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                          selectedIdx === idx ? 'bg-sky-500 text-white' : 'bg-slate-600 text-slate-300'
                        }`}>{idx + 1}</span>
                        {day.slots.map(s => s.name).join(' + ')}
                        {selectedIdx === idx && <CheckCircle2 size={12} className="ml-auto text-sky-400" />}
                      </button>
                    ))}
                  </div>
                )}
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
            {canDayOff && (
              <button
                onClick={() => onLog('day_off', selectedIdx)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors active:scale-95"
              >
                <Coffee size={16} /> Mark Day Off
              </button>
            )}
          </div>
        )}

        {/* Future with no actions (shouldn't happen since canDayOff covers future) */}
        {!hasEntry && !canLog && !canDayOff && (
          <div className="space-y-1">
            {resolved.planDay.slots.map(slot => (
              <div key={slot.id} className="flex flex-wrap gap-3 text-xs text-slate-400">
                {slot.targetDistance && <span>{slot.targetDistance} mi</span>}
                {slot.targetPace && <span>{slot.targetPace} min/mi</span>}
                {slot.targetTime && <span>{slot.targetTime} min</span>}
              </div>
            ))}
          </div>
        )}

        {historyEntry?.notes && (
          <p className="text-sm text-slate-400 italic">"{historyEntry.notes}"</p>
        )}
      </div>
    </Modal>
  )
}
