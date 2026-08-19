import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Coffee,
  Shuffle,
  Pencil,
  RotateCcw,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react'
import { useActivePlan } from '../hooks/useActivePlan'
import { usePlanActions } from '../hooks/usePlanActions'
import { useExpiryDismiss } from '../hooks/useExpiryDismiss'
import { useStallNudgeDismiss } from '../hooks/useStallNudgeDismiss'
import { useStreakMilestoneDismiss } from '../hooks/useStreakMilestoneDismiss'
import { useToday } from '../hooks/useToday'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { useProgramStore } from '../store/programStore'
import { WorkoutDayCard } from '../components/workout/WorkoutDayCard'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { ActiveWorkoutTracker } from '../components/workout/ActiveWorkoutTracker'
import type { WorkoutSessionMeta } from '../components/workout/ActiveWorkoutTracker'
import { CardioWorkoutTracker } from '../components/workout/CardioWorkoutTracker'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import { generateRunAdaptationNote, generateDifficultySpacingWarning } from '../modules/recommendation/explanation'
import { isRunType } from '../modules/workout-metadata/types'
import { isPlanExpired } from '../engine/rotationEngine'
import { computeHistoryStats, getUnloggedPastDates, countTotalUnloggedDays, computePlanProgress, countPlanDayCompletions, computePlanStreak, computeConsecutiveSkips, computeLoggedRate, computeRotationCycleProgress, computeWorkoutCompletionRate, computeAverageWorkoutsPerWeek, computeRotationPlanRemaining } from '../lib/historyStats'
import type { WorkoutCompletionRate } from '../lib/historyStats'
import type { ResolvedDay, ExtraWorkoutEntry, WorkoutSlot } from '../types'
import type { WorkoutOutcome, LoggedExerciseActual, MobilityWorkoutActual, WorkoutCompletionState } from '../modules/workout-outcomes/types'
import type { MobilitySessionCheckpoint } from '../store/mobilityStore'
import { extraToPlanDay } from '../lib/planDayUtils'
import { MobilityTracker } from '../components/workout/MobilityTracker'
import { useMobilityStore } from '../store/mobilityStore'
import { formatWorkoutForClipboard } from '../lib/shareWorkout'
import { findPreviousSessionForPlanDay, buildLastSessionSummary } from '../lib/sessionSummary'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { parseWorkoutInstanceId } from '../lib/workoutInstanceId'
import { outcomeSortKey } from '../lib/outcomeSortKey'
import { findPreviousSetsByExercise } from '../lib/previousSetsHelper'
import { TodayBanners } from '../components/today/TodayBanners'
import { TodayUpcomingList } from '../components/today/TodayUpcomingList'
import { TodayCompletedSection } from '../components/today/TodayCompletedSection'
import { TodayHabitSummary } from '../components/today/TodayHabitSummary'
import { TodayMobilitySection } from '../components/today/TodayMobilitySection'
import { TodayPendingCard } from '../components/today/TodayPendingCard'
import { TodayAdHocWorkout } from '../components/today/TodayAdHocWorkout'
import { TodayPlanProgressModal } from '../components/today/TodayPlanProgressModal'
import { TodayCatchupModal } from '../components/today/TodayCatchupModal'
import { TodayRotationModals } from '../components/today/TodayRotationModals'
import { TodayPRBanner } from '../components/today/TodayPRBanner'
import { TodayCardioPromptModal } from '../components/today/TodayCardioPromptModal'
import { TodayUpcomingLogModal } from '../components/today/TodayUpcomingLogModal'
import { SwipeToDelete } from '../components/shared/SwipeToDelete'
import { WORKOUT_META } from '../lib/constants'
import { estimateRunDurationMin } from '../lib/estimateRunDuration'

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
    if (!best || outcomeSortKey(outcome) > outcomeSortKey(best)) best = outcome
  }
  return best
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
  const markDaysAsOff = useHistoryStore(s => s.markDaysAsOff)
  const removeLastOverrideByType = useHistoryStore(s => s.removeLastOverrideByType)
  const allEntries = useHistoryStore(s => s.entries)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const getOutcome = useOutcomeStore(s => s.getOutcome)
  const getProgressionState = useOutcomeStore(s => s.getProgressionState)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const moveOutcome = useOutcomeStore(s => s.moveOutcome)
  const today = useToday()
  const { isDismissed: expiryBannerDismissed, dismiss: dismissExpiryBanner } = useExpiryDismiss(plan?.id ?? null)
  const { isDismissed: stallNudgeDismissed, dismiss: dismissStallNudge } = useStallNudgeDismiss(plan?.id ?? null)

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

  // Build all-time max load per exercise for PB detection in the session hint.
  const exerciseRecords = useExerciseHistoryStore(s => s.records)
  const maxLoadByExercise = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of exerciseRecords) {
      for (const s of r.sets) {
        if (s.load !== null && s.completed) {
          map[r.exerciseName] = Math.max(map[r.exerciseName] ?? 0, s.load)
        }
      }
    }
    return map
  }, [exerciseRecords])

  // Memoize plan-scoped extras so internal useMemos only re-run when needed.
  const activePlanId = plan?.id ?? null
  const planExtras = useMemo(
    () => extraEntries.filter(e => e.planId === activePlanId),
    [extraEntries, activePlanId],
  )

  const [showOutcomeModal, setShowOutcomeModal] = useState(false)
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [showAddFromPlan, setShowAddFromPlan] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [newPRs, setNewPRs] = useState<string[] | null>(null)
  const [workoutCopied, setWorkoutCopied] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [showCatchupConfirm, setShowCatchupConfirm] = useState(false)
  const [addFromPlanIdx, setAddFromPlanIdx] = useState<number | null>(null)
  const [loggingUpcoming, setLoggingUpcoming] = useState<{ rd: ResolvedDay; extraId?: string } | null>(null)
  const [showUpcomingOutcome, setShowUpcomingOutcome] = useState(false)
  const [upcomingLogError, setUpcomingLogError] = useState<string | null>(null)
  // After the primary double-day workout is confirmed, we open a second
  // OutcomeModal for the bonus. State carries the bonus's ResolvedDay plus the
  // ExtraWorkoutEntry id assigned when it was persisted.
  const [bonusOutcome, setBonusOutcome] = useState<{ rd: ResolvedDay; extraId: string } | null>(null)
  const [editingExtra, setEditingExtra] = useState<ExtraWorkoutEntry | null>(null)
  // Track IDs of double-day extras created in this session so the Undo handler
  // can remove them even when they were backdated to a different calendarDate.
  const sessionExtrasRef = useRef<Set<string>>(new Set())

  // True only when the OutcomeModal was opened via "Edit" on an existing outcome.
  // Prevents PR detection from firing again when the user re-saves the same workout.
  const isEditingOutcomeRef = useRef(false)

  // Active workout tracker state: hidden | open | minimized
  const [activeWorkoutState, setActiveWorkoutState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  // Exercises tracked during active session — used to pre-fill OutcomeModal
  const [activeTrackedExercises, setActiveTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [activeTrackedDurationMin, setActiveTrackedDurationMin] = useState<number | null>(null)
  // Cardio phase state: shown after weights (or as standalone for run-only days)
  const [cardioState, setCardioState] = useState<'hidden' | 'prompt' | 'open' | 'minimized'>('hidden')
  const [cardioTrackedDurationMin, setCardioTrackedDurationMin] = useState<number | null>(null)
  // Mobility state
  const mobilityCompletions = useMobilityStore(s => s.completions)
  const mobilityCompletion = mobilityCompletions[today] ?? null
  const mobilityRoutine = useMobilityStore(s => s.routine)
  const removeMobilityCompletion = useMobilityStore(s => s.removeCompletion)
  const mobilityActiveSession = useMobilityStore(s => s.activeSession)
  const mobilityLogCompletion = useMobilityStore(s => s.logCompletion)
  const mobilityStartSession = useMobilityStore(s => s.startSession)
  const mobilityResumeCompletion = useMobilityStore(s => s.resumeCompletion)
  const mobilitySaveCheckpoint = useMobilityStore(s => s.saveCheckpoint)
  const mobilityClearSession = useMobilityStore(s => s.clearSession)
  const mobilitySoundEnabled = useMobilityStore(s => s.soundEnabled)
  const mobilitySetSoundEnabled = useMobilityStore(s => s.setSoundEnabled)
  const [mobilityState, setMobilityState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  // Scheduled `mobility` slot inside today's plan day — distinct from the
  // standalone global Daily Mobility Routine above. Session state lives only
  // in this component (not persisted) since it tracks a specific plan day's
  // slot rather than the global routine.
  const [mobilitySlotState, setMobilitySlotState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  // Ad hoc workout — start-modal trigger and tracker-active flag; full state lives in TodayAdHocWorkout
  const [adHocOpenRequest, setAdHocOpenRequest] = useState(false)
  const [adHocActive, setAdHocActive] = useState(false)
  const [mobilitySlotSession, setMobilitySlotSession] = useState<MobilitySessionCheckpoint | null>(null)
  // A checkpoint left behind when the tracker unmounts mid-routine — lets
  // today's card offer "Continue"
  // instead of starting the whole routine over. Deliberately does NOT
  // require the checkpoint's exerciseIds to exactly match the live routine:
  // MobilityTracker's reconcileCheckpoint() already re-maps progress onto
  // an edited routine (add/remove/reorder), so a mismatch here doesn't mean
  // the checkpoint is stale — it just means "Manage routine" was used
  // mid-session, which is the case this feature exists to support.
  const mobilityInProgress = !!(
    !mobilityCompletion &&
    mobilityActiveSession &&
    mobilityActiveSession.date === today &&
    (mobilityActiveSession.completedIds.length > 0 || mobilityActiveSession.totalElapsedSec >= 3)
  )

  // Progress ring detail modal
  const [showPlanProgressModal, setShowPlanProgressModal] = useState(false)

  // Mobility dates count toward streak — completing mobility on a day keeps the streak alive.
  // Computed here (before the early-return guard below) since the milestone hook — a
  // Rules-of-Hooks requirement — must be called unconditionally on every render.
  const mobilityDateSet = useMemo(() => new Set(Object.keys(mobilityCompletions)), [mobilityCompletions])
  // Global (not plan-scoped) so switching the active plan doesn't reset the streak — a
  // completed workout counts toward it regardless of which plan was active that day.
  const earlyPlanStreak = useMemo(
    () => (plan ? computePlanStreak(null, allEntries, extraEntries, today, mobilityDateSet) : 0),
    [plan, allEntries, extraEntries, today, mobilityDateSet],
  )
  const { isDismissed: streakMilestoneDismissed, dismiss: dismissStreakMilestone, milestone: streakMilestone } =
    useStreakMilestoneDismiss(earlyPlanStreak)

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

  // Resolve run adaptation note for today's workout.
  // Use primaryPlanDay (the day actually logged) rather than todayResolved.planDay
  // which points to the advanced-to day after a double-day advance — showing guidance
  // for the wrong workout in that case.
  const todayRunSlot = primaryPlanDay.slots.find(s => isRunType(s.type))
  const todayProgressionState = todayRunSlot?.runConfig?.progressionGroupId
    ? getProgressionState(todayRunSlot.runConfig.progressionGroupId)
    : null
  const todayAdaptationNote = todayRunSlot
    ? generateRunAdaptationNote(todayRunSlot, todayProgressionState)
    : null

  // Difficulty spacing warning (today vs tomorrow) — suppressed when an extra workout is queued.
  // Use primaryPlanDay so after a double-day advance the warning reflects the day actually
  // logged, not the advanced-to rotation day.
  const extraIsNextInPlan = addFromPlanIdx !== null && addFromPlanIdx === upcoming[0]?.planDayIndex
  const tomorrowSlot = upcoming[extraIsNextInPlan ? 1 : 0]?.planDay?.slots[0]
  const spacingWarning = addFromPlanIdx === null && generateDifficultySpacingWarning(
    primaryPlanDay.slots[0]?.difficulty,
    tomorrowSlot?.difficulty,
  )

  // Stats for the compact habit row — global (all plans), same reasoning as
  // earlyPlanStreak above: a completed workout counts regardless of active plan.
  const stats = computeHistoryStats(allEntries, extraEntries, today)
  // Same computation as earlyPlanStreak above (mobility dates included) — reuse it
  // rather than recomputing now that both use the same inputs.
  const planStreak = earlyPlanStreak
  const consecutiveSkips = computeConsecutiveSkips(plan.id, planEntries, planExtras, today)

  // Collect recent past days with no entry — used to show the stall nudge.
  const unloggedDates = getUnloggedPastDates(plan.id, planEntries, plan.startDate, today, 14)
  const totalUnlogged = countTotalUnloggedDays(plan.id, planEntries, plan.startDate, today)
  const olderUnloggedCount = Math.max(0, totalUnlogged - unloggedDates.length)

  const loggedRate = computeLoggedRate(plan.id, planEntries, plan.startDate, today)
  const workoutCompletionRate: WorkoutCompletionRate = computeWorkoutCompletionRate(plan.id, planEntries, today)
  const avgWorkoutsPerWeek = useMemo(
    () => computeAverageWorkoutsPerWeek(plan.id, planEntries, planExtras, plan.startDate, today),
    [plan.id, planEntries, planExtras, plan.startDate, today],
  )

  const weekProgress = plan.duration.type === 'weeks'
    ? computePlanProgress(plan, planEntries, today)
    : null

  // For rotations plans: use continuous progress (workouts logged / total workouts in plan)
  // rather than discrete full-rotation count, so the ring fills smoothly.
  const rotationTotalWorkouts = plan.duration.type === 'rotations' && plan.duration.value > 1
    ? plan.days.length * plan.duration.value
    : 0
  const rotationLoggedCount = useMemo(
    () => rotationTotalWorkouts > 0
      ? new Set(planEntries.filter(e => e.action === 'complete' || e.action === 'skip').map(e => e.calendarDate)).size
      : 0,
    [planEntries, rotationTotalWorkouts],
  )

  // Cycle progress for rotation-duration plans (null for weeks-duration plans)
  const cycleProgress = plan.duration.type === 'rotations'
    ? computeRotationCycleProgress(plan, planEntries, today)
    : null

  // Remaining workouts for rotation plans — shown in the Plan Progress modal
  const rotationPlanRemaining = plan.duration.type === 'rotations'
    ? computeRotationPlanRemaining(plan, planEntries, today)
    : null

  // Plan completion percentage for the ring visual
  const planCompletionPercent = weekProgress !== null && weekProgress.total > 0
    ? Math.round((weekProgress.completed / weekProgress.total) * 100)
    : rotationTotalWorkouts > 0
    ? Math.min(Math.round((rotationLoggedCount / rotationTotalWorkouts) * 100), 100)
    : loggedRate ?? 0

  // Previous-session summary — shown inside today's compact card when pending.
  const prevSessionOutcome = isPending
    ? findPreviousSessionForPlanDay(plan.id, primaryPlanDayIndex, today, planEntries, allOutcomes)
    : null
  const lastSessionSummary = prevSessionOutcome ? buildLastSessionSummary(prevSessionOutcome, maxLoadByExercise) : null

  const prevSessionDate = prevSessionOutcome
    ? parseWorkoutInstanceId(prevSessionOutcome.workoutInstanceId)?.calendarDate ?? null
    : null
  const prevSessionDaysAgo: number | null = prevSessionDate
    ? (d => d > 0 ? d : null)(differenceInCalendarDays(parseISO(today), parseISO(prevSessionDate)))
    : null

  const todaySessionCount = isPending
    ? countPlanDayCompletions(plan.id, primaryPlanDayIndex, planEntries, today)
    : undefined

  const upcomingSessionCounts = useMemo(() => {
    if (!plan) return {} as Record<string, number>
    return Object.fromEntries(
      upcoming.map(rd => [
        rd.calendarDate,
        countPlanDayCompletions(plan.id, rd.planDayIndex, planEntries),
      ]),
    )
  }, [plan, upcoming, planEntries])

  // Last-session summaries for upcoming cards (one line each, e.g. "Squat 135 lb · 3×8")
  const upcomingSessionSummaries = useMemo(() => {
    if (!plan) return {} as Record<string, string | null>
    return Object.fromEntries(
      upcoming.map(rd => {
        const outcome = findPreviousSessionForPlanDay(plan.id, rd.planDayIndex, today, planEntries, allOutcomes)
        return [rd.calendarDate, outcome ? buildLastSessionSummary(outcome, maxLoadByExercise) : null]
      }),
    )
  }, [plan, upcoming, today, planEntries, allOutcomes, maxLoadByExercise])

  // Exercise count and meta for the compact workout card
  const primarySlot = primaryPlanDay.slots[0]
  const primarySlotMeta = primarySlot ? WORKOUT_META[primarySlot.type] : null
  const totalExercises = primaryPlanDay.slots.reduce(
    (sum, slot) => sum + (slot.exercises?.length ?? 0),
    0,
  )

  // Estimated workout duration for the compact card
  const estimatedDurationMin: number | null = (() => {
    if (!primarySlot) return null
    if (isRunType(primarySlot.type)) return estimateRunDurationMin(primarySlot, planProgramVars)
    if (primarySlot.targetTime != null) return primarySlot.targetTime
    if ((primarySlot.exercises?.length ?? 0) > 0) return null
    return null
  })()

  function handleActiveWorkoutComplete(exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) {
    const elapsedMin = Math.round(meta.totalElapsedSeconds / 60) || null
    setActiveTrackedExercises(exercises)
    setActiveTrackedDurationMin(elapsedMin)
    setActiveWorkoutState('hidden')

    const runSlot = primaryPlanDay.slots.find(s => isRunType(s.type))
    if (runSlot) {
      const runEstimate = estimateRunDurationMin(runSlot, planProgramVars)
      const totalEstimate = (elapsedMin ?? 0) + runEstimate
      setCardioState(totalEstimate < 60 ? 'open' : 'prompt')
    } else {
      setShowOutcomeModal(true)
    }
  }

  function handleCardioComplete(durationMin: number) {
    setCardioTrackedDurationMin(durationMin)
    setCardioState('hidden')
    setShowOutcomeModal(true)
  }

  function handleCardioCancel() {
    setCardioState('hidden')
    setShowOutcomeModal(true)
  }

  function handleMobilitySlotComplete(
    slot: WorkoutSlot,
    completedAt: string,
    durationMin: number,
    completedExerciseIds: string[],
    completedSets: Record<string, number[]>,
  ) {
    const exercises = slot.mobilityExercises ?? []
    const mobilityActual: MobilityWorkoutActual = {
      exercises: exercises.map(ex => ({
        exercise: ex.name,
        sets: ex.sets.map((s, i) => {
          const done = (completedSets[ex.id] ?? []).includes(i)
          return {
            targetDurationSec: s.durationSec ?? null,
            targetReps: s.reps ?? null,
            actualDurationSec: done ? s.durationSec ?? null : null,
            actualReps: done ? s.reps ?? null : null,
            completed: done,
          }
        }),
      })),
    }
    const allDone = exercises.length > 0 && exercises.every(ex => completedExerciseIds.includes(ex.id))
    const completionState: WorkoutCompletionState = exercises.length === 0
      ? 'completed'
      : allDone ? 'completed' : completedExerciseIds.length > 0 ? 'partially_completed' : 'skipped'

    const outcome: WorkoutOutcome = {
      workoutInstanceId: makeWorkoutInstanceId(plan!.id, today),
      completionState,
      completedAt,
      durationActualMin: durationMin,
      mobilityActual,
    }
    logAction(plan!.id, today, primaryPlanDayIndex, completionStateToAction(completionState))
    logOutcomeWithProgression(outcome, slot)
    setMobilitySlotSession(null)
    setMobilitySlotState('hidden')
  }

  // Reopen a day that's already been logged so the remaining exercises can be
  // finished — seeds a resumable session from the logged completion.
  function handleResumeMobilityCompletion() {
    mobilityResumeCompletion(today, mobilityRoutine.map(ex => ex.id))
    setMobilityState('open')
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    const isEditing = isEditingOutcomeRef.current
    isEditingOutcomeRef.current = false

    setActiveTrackedExercises(null)
    setActiveTrackedDurationMin(null)

    const preWorkoutMaxLoad = { ...maxLoadByExercise }

    const completedDate = outcome.completedAt
      ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
      : today
    const action = completionStateToAction(outcome.completionState)
    logAction(plan!.id, today, primaryPlanDayIndex, action, outcome.notes ?? undefined)

    if (completedDate !== today) {
      const storeEntries = useHistoryStore.getState().entries
      const todayEntry = storeEntries.find(e => e.planId === plan!.id && e.calendarDate === today)
      if (todayEntry) {
        const destEntry = storeEntries.find(
          e => e.planId === plan!.id && e.calendarDate === completedDate,
        )
        // Only move the entry when the destination date is free. If something
        // is already logged there, leave both entries in place to avoid silently
        // deleting a previously-logged workout, skip, or day-off.
        if (!destEntry) {
          updateEntryDate(todayEntry.id, completedDate)
          // Only remap the outcome when the entry actually moved; if the move
          // was blocked (destEntry exists) both stay at today so they stay in sync.
          removeOutcome(makeWorkoutInstanceId(plan!.id, completedDate))
          outcome = { ...outcome, workoutInstanceId: makeWorkoutInstanceId(plan!.id, completedDate) }
        }
      }
    }

    const primarySlotForLog = primaryPlanDay.slots[0]
    if (primarySlotForLog) {
      logOutcomeWithProgression(outcome, primarySlotForLog)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
    }

    if (!isEditing && outcome.weightsActual?.exercises?.length) {
      const prs = outcome.weightsActual.exercises.flatMap(ex => {
        const prevMax = preWorkoutMaxLoad[ex.exercise] ?? 0
        const todayMax = (ex.sets ?? [])
          .filter(s => s.actualLoad != null && s.completed)
          .reduce((m, s) => Math.max(m, s.actualLoad!), 0)
        return todayMax > 0 && todayMax > prevMax ? [ex.exercise] : []
      })
      if (prs.length > 0) setNewPRs(prs)
    }

    if (addFromPlanIdx !== null && plan!.days[addFromPlanIdx]) {
      const selectedPlanDay = plan!.days[addFromPlanIdx]
      const selectedSlot = selectedPlanDay.slots[0]
      const willAdvance = upcoming[0]?.planDayIndex === addFromPlanIdx
      const extraId = addExtraEntry({
        planId: plan!.id,
        calendarDate: today,
        workoutType: selectedSlot?.type ?? 'other',
        workoutName: selectedPlanDay.label,
        source: 'double_day',
        advancedRotation: willAdvance,
      })
      sessionExtrasRef.current.add(extraId)
      if (willAdvance) {
        actions.advance()
        setBonusOutcome({ rd: upcoming[0], extraId })
      } else {
        setBonusOutcome({
          rd: { calendarDate: today, planDayIndex: addFromPlanIdx, planDay: selectedPlanDay, status: 'future' },
          extraId,
        })
      }
    }

    setAddFromPlanIdx(null)
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
    setBonusOutcome(null)
  }

  function handleSkip() {
    if (!todayResolved) return
    actions.skip(todayResolved.planDayIndex)
  }

  function handleCopyWorkout() {
    const dateLabel = format(parseISO(today), 'EEE, MMM d')
    const text = formatWorkoutForClipboard(primaryPlanDay, plan!.name, dateLabel)
    navigator.clipboard.writeText(text).then(() => {
      setWorkoutCopied(true)
      setTimeout(() => setWorkoutCopied(false), 2000)
    }).catch(() => {
      // Clipboard access denied — silently no-op
    })
  }

  function handleEditOutcome() {
    isEditingOutcomeRef.current = true
    setShowOutcomeModal(true)
  }

  function handleUpcomingLog(rd: ResolvedDay, action: 'complete' | 'skip' | 'day_off') {
    const logDate = action === 'complete' ? today : rd.calendarDate
    if (action === 'complete' && logDate === today && isResolved) {
      const bonusSlot = rd.planDay.slots[0]
      const extraId = addExtraEntry({
        planId: plan!.id,
        calendarDate: today,
        workoutType: bonusSlot?.type ?? 'other',
        workoutName: rd.planDay.label,
        source: 'double_day',
        advancedRotation: true,
      })
      sessionExtrasRef.current.add(extraId)
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

  const showStallNudge = !planExpired && !stallNudgeDismissed && (unloggedDates.length > 0 || olderUnloggedCount > 0)

  return (
    <div className="px-4 pt-safe space-y-4">
      {/* Header — date + plan name */}
      <div className="pt-6 pb-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          {new Date(today + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-xl font-bold text-white mt-0.5 leading-snug">{plan.name}</h1>
      </div>

      {/* Compact habit summary row — streak · total workouts · plan % ring */}
      <TodayHabitSummary
        planStreak={planStreak}
        totalCompleted={stats.totalCompleted}
        cycleProgress={cycleProgress}
        planCompletionPercent={planCompletionPercent}
        onOpenProgressModal={() => setShowPlanProgressModal(true)}
      />

      <TodayBanners
        planExpired={planExpired}
        expiryBannerDismissed={expiryBannerDismissed}
        planDurationValue={plan.duration.value}
        planDurationType={plan.duration.type}
        onNavigateToPlans={() => navigate('/plans')}
        onDismissExpiry={dismissExpiryBanner}
        showStallNudge={showStallNudge}
        unloggedCount={unloggedDates.length + olderUnloggedCount}
        hasUnloggedToday={unloggedDates.length > 0}
        onOpenCatchup={() => setShowCatchupConfirm(true)}
        onNavigateToCalendar={() => navigate('/calendar')}
        onDismissStall={dismissStallNudge}
        consecutiveSkips={consecutiveSkips}
        streakMilestone={streakMilestone}
        streakMilestoneDismissed={streakMilestoneDismissed}
        onDismissStreakMilestone={dismissStreakMilestone}
        todayAdaptationNote={todayAdaptationNote}
        spacingWarning={spacingWarning || null}
      />

      <TodayCompletedSection
        status={todayResolved.status}
        primaryPlanDay={primaryPlanDay}
        todayExtras={todayExtras}
        onEditOutcome={handleEditOutcome}
        onEditExtra={setEditingExtra}
        onDeleteExtra={(extra) => {
          removeOutcome(makeExtraWorkoutInstanceId(plan.id, extra.calendarDate, extra.id))
          removeExtraEntry(extra.id)
          if (extra.advancedRotation ?? (extra.source === 'double_day')) removeLastOverrideByType(plan.id, 'advance')
        }}
      />

      {/* Personal record celebration */}
      {newPRs && <TodayPRBanner newPRs={newPRs} onDismiss={() => setNewPRs(null)} />}

      {/* Today's workout — compact card */}
      {todayResolved.status === 'today_day_off' ? (
        <div className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-4 flex items-center gap-3">
          <Coffee size={22} className="text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-400">Rest Day</p>
            <p className="text-xs text-slate-600 mt-0.5">No workout logged — rotation continues tomorrow</p>
          </div>
        </div>
      ) : isPending ? (
        <TodayPendingCard
          planId={plan.id}
          primaryPlanDay={primaryPlanDay}
          primarySlotMeta={primarySlotMeta}
          totalExercises={totalExercises}
          estimatedDurationMin={estimatedDurationMin}
          todaySessionCount={todaySessionCount}
          activeWorkoutHidden={activeWorkoutState === 'hidden'}
          onStartWorkout={() => {
            const firstSlot = primaryPlanDay.slots[0]
            if (firstSlot && isRunType(firstSlot.type)) {
              setCardioState('open')
            } else if (firstSlot && firstSlot.type === 'mobility') {
              setMobilitySlotState('open')
            } else {
              setActiveWorkoutState('open')
            }
          }}
          lastSessionSummary={lastSessionSummary}
          prevSessionOutcome={prevSessionOutcome}
          prevSessionDaysAgo={prevSessionDaysAgo}
          todayRunSlot={todayRunSlot ?? null}
        />
      ) : (
        <WorkoutDayCard resolved={todayResolved} planId={plan?.id} isToday sessionCount={todaySessionCount} />
      )}

      {/* Added plan workout preview */}
      {addFromPlanIdx !== null && plan.days[addFromPlanIdx] && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PlusCircle size={11} /> Also today
          </p>
          <SwipeToDelete onDelete={() => setAddFromPlanIdx(null)}>
            <WorkoutDayCard
              resolved={{ calendarDate: today, planDayIndex: addFromPlanIdx, planDay: plan.days[addFromPlanIdx], status: 'future' }}
              planId={plan?.id}
            />
          </SwipeToDelete>
        </div>
      )}

      {/* Secondary workout-management actions */}
      {isPending && activeWorkoutState === 'hidden' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddWorkout(true)}
            className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs font-medium transition-colors active:scale-[0.97]"
          >
            Add Workout
          </button>
          <button
            onClick={() => setShowJump(true)}
            className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs font-medium transition-colors active:scale-[0.97]"
          >
            Change Workout
          </button>
          <button
            onClick={handleCopyWorkout}
            aria-label="Copy workout to clipboard"
            title="Copy workout"
            className={`flex items-center justify-center px-3 py-1.5 rounded-lg border transition-colors active:scale-[0.97] ${
              workoutCopied
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {workoutCopied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
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
              removeEntry(plan.id, today)
              removeOutcome(makeWorkoutInstanceId(plan.id, today))
              let removedDoubleDay = false
              for (const ex of extraEntries) {
                if (
                  ex.planId === plan.id &&
                  (ex.calendarDate === today || sessionExtrasRef.current.has(ex.id)) &&
                  ex.source !== 'history'
                ) {
                  // Use ex.calendarDate (not today) — the extra may have been
                  // backdated via the bonus outcome modal, moving both the entry
                  // and its outcome key to a different date.
                  removeOutcome(makeExtraWorkoutInstanceId(plan.id, ex.calendarDate, ex.id))
                  removeExtraEntry(ex.id)
                  if (ex.advancedRotation ?? (ex.source === 'double_day')) removedDoubleDay = true
                }
              }
              sessionExtrasRef.current = new Set()
              if (removedDoubleDay) removeLastOverrideByType(plan.id, 'advance')
              setNewPRs(null)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors"
          >
            <RotateCcw size={13} /> Undo
          </button>
          <button
            onClick={() => setShowOverride(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
          >
            <Shuffle size={13} /> Override
          </button>
        </div>
      )}

      {/* Mobility section */}
      <TodayMobilitySection
        mobilityRoutine={mobilityRoutine}
        mobilityCompletion={mobilityCompletion}
        mobilityInProgress={mobilityInProgress}
        mobilityActiveSession={mobilityActiveSession}
        onUndoCompletion={() => removeMobilityCompletion(today)}
        onOpenTracker={() => setMobilityState('open')}
        onResumeCompletion={handleResumeMobilityCompletion}
        onNavigate={() => navigate('/mobility')}
      />

      {/* Upcoming */}
      <TodayUpcomingList
        upcoming={upcoming}
        extraIsNextInPlan={extraIsNextInPlan}
        planId={plan?.id}
        getProgressionState={getProgressionState}
        upcomingSessionCounts={upcomingSessionCounts}
        upcomingSessionSummaries={upcomingSessionSummaries}
        onSelectUpcoming={(rd) => setLoggingUpcoming({ rd })}
      />

      {/* Outcome modal */}
      {showOutcomeModal && (
        <OutcomeModal
          planId={plan.id}
          calendarDate={today}
          planDay={primaryPlanDay}
          previousSetsByExercise={previousSetsByExercise}
          isFromActiveWorkout={!!(activeTrackedExercises || cardioTrackedDurationMin !== null)}
          existingOutcome={
            (activeTrackedExercises || cardioTrackedDurationMin !== null)
              ? {
                  workoutInstanceId: makeWorkoutInstanceId(plan.id, today),
                  completionState: 'completed',
                  completedAt: new Date().toISOString(),
                  durationActualMin:
                    (activeTrackedDurationMin ?? 0) + (cardioTrackedDurationMin ?? 0) || null,
                  perceivedEffort: null,
                  notes: null,
                  runActual: cardioTrackedDurationMin !== null
                    ? { actualDurationMin: cardioTrackedDurationMin }
                    : null,
                  swimActual: null,
                  weightsActual: activeTrackedExercises
                    ? { exercises: activeTrackedExercises }
                    : null,
                }
              : existingOutcome
          }
          onConfirm={handleOutcomeConfirm}
          onClose={() => {
            setShowOutcomeModal(false)
            setActiveTrackedExercises(null)
            setActiveTrackedDurationMin(null)
            setCardioTrackedDurationMin(null)
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

      {/* Cardio prompt — shown after weights when total expected time >= 60 min */}
      {cardioState === 'prompt' && (() => {
        const runSlot = primaryPlanDay.slots.find(s => isRunType(s.type))
        if (!runSlot) return null
        return (
          <TodayCardioPromptModal
            runSlot={runSlot}
            programVars={planProgramVars}
            activeTrackedDurationMin={activeTrackedDurationMin}
            onStart={() => setCardioState('open')}
            onCancel={handleCardioCancel}
          />
        )
      })()}

      {/* Cardio workout tracker */}
      {cardioState !== 'hidden' && cardioState !== 'prompt' && (() => {
        const runSlot = primaryPlanDay.slots.find(s => isRunType(s.type))
        if (!runSlot) return null
        return (
          <CardioWorkoutTracker
            slot={runSlot}
            programVars={planProgramVars}
            minimized={cardioState === 'minimized'}
            onMinimize={() => setCardioState('minimized')}
            onResume={() => setCardioState('open')}
            onComplete={handleCardioComplete}
            onCancel={handleCardioCancel}
          />
        )
      })()}

      {/* Ad hoc workout — manages its own start-modal/tracker/outcome flow */}
      <TodayAdHocWorkout
        planId={plan.id}
        today={today}
        addExtraEntry={addExtraEntry}
        removeExtraEntry={removeExtraEntry}
        openRequested={adHocOpenRequest}
        onOpenConsumed={() => setAdHocOpenRequest(false)}
        onActiveChange={setAdHocActive}
      />

      {/* Mobility tracker — closing saves a checkpoint so the routine can be
          finished bit by bit throughout the day instead of all at once */}
      {mobilityState !== 'hidden' && (
        <MobilityTracker
          today={today}
          routine={mobilityRoutine}
          activeSession={mobilityActiveSession}
          soundEnabled={mobilitySoundEnabled}
          setSoundEnabled={mobilitySetSoundEnabled}
          startSession={mobilityStartSession}
          saveCheckpoint={mobilitySaveCheckpoint}
          clearSession={mobilityClearSession}
          onLogCompletion={({ completedAt, durationMin, completedExerciseIds, completedSets }) => {
            mobilityLogCompletion(today, { completedAt, durationMin, completedExerciseIds, completedSets })
          }}
          onClose={() => setMobilityState('hidden')}
          minimized={mobilityState === 'minimized'}
          onMinimize={() => setMobilityState('minimized')}
          onResume={() => setMobilityState('open')}
          onManageRoutine={() => {
            setMobilityState('hidden')
            navigate('/mobility')
          }}
        />
      )}

      {/* Scheduled mobility slot tracker — a `mobility` slot inside today's
          plan day, as opposed to the standalone daily routine above */}
      {mobilitySlotState !== 'hidden' && primarySlot && primarySlot.type === 'mobility' && (
        <MobilityTracker
          today={today}
          title={primarySlot.name || 'Mobility'}
          routine={primarySlot.mobilityExercises ?? []}
          activeSession={mobilitySlotSession}
          soundEnabled={mobilitySoundEnabled}
          setSoundEnabled={mobilitySetSoundEnabled}
          startSession={(date, exerciseIds) => setMobilitySlotSession({
            date,
            exerciseIds,
            currentIdx: 0,
            currentSetIdx: 0,
            completedIds: [],
            completedSets: {},
            totalElapsedSec: 0,
            exElapsedSec: 0,
          })}
          saveCheckpoint={cp => setMobilitySlotSession(cp)}
          clearSession={() => setMobilitySlotSession(null)}
          onLogCompletion={({ completedAt, durationMin, completedExerciseIds, completedSets }) => {
            handleMobilitySlotComplete(primarySlot, completedAt, durationMin, completedExerciseIds, completedSets)
          }}
          onClose={() => setMobilitySlotState('hidden')}
          minimized={mobilitySlotState === 'minimized'}
          onMinimize={() => setMobilitySlotState('minimized')}
          onResume={() => setMobilitySlotState('open')}
          onManageRoutine={() => {
            setMobilitySlotState('hidden')
            navigate(`/plans/${plan!.id}/edit`)
          }}
        />
      )}

      {/* Plan progress detail — opened by tapping the ring in the habit summary row */}
      {showPlanProgressModal && (
        <TodayPlanProgressModal
          totalCompleted={stats.totalCompleted}
          planCompletionPercent={planCompletionPercent}
          planStreak={planStreak}
          weekProgress={weekProgress}
          cycleProgress={cycleProgress}
          planDurationType={plan.duration.type}
          planDurationValue={plan.duration.value}
          loggedRate={loggedRate}
          workoutCompletionRate={workoutCompletionRate}
          consecutiveSkips={consecutiveSkips}
          avgWorkoutsPerWeek={avgWorkoutsPerWeek}
          rotationPlanRemaining={rotationPlanRemaining}
          onClose={() => setShowPlanProgressModal(false)}
        />
      )}

      {/* Edit outcome for a completed extra workout */}
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
        <TodayUpcomingLogModal
          resolvedDay={loggingUpcoming.rd}
          error={upcomingLogError}
          onLog={(action) => handleUpcomingLog(loggingUpcoming.rd, action)}
          onClose={() => { setLoggingUpcoming(null); setUpcomingLogError(null) }}
        />
      )}

      {/* Outcome modal for upcoming workout */}
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

      {/* Outcome modal for the double-day bonus workout */}
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

      {/* Catch-up confirmation modal */}
      {showCatchupConfirm && (
        <TodayCatchupModal
          unloggedDates={unloggedDates}
          onConfirm={() => {
            markDaysAsOff(plan!.id, unloggedDates)
            setShowCatchupConfirm(false)
          }}
          onClose={() => setShowCatchupConfirm(false)}
        />
      )}

      <TodayRotationModals
        showOverride={showOverride}
        onCloseOverride={() => setShowOverride(false)}
        onAdvance={() => { actions.advance(); setShowOverride(false) }}
        onGoBack={() => { actions.goBack(); setShowOverride(false) }}
        onGoToJump={() => { setShowOverride(false); setShowJump(true) }}
        onSkipToday={() => { handleSkip(); setShowOverride(false) }}
        isPending={isPending}
        showJump={showJump}
        onCloseJump={() => setShowJump(false)}
        onJumpTo={(idx) => { actions.jumpTo(idx); setShowJump(false) }}
        showAddWorkout={showAddWorkout}
        onCloseAddWorkout={() => setShowAddWorkout(false)}
        onGoToAddFromPlan={() => { setShowAddWorkout(false); setShowAddFromPlan(true) }}
        canAddAdHoc={!adHocActive}
        onOpenAdHoc={() => {
          setAdHocOpenRequest(true)
          setShowAddWorkout(false)
        }}
        showAddFromPlan={showAddFromPlan}
        onCloseAddFromPlan={() => setShowAddFromPlan(false)}
        addFromPlanIdx={addFromPlanIdx}
        onSelectFromPlan={(idx) => { setAddFromPlanIdx(idx); setShowAddFromPlan(false) }}
        planDays={plan.days}
        currentPlanDayIndex={todayResolved.planDayIndex}
      />
    </div>
  )
}
