import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  SkipForward,
  Coffee,
  ChevronRight,
  ChevronLeft,
  Shuffle,
  Pencil,
  ListPlus,
  RotateCcw,
  TrendingUp,
  Info,
  PlusCircle,
  X,
  PartyPopper,
  CheckCircle2,
  Play,
} from 'lucide-react'
import { useActivePlan } from '../hooks/useActivePlan'
import { usePlanActions } from '../hooks/usePlanActions'
import { useExpiryDismiss } from '../hooks/useExpiryDismiss'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { useProgramStore } from '../store/programStore'
import { WorkoutDayCard } from '../components/workout/WorkoutDayCard'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { ActiveWorkoutTracker } from '../components/workout/ActiveWorkoutTracker'
import type { WorkoutSessionMeta } from '../components/workout/ActiveWorkoutTracker'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import { generateRunAdaptationNote, generateDifficultySpacingWarning } from '../modules/recommendation/explanation'
import { resolveWorkoutDisplayTarget } from '../modules/run-adaptation/selectors'
import { isRunType } from '../modules/workout-metadata/types'
import { isPlanExpired } from '../engine/rotationEngine'
import { computeHistoryStats, countPastUnloggedDays, computeRotationCycleProgress } from '../lib/historyStats'
import type { ResolvedDay, ExtraWorkoutEntry, PlanDay } from '../types'
import type { WorkoutOutcome, LoggedExerciseActual, LoggedSetActual } from '../modules/workout-outcomes/types'

/** Find the most recent outcome with weights data for this plan (excluding today). */
function findPreviousWeightsOutcome(
  planId: string,
  currentDate: string,
  outcomes: Record<string, WorkoutOutcome>,
): WorkoutOutcome | null {
  const prefix = planId + '_'
  let best: WorkoutOutcome | null = null
  for (const outcome of Object.values(outcomes)) {
    if (!outcome.workoutInstanceId.startsWith(prefix)) continue
    const rest = outcome.workoutInstanceId.slice(prefix.length)
    if (rest.startsWith(currentDate)) continue
    if (!outcome.weightsActual?.exercises?.length) continue
    if (!best || (outcome.completedAt ?? '') > (best.completedAt ?? '')) best = outcome
  }
  return best
}

/** Find latest prior sets per exercise for this plan (excluding today). */
function findPreviousSetsByExercise(
  planId: string,
  currentDate: string,
  outcomes: Record<string, WorkoutOutcome>,
): Record<string, LoggedSetActual[]> {
  const prefix = planId + '_'
  const sortedOutcomes = Object.values(outcomes)
    .filter(outcome => {
      if (!outcome.workoutInstanceId.startsWith(prefix)) return false
      const rest = outcome.workoutInstanceId.slice(prefix.length)
      if (rest.startsWith(currentDate)) return false
      return Boolean(outcome.weightsActual?.exercises?.length)
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  const previousByExercise: Record<string, LoggedSetActual[]> = {}
  for (const outcome of sortedOutcomes) {
    for (const ex of outcome.weightsActual?.exercises ?? []) {
      if (!previousByExercise[ex.exercise]) {
        previousByExercise[ex.exercise] = ex.sets
      }
    }
  }

  return previousByExercise
}

function extraToPlanDay(extra: ExtraWorkoutEntry): PlanDay {
  return {
    id: extra.id,
    label: extra.workoutName,
    slots: [{ id: extra.id, type: extra.workoutType, name: extra.workoutName }],
  }
}

export function TodayPage() {
  const navigate = useNavigate()
  const { plan, todayResolved, upcoming, planEntries } = useActivePlan()
  const actions = usePlanActions(plan?.id ?? null)
  const logAction = useHistoryStore(s => s.logAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const updateEntryDate = useHistoryStore(s => s.updateEntryDate)
  const addExtraEntry = useHistoryStore(s => s.addExtraEntry)
  const updateExtraEntryDate = useHistoryStore(s => s.updateExtraEntryDate)
  const removeExtraEntry = useHistoryStore(s => s.removeExtraEntry)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const getOutcome = useOutcomeStore(s => s.getOutcome)
  const getProgressionState = useOutcomeStore(s => s.getProgressionState)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const moveOutcome = useOutcomeStore(s => s.moveOutcome)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { isDismissed: expiryBannerDismissed, dismiss: dismissExpiryBanner } = useExpiryDismiss(plan?.id ?? null)

  const allOutcomes = useOutcomeStore(s => s.outcomes)
  const programVarsMap = useProgramStore(s => s.vars)
  const planProgramVars = useMemo(
    () => (plan ? (programVarsMap[plan.id] ?? {}) : {}),
    [plan, programVarsMap],
  )
  const previousWeightsOutcome = useMemo(
    () => (plan ? findPreviousWeightsOutcome(plan.id, today, allOutcomes) : null),
    [plan, today, allOutcomes],
  )
  const previousSetsByExercise = useMemo(
    () => (plan ? findPreviousSetsByExercise(plan.id, today, allOutcomes) : {}),
    [plan, today, allOutcomes],
  )

  const [showOutcomeModal, setShowOutcomeModal] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [doubleDay, setDoubleDay] = useState(false)
  const [loggingUpcoming, setLoggingUpcoming] = useState<{ rd: ResolvedDay; extraId?: string } | null>(null)
  const [showUpcomingOutcome, setShowUpcomingOutcome] = useState(false)
  const [upcomingLogError, setUpcomingLogError] = useState<string | null>(null)
  // After the primary double-day workout is confirmed, we open a second
  // OutcomeModal for the bonus. State carries the bonus's ResolvedDay plus the
  // ExtraWorkoutEntry id assigned when it was persisted.
  const [bonusOutcome, setBonusOutcome] = useState<{ rd: ResolvedDay; extraId: string } | null>(null)
  const [editingExtra, setEditingExtra] = useState<ExtraWorkoutEntry | null>(null)

  // Active workout tracker state: hidden | open | minimized
  const [activeWorkoutState, setActiveWorkoutState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  // Exercises tracked during active session — used to pre-fill OutcomeModal
  const [activeTrackedExercises, setActiveTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [activeTrackedDurationMin, setActiveTrackedDurationMin] = useState<number | null>(null)

  if (!plan || !todayResolved) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-12">
          <EmptyState
            title="No active plan"
            description="Create or activate a plan to start tracking your workouts."
            action={
              <button
                onClick={() => navigate('/plans')}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold"
              >
                Go to Plans
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const isPending = todayResolved.status === 'today_pending'
  const isResolved = !isPending
  const planExpired = isPlanExpired(plan, planEntries, today)
  const planExtras = extraEntries.filter(e => e.planId === plan.id)
  const todayExtras = planExtras
    .filter(e => e.calendarDate === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const instanceId = makeWorkoutInstanceId(plan.id, today)
  const existingOutcome = getOutcome(instanceId)

  // The workout actually logged for today may differ from `todayResolved.planDay`
  // after a double-day advance — the rotation pointer has moved on, but the
  // primary entry still refers to the original day. Prefer the history entry's
  // planDayIndex so the displayed/edited workout matches what was logged.
  const primaryPlanDayIndex = todayResolved.historyEntry?.planDayIndex ?? todayResolved.planDayIndex
  const primaryPlanDay = plan.days[primaryPlanDayIndex] ?? todayResolved.planDay

  // Resolve run adaptation note for today's workout
  const todayRunSlot = todayResolved.planDay.slots.find(s => isRunType(s.type))
  const todayProgressionState = todayRunSlot?.runConfig?.progressionGroupId
    ? getProgressionState(todayRunSlot.runConfig.progressionGroupId)
    : null
  const todayAdaptationNote = todayRunSlot
    ? generateRunAdaptationNote(todayRunSlot, todayProgressionState)
    : null

  // Difficulty spacing warning (today vs tomorrow) — suppressed in double-day mode
  // since the user is intentionally stacking workouts
  const tomorrowSlot = upcoming[doubleDay ? 1 : 0]?.planDay?.slots[0]
  const spacingWarning = !doubleDay && generateDifficultySpacingWarning(
    todayResolved.planDay.slots[0]?.difficulty,
    tomorrowSlot?.difficulty,
  )

  // Stats for the compact stats bar (scoped to the active plan's history)
  const stats = computeHistoryStats(planEntries, planExtras, today)

  // Count recent past days with no entry — used to show the stall nudge.
  const unloggedCount = countPastUnloggedDays(plan.id, planEntries, plan.startDate, today)

  // Rotation cycle progress — for rotations-duration plans only
  const cycleProgress = computeRotationCycleProgress(plan, planEntries)

  function handleActiveWorkoutComplete(exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) {
    setActiveTrackedExercises(exercises)
    setActiveTrackedDurationMin(Math.round(meta.totalElapsedSeconds / 60) || null)
    setActiveWorkoutState('hidden')
    setShowOutcomeModal(true)
  }

  function handleCompleteClick() {
    setShowOutcomeModal(true)
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    setActiveTrackedExercises(null)
    setActiveTrackedDurationMin(null)
    const completedDate = outcome.completedAt
      ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
      : today
    const action = completionStateToAction(outcome.completionState)
    logAction(plan!.id, today, primaryPlanDayIndex, action, outcome.notes ?? undefined)

    if (completedDate !== today) {
      const todayEntry = useHistoryStore.getState().entries.find(
        e => e.planId === plan!.id && e.calendarDate === today,
      )
      if (todayEntry) {
        removeEntry(plan!.id, completedDate)
        updateEntryDate(todayEntry.id, completedDate)
      }
      moveOutcome(
        makeWorkoutInstanceId(plan!.id, today),
        makeWorkoutInstanceId(plan!.id, completedDate),
      )
      outcome = { ...outcome, workoutInstanceId: makeWorkoutInstanceId(plan!.id, completedDate) }
    }

    const primarySlot = primaryPlanDay.slots[0]
    if (primarySlot) {
      logOutcomeWithProgression(outcome, primarySlot)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
    }

    // Double-day: persist the bonus workout as an ExtraWorkoutEntry on today's
    // date (the rotation's HistoryEntry is already taken by the primary), then
    // open a second OutcomeModal so the user can log the bonus outcome. The
    // rotation pointer is also advanced so tomorrow projects past the bonus.
    if (doubleDay && upcoming[0]) {
      const bonus = upcoming[0]
      const bonusSlot = bonus.planDay.slots[0]
      const extraId = addExtraEntry({
        planId: plan!.id,
        calendarDate: today,
        workoutType: bonusSlot?.type ?? 'rest',
        workoutName: bonus.planDay.label,
        source: 'double_day',
      })
      actions.advance()
      setBonusOutcome({ rd: bonus, extraId })
    }

    setDoubleDay(false)
    setShowOutcomeModal(false)
  }

  function handleBonusOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!bonusOutcome) return
    const completedDate = outcome.completedAt
      ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
      : today
    if (completedDate !== today) {
      updateExtraEntryDate(bonusOutcome.extraId, completedDate)
      const oldId = makeExtraWorkoutInstanceId(plan!.id, today, bonusOutcome.extraId)
      const nextId = makeExtraWorkoutInstanceId(plan!.id, completedDate, bonusOutcome.extraId)
      moveOutcome(oldId, nextId)
      outcome = { ...outcome, workoutInstanceId: nextId }
    }
    const slot = bonusOutcome.rd.planDay.slots[0]
    if (slot) {
      logOutcomeWithProgression(outcome, slot)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
    }
    setBonusOutcome(null)
  }

  function handleBonusOutcomeDismiss() {
    // Closing without confirming keeps the ExtraWorkoutEntry (the workout
    // happened) but leaves the outcome blank — matches how ad-hoc extras
    // created from the History page behave until the user fills them in.
    setBonusOutcome(null)
  }

  function handleSkip() {
    if (!todayResolved) return
    actions.skip(todayResolved.planDayIndex)
  }

  function handleDayOff() {
    actions.dayOff()
  }

  function handleEditOutcome() {
    setShowOutcomeModal(true)
  }

  function handleUpcomingLog(rd: ResolvedDay, action: 'complete' | 'skip' | 'day_off') {
    // A 'complete' on a future-dated upcoming workout records the session on
    // today — the day it was actually performed — instead of the scheduled date.
    const logDate = action === 'complete' ? today : rd.calendarDate
    // If today's primary entry is already taken, treat this as an extra
    // completion (double-day style) so the original primary log is preserved.
    if (action === 'complete' && logDate === today && isResolved) {
      const bonusSlot = rd.planDay.slots[0]
      const extraId = addExtraEntry({
        planId: plan!.id,
        calendarDate: today,
        workoutType: bonusSlot?.type ?? 'rest',
        workoutName: rd.planDay.label,
        source: 'double_day',
      })
      actions.advance()
      setUpcomingLogError(null)
      setLoggingUpcoming({ rd, extraId })
      setShowUpcomingOutcome(true)
      return
    }
    setUpcomingLogError(null)
    logAction(plan!.id, logDate, rd.planDayIndex, action)
    if (action === 'complete') {
      setLoggingUpcoming({ rd })
      setShowUpcomingOutcome(true)
    } else {
      setLoggingUpcoming(null)
    }
  }

  function handleUpcomingOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!loggingUpcoming) return
    const slot = loggingUpcoming.rd.planDay.slots[0]
    const instanceId = loggingUpcoming.extraId
      ? makeExtraWorkoutInstanceId(plan!.id, today, loggingUpcoming.extraId)
      : undefined
    const outcomeWithId = instanceId ? { ...outcome, workoutInstanceId: instanceId } : outcome
    const completedDate = outcomeWithId.completedAt
      ? format(new Date(outcomeWithId.completedAt), 'yyyy-MM-dd')
      : today
    const finalOutcome = { ...outcomeWithId }
    if (instanceId && loggingUpcoming.extraId && completedDate !== today) {
      updateExtraEntryDate(loggingUpcoming.extraId, completedDate)
      const nextId = makeExtraWorkoutInstanceId(plan!.id, completedDate, loggingUpcoming.extraId)
      moveOutcome(instanceId, nextId)
      finalOutcome.workoutInstanceId = nextId
    }
    if (slot) {
      logOutcomeWithProgression(finalOutcome, slot)
    } else {
      useOutcomeStore.getState().setOutcome(finalOutcome)
    }
    setShowUpcomingOutcome(false)
    setLoggingUpcoming(null)
  }

  function handleUpcomingClear(rd: ResolvedDay) {
    removeEntry(plan!.id, rd.calendarDate)
    removeOutcome(makeWorkoutInstanceId(plan!.id, rd.calendarDate))
    setLoggingUpcoming(null)
  }

  return (
    <div className="px-4 pt-safe space-y-4">
      {/* Header */}
      <div className="pt-6 pb-2">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold text-white mt-0.5">{plan.name}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Day {todayResolved.planDayIndex + 1} of {plan.days.length} in rotation
          {cycleProgress && cycleProgress.doneInCycle > 0 && (
            <span className="ml-1.5">
              · <span className="text-slate-400">{cycleProgress.doneInCycle}/{cycleProgress.rotationLength} done</span>
              {cycleProgress.remaining === 1 && <span className="ml-1 text-emerald-400/80">· last one!</span>}
            </span>
          )}
          {cycleProgress?.justCompletedRotation && (
            <span className="ml-1.5 text-emerald-400/80">· rotation complete!</span>
          )}
        </p>
      </div>

      {/* Stats bar — streak + this-week count */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-base leading-none">🔥</span>
          <div>
            <p className="text-xs text-slate-500 leading-none mb-0.5">Streak</p>
            <p className="text-sm font-bold text-white leading-none">
              {stats.currentStreak}
              <span className="text-xs font-normal text-slate-400 ml-1">day{stats.currentStreak !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-base leading-none">📅</span>
          <div>
            <p className="text-xs text-slate-500 leading-none mb-0.5">This week</p>
            <p className="text-sm font-bold text-white leading-none">
              {stats.last7Completed}
              <span className="text-xs font-normal text-slate-400 ml-1">done</span>
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-base leading-none">✅</span>
          <div>
            <p className="text-xs text-slate-500 leading-none mb-0.5">Total</p>
            <p className="text-sm font-bold text-white leading-none">
              {stats.totalCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1">done</span>
            </p>
          </div>
        </div>
      </div>

      {/* Unlogged past days nudge — shown when the rotation may be stalled */}
      {unloggedCount > 0 && (
        <button
          onClick={() => navigate('/calendar')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-left hover:bg-slate-700 transition-colors"
        >
          <Info size={13} className="text-slate-400 flex-shrink-0" />
          <p className="flex-1 text-xs text-slate-400">
            {unloggedCount} day{unloggedCount === 1 ? '' : 's'} in the past week without entries — rotation may be stalled.
          </p>
          <span className="text-xs text-sky-400 font-medium flex-shrink-0">Calendar →</span>
        </button>
      )}

      {/* Plan completion / expiry banner */}
      {planExpired && !expiryBannerDismissed && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <PartyPopper size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-300 font-medium">Plan complete!</p>
            <p className="text-xs text-purple-400/70 mt-0.5">
              You've finished all {plan.duration.value} {plan.duration.type} of this plan.
              Consider activating a new plan or cycling this one.
            </p>
          </div>
          <button
            onClick={() => navigate('/plans')}
            className="text-xs text-purple-400 hover:text-purple-200 font-medium flex-shrink-0 ml-1"
          >
            Plans →
          </button>
          <button
            onClick={dismissExpiryBanner}
            className="text-purple-400/60 hover:text-purple-200 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Adaptation note for today's run */}
      {todayAdaptationNote && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
          <TrendingUp size={14} className="text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-sky-300">{todayAdaptationNote}</p>
        </div>
      )}

      {/* Difficulty spacing warning */}
      {spacingWarning && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Info size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orange-300">{spacingWarning}</p>
        </div>
      )}

      {/* Completed today summary */}
      {(todayResolved.status === 'today_complete' || todayExtras.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Completed today</h2>
          {todayResolved.status === 'today_complete' && (
            <button
              onClick={handleEditOutcome}
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
            <button
              key={extra.id}
              onClick={() => setEditingExtra(extra)}
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
          ))}
        </section>
      )}

      {/* Today's workout — or rest card if day off */}
      {todayResolved.status === 'today_day_off' ? (
        <div className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-4 flex items-center gap-3">
          <Coffee size={22} className="text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-400">Rest Day</p>
            <p className="text-xs text-slate-600 mt-0.5">No workout logged — rotation continues tomorrow</p>
          </div>
        </div>
      ) : (
        <WorkoutDayCard resolved={todayResolved} isToday />
      )}

      {/* Double-day bonus workout */}
      {doubleDay && upcoming[0] && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PlusCircle size={11} /> Also today
          </p>
          <WorkoutDayCard resolved={upcoming[0]} />
        </div>
      )}

      {/* Start Workout button — only when pending and no active session */}
      {isPending && activeWorkoutState === 'hidden' && (
        <button
          onClick={() => setActiveWorkoutState('open')}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors active:scale-[0.98]"
        >
          <Play size={18} />
          Start Workout
        </button>
      )}

      {/* Action buttons — only show if pending */}
      {isPending && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCompleteClick}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-colors active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span className="text-xs font-semibold">Complete</span>
          </button>
          <button
            onClick={handleSkip}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors active:scale-95"
          >
            <SkipForward size={22} />
            <span className="text-xs font-semibold">Skip</span>
          </button>
          <button
            onClick={handleDayOff}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors active:scale-95"
          >
            <Coffee size={22} />
            <span className="text-xs font-semibold">Day Off</span>
          </button>
        </div>
      )}

      {/* Double-day toggle — only when pending and there's a next workout */}
      {isPending && upcoming.length > 0 && (
        doubleDay ? (
          <button
            onClick={() => setDoubleDay(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors"
          >
            <X size={13} /> Cancel double day
          </button>
        ) : (
          <button
            onClick={() => setDoubleDay(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-sky-400 text-xs font-medium transition-colors"
          >
            <PlusCircle size={13} /> Also do {upcoming[0].planDay.label} today
          </button>
        )
      )}

      {/* Resolved actions */}
      {isResolved && (
        <div className="flex gap-2">
          <button
            onClick={handleEditOutcome}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
          >
            <Pencil size={13} /> Edit outcome
          </button>
          <button
            onClick={() => {
              // Undo clears today's primary entry/outcome and extras that
              // originated from the double-day flow. Extras added manually
              // from the History or Calendar page (source === 'history') are
              // left alone — they were independent user actions, not part of
              // this workout's logging flow. Old records without a source
              // field are treated conservatively as double_day to avoid
              // leaving orphaned extras behind on upgrade.
              removeEntry(plan.id, today)
              removeOutcome(makeWorkoutInstanceId(plan.id, today))
              for (const ex of extraEntries) {
                if (
                  ex.planId === plan.id &&
                  ex.calendarDate === today &&
                  ex.source !== 'history'
                ) {
                  removeOutcome(makeExtraWorkoutInstanceId(plan.id, today, ex.id))
                  removeExtraEntry(ex.id)
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors"
          >
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      )}

      {/* Override controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowOverride(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
        >
          <Shuffle size={13} /> Override
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.slice(doubleDay ? 1 : 0, doubleDay ? 6 : 5).map(rd => {
              // Show adaptation note for upcoming run slots
              const upcomingRunSlot = rd.planDay.slots.find(s => isRunType(s.type))
              const upcomingGroupId = upcomingRunSlot?.runConfig?.progressionGroupId
              const upcomingProgression = upcomingGroupId ? getProgressionState(upcomingGroupId) : null
              const upcomingTarget = upcomingRunSlot
                ? resolveWorkoutDisplayTarget(upcomingRunSlot, upcomingProgression)
                : null
              const upcomingNote = upcomingTarget?.adaptationNote

              return (
                <div key={rd.calendarDate} className="flex items-center gap-3">
                  <div className="w-10 text-center flex-shrink-0">
                    <p className="text-xs text-slate-500 font-medium">
                      {new Date(rd.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <WorkoutDayCard resolved={rd} onClick={() => setLoggingUpcoming({ rd })} />
                    {upcomingNote && (
                      <p className="text-[10px] text-sky-400/80 mt-1 ml-1 flex items-center gap-1">
                        <TrendingUp size={10} />{upcomingNote}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Outcome modal */}
      {showOutcomeModal && (
        <OutcomeModal
          planId={plan.id}
          calendarDate={today}
          planDay={primaryPlanDay}
          previousSetsByExercise={previousSetsByExercise}
          existingOutcome={
            activeTrackedExercises
              ? {
                  workoutInstanceId: makeWorkoutInstanceId(plan.id, today),
                  completionState: 'completed',
                  completedAt: new Date().toISOString(),
                  durationActualMin: activeTrackedDurationMin,
                  perceivedEffort: null,
                  notes: null,
                  runActual: null,
                  swimActual: null,
                  weightsActual: { exercises: activeTrackedExercises },
                }
              : existingOutcome
          }
          onConfirm={handleOutcomeConfirm}
          onClose={() => {
            setShowOutcomeModal(false)
            setActiveTrackedExercises(null)
            setActiveTrackedDurationMin(null)
          }}
        />
      )}

      {/* Active workout tracker — kept mounted while open or minimized so timers keep running */}
      {activeWorkoutState !== 'hidden' && plan && todayResolved && (() => {
        const slot = primaryPlanDay.slots[0]
        if (!slot) return null
        return (
          <ActiveWorkoutTracker
            planId={plan.id}
            workoutInstanceId={makeWorkoutInstanceId(plan.id, today)}
            planDay={primaryPlanDay}
            slot={slot}
            programVars={planProgramVars}
            previousOutcome={previousWeightsOutcome}
            resumeOutcome={existingOutcome}
            previousSetsByExercise={previousSetsByExercise}
            minimized={activeWorkoutState === 'minimized'}
            onMinimize={() => setActiveWorkoutState('minimized')}
            onResume={() => setActiveWorkoutState('open')}
            onCancel={() => setActiveWorkoutState('hidden')}
            onComplete={handleActiveWorkoutComplete}
          />
        )
      })()}

      {/* Edit outcome for a completed extra workout (double-day bonus or ad-hoc) */}
      {editingExtra && (() => {
        const extraInstanceId = makeExtraWorkoutInstanceId(plan.id, today, editingExtra.id)
        return (
          <OutcomeModal
            planId={plan.id}
            calendarDate={today}
            planDay={extraToPlanDay(editingExtra)}
            workoutInstanceId={extraInstanceId}
            existingOutcome={getOutcome(extraInstanceId)}
            onConfirm={(outcome) => {
              const slot = extraToPlanDay(editingExtra).slots[0]
              const completedDate = outcome.completedAt
                ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
                : today
              let extraOutcome = { ...outcome, workoutInstanceId: extraInstanceId }
              if (completedDate !== today) {
                updateExtraEntryDate(editingExtra.id, completedDate)
                const nextId = makeExtraWorkoutInstanceId(plan.id, completedDate, editingExtra.id)
                moveOutcome(extraInstanceId, nextId)
                extraOutcome = { ...extraOutcome, workoutInstanceId: nextId }
              }
              if (slot) {
                logOutcomeWithProgression(extraOutcome, slot)
              } else {
                useOutcomeStore.getState().setOutcome(extraOutcome)
              }
              setEditingExtra(null)
            }}
            onClose={() => setEditingExtra(null)}
          />
        )
      })()}

      {/* Log upcoming workout modal */}
      {loggingUpcoming && !showUpcomingOutcome && (
        <Modal
          title={new Date(loggingUpcoming.rd.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          onClose={() => { setLoggingUpcoming(null); setUpcomingLogError(null) }}
        >
          <div className="space-y-4">
            {/* Workout summary */}
            <div className="space-y-1.5">
              {loggingUpcoming.rd.planDay.slots.map(slot => (
                <div key={slot.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{slot.name}</span>
                  {slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetDistance} mi</span>}
                  {slot.targetTime && !slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetTime} min</span>}
                </div>
              ))}
            </div>

            {loggingUpcoming.rd.historyEntry ? (
              /* Already logged — show status + edit/clear */
              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${
                  loggingUpcoming.rd.historyEntry.action === 'complete' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                  loggingUpcoming.rd.historyEntry.action === 'skip' ? 'bg-slate-700 border border-slate-600' :
                  'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  {loggingUpcoming.rd.historyEntry.action === 'complete' && <CheckCircle2 size={16} className="text-emerald-400" />}
                  {loggingUpcoming.rd.historyEntry.action === 'skip' && <SkipForward size={16} className="text-slate-400" />}
                  {loggingUpcoming.rd.historyEntry.action === 'day_off' && <Coffee size={16} className="text-amber-400" />}
                  <span className={`text-sm font-medium capitalize ${
                    loggingUpcoming.rd.historyEntry.action === 'complete' ? 'text-emerald-400' :
                    loggingUpcoming.rd.historyEntry.action === 'skip' ? 'text-slate-300' : 'text-amber-400'
                  }`}>
                    {loggingUpcoming.rd.historyEntry.action.replace(/_/g, ' ')}
                  </span>
                </div>
                {loggingUpcoming.rd.historyEntry.action === 'complete' && (
                  <button
                    onClick={() => setShowUpcomingOutcome(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
                  >
                    <Pencil size={14} /> Edit workout details
                  </button>
                )}
                <button
                  onClick={() => handleUpcomingClear(loggingUpcoming.rd)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
                >
                  <X size={14} /> Clear entry
                </button>
              </div>
            ) : (
              /* Not yet logged — show action buttons */
              <div className="space-y-2">
                {upcomingLogError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                    <Info size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-300">{upcomingLogError}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpcomingLog(loggingUpcoming.rd, 'complete')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors active:scale-95"
                  >
                    <CheckCircle2 size={16} /> Complete
                  </button>
                  <button
                    onClick={() => handleUpcomingLog(loggingUpcoming.rd, 'skip')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm font-medium transition-colors active:scale-95"
                  >
                    <SkipForward size={16} /> Skip
                  </button>
                </div>
                <button
                  onClick={() => handleUpcomingLog(loggingUpcoming.rd, 'day_off')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors active:scale-95"
                >
                  <Coffee size={16} /> Day Off
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Outcome modal for upcoming workout — new completes attach to today;
          edits of pre-existing entries stay on the entry's original date. */}
      {loggingUpcoming && showUpcomingOutcome && (() => {
        const outcomeDate = loggingUpcoming.rd.historyEntry ? loggingUpcoming.rd.calendarDate : today
        const workoutInstanceId = loggingUpcoming.extraId
          ? makeExtraWorkoutInstanceId(plan.id, today, loggingUpcoming.extraId)
          : makeWorkoutInstanceId(plan.id, outcomeDate)
        return (
          <OutcomeModal
            planId={plan.id}
            calendarDate={outcomeDate}
            planDay={loggingUpcoming.rd.planDay}
            workoutInstanceId={workoutInstanceId}
            existingOutcome={getOutcome(workoutInstanceId)}
            onConfirm={handleUpcomingOutcomeConfirm}
            onClose={() => { setShowUpcomingOutcome(false); setLoggingUpcoming(null) }}
          />
        )
      })()}

      {/* Outcome modal for the double-day bonus workout.
          Opens automatically after the primary outcome is confirmed when
          double-day was on. The bonus is already persisted as an
          ExtraWorkoutEntry; the outcome is keyed by the extra's instance id
          so it doesn't collide with the primary entry's outcome. */}
      {bonusOutcome && (
        <OutcomeModal
          planId={plan.id}
          calendarDate={today}
          planDay={bonusOutcome.rd.planDay}
          workoutInstanceId={makeExtraWorkoutInstanceId(plan.id, today, bonusOutcome.extraId)}
          existingOutcome={getOutcome(makeExtraWorkoutInstanceId(plan.id, today, bonusOutcome.extraId))}
          previousSetsByExercise={previousSetsByExercise}
          onConfirm={handleBonusOutcomeConfirm}
          onClose={handleBonusOutcomeDismiss}
        />
      )}

      {/* Override modal */}
      {showOverride && (
        <Modal title="Override rotation" onClose={() => setShowOverride(false)}>
          <div className="space-y-2">
            <button
              onClick={() => { actions.advance(); setShowOverride(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronRight size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Advance one day</p>
                <p className="text-xs text-slate-400">Move to the next workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={() => { actions.goBack(); setShowOverride(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronLeft size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Go back one day</p>
                <p className="text-xs text-slate-400">Return to the previous workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={() => { setShowOverride(false); setShowJump(true) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ListPlus size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Jump to specific day</p>
                <p className="text-xs text-slate-400">Pick any day from the rotation</p>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* Jump modal */}
      {showJump && (
        <Modal title="Jump to day" onClose={() => setShowJump(false)}>
          <div className="space-y-2">
            {plan.days.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => { actions.jumpTo(idx); setShowJump(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  idx === todayResolved.planDayIndex
                    ? 'bg-sky-500/20 border border-sky-500/50'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{day.label}</p>
                  <p className="text-xs text-slate-400">{day.slots.map(s => s.name).join(' + ')}</p>
                </div>
                {idx === todayResolved.planDayIndex && (
                  <span className="ml-auto text-xs text-sky-400 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
