import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
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
  ChevronDown,
  Copy,
  Trophy,
  Plus,
  Zap,
  ChevronUp,
} from 'lucide-react'
import { useActivePlan } from '../hooks/useActivePlan'
import { usePlanActions } from '../hooks/usePlanActions'
import { useExpiryDismiss } from '../hooks/useExpiryDismiss'
import { useStallNudgeDismiss } from '../hooks/useStallNudgeDismiss'
import { useToday } from '../hooks/useToday'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { useProgramStore } from '../store/programStore'
import { WorkoutDayCard } from '../components/workout/WorkoutDayCard'
import { WorkoutSlotDetails } from '../components/workout/WorkoutSlotDetails'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { ActiveWorkoutTracker } from '../components/workout/ActiveWorkoutTracker'
import type { WorkoutSessionMeta } from '../components/workout/ActiveWorkoutTracker'
import { CardioWorkoutTracker } from '../components/workout/CardioWorkoutTracker'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import { generateRunAdaptationNote, generateDifficultySpacingWarning } from '../modules/recommendation/explanation'
import { resolveWorkoutDisplayTarget } from '../modules/run-adaptation/selectors'
import { isRunType } from '../modules/workout-metadata/types'
import { isPlanExpired } from '../engine/rotationEngine'
import { computeHistoryStats, getUnloggedPastDates, countTotalUnloggedDays, computePlanProgress, countPlanDayCompletions, computePlanStreak, computeConsecutiveSkips, computeLoggedRate } from '../lib/historyStats'
import type { ResolvedDay, ExtraWorkoutEntry, WorkoutType, WorkoutSlot, PlanDay } from '../types'
import type { WorkoutOutcome, LoggedExerciseActual } from '../modules/workout-outcomes/types'
import { extraToPlanDay } from '../lib/planDayUtils'
import { MobilityTracker } from '../components/workout/MobilityTracker'
import { useMobilityStore } from '../store/mobilityStore'
import { nanoid } from '../lib/utils'
import { formatWorkoutForClipboard } from '../lib/shareWorkout'
import { findPreviousSessionForPlanDay, buildLastSessionSummary } from '../lib/sessionSummary'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { parseWorkoutInstanceId } from '../lib/workoutInstanceId'
import { outcomeSortKey } from '../lib/outcomeSortKey'
import { findPreviousSetsByExercise } from '../lib/previousSetsHelper'
import { WORKOUT_META } from '../lib/constants'



/** Circular completion ring that wraps the total completed workout count. */
function CompletedWorkoutsRing({
  count,
  percent,
  accessibilityLabel,
}: {
  count: number
  percent: number
  accessibilityLabel?: string
}) {
  const r = 14
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ
  return (
    <div
      className="relative flex items-center justify-center w-10 h-10 flex-shrink-0"
      aria-label={accessibilityLabel ?? `${count} workouts completed, ${percent}% of plan`}
      role="img"
    >
      <svg className="absolute inset-0 -rotate-90" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#1e293b" strokeWidth="2.5" />
        <circle
          cx="20" cy="20" r={r} fill="none" stroke="#0ea5e9" strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="text-sm font-bold text-white relative z-10">{count}</span>
    </div>
  )
}

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


function SwipeToDelete({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startXRef = useRef(0)
  const REVEAL = 68

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 rounded-r-xl"
        style={{ width: REVEAL }}
      >
        <button onClick={onDelete} aria-label="Delete" className="w-full h-full flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
      </div>
      <div
        style={{ transform: `translateX(${offset}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={e => { startXRef.current = e.touches[0].clientX; setSwiping(true) }}
        onTouchMove={e => {
          const dx = e.touches[0].clientX - startXRef.current
          setOffset(Math.max(Math.min(dx, 0), -REVEAL))
        }}
        onTouchEnd={() => {
          setSwiping(false)
          setOffset(prev => (prev <= -(REVEAL / 2) ? -REVEAL : 0))
        }}
      >
        {children}
      </div>
    </div>
  )
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
  // Preview toggle for today's workout exercises
  const [previewExpanded, setPreviewExpanded] = useState(false)

  // Active workout tracker state: hidden | open | minimized
  const [activeWorkoutState, setActiveWorkoutState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  // Exercises tracked during active session — used to pre-fill OutcomeModal
  const [activeTrackedExercises, setActiveTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [activeTrackedDurationMin, setActiveTrackedDurationMin] = useState<number | null>(null)
  // Cardio phase state: shown after weights (or as standalone for run-only days)
  const [cardioState, setCardioState] = useState<'hidden' | 'prompt' | 'open' | 'minimized'>('hidden')
  const [cardioTrackedDurationMin, setCardioTrackedDurationMin] = useState<number | null>(null)
  // Ad hoc workout state
  const [adHocModalOpen, setAdHocModalOpen] = useState(false)
  const [adHocName, setAdHocName] = useState('')
  const [adHocType, setAdHocType] = useState<WorkoutType>('weights')
  const [adHocWorkoutState, setAdHocWorkoutState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  const [adHocExtraId, setAdHocExtraId] = useState<string | null>(null)
  const [adHocSlot, setAdHocSlot] = useState<WorkoutSlot | null>(null)
  const [adHocPlanDay, setAdHocPlanDay] = useState<PlanDay | null>(null)
  const [adHocTrackedExercises, setAdHocTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [adHocTrackedDurationMin, setAdHocTrackedDurationMin] = useState<number | null>(null)
  const [showAdHocOutcome, setShowAdHocOutcome] = useState(false)
  // Mobility state
  const mobilityCompletions = useMobilityStore(s => s.completions)
  const mobilityCompletion = mobilityCompletions[today] ?? null
  const mobilityRoutine = useMobilityStore(s => s.routine)
  const removeMobilityCompletion = useMobilityStore(s => s.removeCompletion)
  const [showMobilityTracker, setShowMobilityTracker] = useState(false)

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

  // Resolve run adaptation note for today's workout
  const todayRunSlot = todayResolved.planDay.slots.find(s => isRunType(s.type))
  const todayProgressionState = todayRunSlot?.runConfig?.progressionGroupId
    ? getProgressionState(todayRunSlot.runConfig.progressionGroupId)
    : null
  const todayAdaptationNote = todayRunSlot
    ? generateRunAdaptationNote(todayRunSlot, todayProgressionState)
    : null

  // Difficulty spacing warning (today vs tomorrow) — suppressed when an extra workout is queued
  const extraIsNextInPlan = addFromPlanIdx !== null && addFromPlanIdx === upcoming[0]?.planDayIndex
  const tomorrowSlot = upcoming[extraIsNextInPlan ? 1 : 0]?.planDay?.slots[0]
  const spacingWarning = addFromPlanIdx === null && generateDifficultySpacingWarning(
    todayResolved.planDay.slots[0]?.difficulty,
    tomorrowSlot?.difficulty,
  )

  // Stats for the compact habit row (scoped to the active plan's history)
  const stats = computeHistoryStats(planEntries, planExtras, today)
  // Mobility dates count toward streak — completing mobility on a day keeps the streak alive
  const mobilityDateSet = useMemo(() => new Set(Object.keys(mobilityCompletions)), [mobilityCompletions])
  const planStreak = computePlanStreak(plan.id, planEntries, planExtras, today, mobilityDateSet)
  const consecutiveSkips = computeConsecutiveSkips(plan.id, planEntries, planExtras, today)

  // Collect recent past days with no entry — used to show the stall nudge.
  const unloggedDates = getUnloggedPastDates(plan.id, planEntries, plan.startDate, today, 14)
  const totalUnlogged = countTotalUnloggedDays(plan.id, planEntries, plan.startDate, today)
  const olderUnloggedCount = Math.max(0, totalUnlogged - unloggedDates.length)

  const loggedRate = computeLoggedRate(plan.id, planEntries, plan.startDate, today)

  const weekProgress = plan.duration.type === 'weeks'
    ? computePlanProgress(plan, planEntries, today)
    : null

  // For rotations plans: use continuous progress (workouts logged / total workouts in plan)
  // rather than discrete full-rotation count, so the ring fills smoothly.
  const rotationTotalWorkouts = plan.duration.type === 'rotations' && plan.duration.value > 1
    ? plan.days.length * plan.duration.value
    : 0
  const rotationLoggedCount = rotationTotalWorkouts > 0
    ? new Set(planEntries.filter(e => e.action === 'complete' || e.action === 'skip').map(e => e.calendarDate)).size
    : 0

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
  const prevSessionDaysAgo: number | null = (() => {
    if (!prevSessionDate) return null
    const [ty, tm, td] = today.split('-').map(Number)
    const [dy, dm, dd] = prevSessionDate.split('-').map(Number)
    const d = Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(dy, dm - 1, dd)) / 86_400_000)
    return d > 0 ? d : null
  })()

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

  // Exercise count and meta for the compact workout card
  const primarySlot = primaryPlanDay.slots[0]
  const primarySlotMeta = primarySlot ? WORKOUT_META[primarySlot.type] : null
  const totalExercises = primaryPlanDay.slots.reduce(
    (sum, slot) => sum + (slot.exercises?.length ?? 0),
    0,
  )

  function estimateRunDurationMin(slot: { durationMin?: number; runConfig?: { targetDurationMin?: number | null; targetDistanceMiles?: number | null } | null; segments?: Array<{ type?: string; duration?: string; distance?: string }> }): number {
    if (slot.durationMin) return slot.durationMin
    if (slot.runConfig?.targetDurationMin) return slot.runConfig.targetDurationMin
    let totalMin = 0
    for (const seg of slot.segments ?? []) {
      if (seg.duration) {
        const mMatch = seg.duration.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/)
        if (mMatch) { totalMin += parseFloat(mMatch[1]); continue }
      }
      if (seg.distance) {
        const resolved = seg.distance.replace(/\b([a-zA-Z_]\w*)\b/g, (m: string) =>
          planProgramVars[m] !== undefined ? String(planProgramVars[m]) : m,
        )
        const miles = parseFloat(resolved)
        if (!isNaN(miles)) {
          const minPerMile = seg.type === 'tempo' ? 8 : seg.type === 'warmup' || seg.type === 'cooldown' ? 12 : 11
          totalMin += miles * minPerMile
        }
      }
    }
    if (totalMin > 0) return Math.ceil(totalMin)
    const dist = slot.runConfig?.targetDistanceMiles
    if (dist) return Math.ceil(dist * 11)
    return 20
  }

  // Estimated workout duration for the compact card
  const estimatedDurationMin: number | null = (() => {
    if (!primarySlot) return null
    if (isRunType(primarySlot.type)) return estimateRunDurationMin(primarySlot)
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
      const runEstimate = estimateRunDurationMin(runSlot)
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

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    setActiveTrackedExercises(null)
    setActiveTrackedDurationMin(null)

    const preWorkoutMaxLoad = { ...maxLoadByExercise }

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
      removeOutcome(makeWorkoutInstanceId(plan!.id, completedDate))
      outcome = { ...outcome, workoutInstanceId: makeWorkoutInstanceId(plan!.id, completedDate) }
    }

    const primarySlotForLog = primaryPlanDay.slots[0]
    if (primarySlotForLog) {
      logOutcomeWithProgression(outcome, primarySlotForLog)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
    }

    if (outcome.weightsActual?.exercises?.length) {
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
      const extraId = addExtraEntry({
        planId: plan!.id,
        calendarDate: today,
        workoutType: selectedSlot?.type ?? 'rest',
        workoutName: selectedPlanDay.label,
        source: 'double_day',
      })
      if (upcoming[0]?.planDayIndex === addFromPlanIdx) {
        actions.advance()
        setBonusOutcome({ rd: upcoming[0], extraId })
      } else {
        setBonusOutcome({
          rd: { calendarDate: today, planDayIndex: addFromPlanIdx, planDay: selectedPlanDay, status: 'upcoming' },
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
    setShowOutcomeModal(true)
  }

  function handleUpcomingLog(rd: ResolvedDay, action: 'complete' | 'skip' | 'day_off') {
    const logDate = action === 'complete' ? today : rd.calendarDate
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

  const showStallNudge = !planExpired && !stallNudgeDismissed && (unloggedDates.length > 0 || olderUnloggedCount > 0)

  return (
    <div className="px-4 pt-safe space-y-4">
      {/* Header — date + plan name */}
      <div className="pt-6 pb-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-xl font-bold text-white mt-0.5 leading-snug">{plan.name}</h1>
      </div>

      {/* Compact habit summary row — streak · total workouts · plan % ring */}
      <div className="flex items-center gap-4 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">🔥</span>
          <span className="text-sm font-bold text-white">{planStreak}</span>
          <span className="text-xs text-slate-400">streak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white">{stats.totalCompleted}</span>
          <span className="text-xs text-slate-400">workouts</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <CompletedWorkoutsRing
            count={planCompletionPercent}
            percent={planCompletionPercent}
            accessibilityLabel={`${planCompletionPercent}% of plan complete`}
          />
          <span className="text-xs text-slate-500">plan</span>
        </div>
      </div>

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

      {/* Compact stalled-rotation nudge — dismissible */}
      {showStallNudge && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50">
          <Info size={13} className="text-slate-400 flex-shrink-0" />
          <p className="flex-1 text-xs text-slate-400 min-w-0">
            Rotation may be stalled
            {(unloggedDates.length + olderUnloggedCount) > 0 && (
              <span className="text-slate-500">
                {' '}· {unloggedDates.length + olderUnloggedCount} unlogged day{(unloggedDates.length + olderUnloggedCount) === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {unloggedDates.length > 0 && (
            <button
              onClick={() => setShowCatchupConfirm(true)}
              className="text-xs text-amber-400 font-medium flex-shrink-0 hover:text-amber-300 transition-colors"
            >
              Fix
            </button>
          )}
          <button
            onClick={() => navigate('/calendar')}
            className="text-xs text-sky-400 font-medium flex-shrink-0 hover:text-sky-300 transition-colors"
          >
            Review
          </button>
          <button
            onClick={dismissStallNudge}
            className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Consecutive skips nudge */}
      {!planExpired && consecutiveSkips >= 3 && (
        <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info size={13} className="text-amber-400 flex-shrink-0" />
          <p className="flex-1 text-xs text-amber-300">
            {consecutiveSkips} workout{consecutiveSkips === 1 ? '' : 's'} skipped in a row — you've got this!
          </p>
          <button
            onClick={() => navigate('/calendar')}
            className="text-xs text-sky-400 font-medium flex-shrink-0 hover:text-sky-300 transition-colors"
          >
            Calendar →
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
            <SwipeToDelete
              key={extra.id}
              onDelete={() => {
                removeOutcome(makeExtraWorkoutInstanceId(plan.id, extra.calendarDate, extra.id))
                removeExtraEntry(extra.id)
                if (extra.source === 'double_day') removeLastOverrideByType(plan.id, 'advance')
              }}
            >
              <button
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
            </SwipeToDelete>
          ))}
        </section>
      )}

      {/* Personal record celebration */}
      {newPRs && newPRs.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <Trophy size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-300">New personal record{newPRs.length > 1 ? 's' : ''}!</p>
            <p className="text-xs text-amber-400/70 mt-0.5 truncate">
              {newPRs.slice(0, 3).join(', ')}{newPRs.length > 3 ? ` +${newPRs.length - 3} more` : ''}
            </p>
          </div>
          <button
            onClick={() => setNewPRs(null)}
            className="text-amber-400/50 hover:text-amber-200 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

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
                {activeWorkoutState === 'hidden' && (
                  <button
                    onClick={() => {
                      const firstSlot = primaryPlanDay.slots[0]
                      if (firstSlot && isRunType(firstSlot.type)) {
                        setCardioState('open')
                      } else {
                        setActiveWorkoutState('open')
                      }
                    }}
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
                    Last:{' '}
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
                  <WorkoutSlotDetails slot={slot} planId={plan.id} />
                </div>
              ))}
            </div>
          )}
        </div>
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
              resolved={{ calendarDate: today, planDayIndex: addFromPlanIdx, planDay: plan.days[addFromPlanIdx], status: 'upcoming' }}
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
            Change workout
          </button>
          <button
            onClick={handleCopyWorkout}
            aria-label="Copy workout to clipboard"
            title="Copy workout"
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors active:scale-[0.97] ${
              workoutCopied
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Copy size={13} />{workoutCopied ? 'Copied' : 'Copy'}
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
                  ex.calendarDate === today &&
                  ex.source !== 'history'
                ) {
                  removeOutcome(makeExtraWorkoutInstanceId(plan.id, today, ex.id))
                  removeExtraEntry(ex.id)
                  if (ex.source === 'double_day') removedDoubleDay = true
                }
              }
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
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Zap size={11} /> Mobility
        </h2>
        {mobilityRoutine.length === 0 ? (
          <button
            onClick={() => navigate('/mobility')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-slate-700/60 text-slate-600 hover:text-slate-400 hover:border-slate-600 transition-colors text-xs"
          >
            <Plus size={13} />
            Set up daily mobility routine
          </button>
        ) : mobilityCompletion ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-500/12 border border-teal-500/30">
            <CheckCircle2 size={14} className="text-teal-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-teal-200 font-medium">Mobility done</p>
              <p className="text-xs text-teal-300/60 mt-0.5">
                {mobilityCompletion.durationMin} min ·{' '}
                {mobilityCompletion.completedExerciseIds.length}/{mobilityRoutine.length} exercises
              </p>
            </div>
            <button
              onClick={() => removeMobilityCompletion(today)}
              className="text-teal-400/50 hover:text-teal-200 transition-colors"
              aria-label="Undo mobility log"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowMobilityTracker(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-colors active:scale-[0.99]"
          >
            <Zap size={14} className="text-teal-400 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-slate-300 font-medium">Daily Mobility</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {mobilityRoutine.length} exercise{mobilityRoutine.length === 1 ? '' : 's'} · ~{Math.ceil(mobilityRoutine.reduce((s, e) => s + e.durationSec, 0) / 60)} min
              </p>
            </div>
            <Play size={14} className="text-slate-500 flex-shrink-0" />
          </button>
        )}
      </section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.slice(extraIsNextInPlan ? 1 : 0, extraIsNextInPlan ? 6 : 5).map(rd => {
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
                    <WorkoutDayCard
                      resolved={rd}
                      planId={plan?.id}
                      sessionCount={upcomingSessionCounts[rd.calendarDate]}
                      onClick={() => setLoggingUpcoming({ rd })}
                      collapsible
                    />
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
        const runEst = estimateRunDurationMin(runSlot)
        return (
          <Modal title="Nice work on the lifts!" onClose={handleCardioCancel}>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-1">
                <p className="text-sm font-semibold text-slate-200">{runSlot.name}</p>
                <p className="text-xs text-slate-400">~{runEst} min · scheduled cardio for today</p>
                {runSlot.runConfig?.targetDistanceMiles && (
                  <p className="text-xs text-slate-500">{runSlot.runConfig.targetDistanceMiles} mi target</p>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Your session is already at {activeTrackedDurationMin ?? '?'} min.
                Start the run now, or skip it and log the lifts.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setCardioState('open')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors"
                >
                  <Play size={16} /> Start {runSlot.name}
                </button>
                <button
                  onClick={handleCardioCancel}
                  className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
                >
                  Skip run — log lifts only
                </button>
              </div>
            </div>
          </Modal>
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

      {/* Ad hoc workout tracker */}
      {adHocWorkoutState !== 'hidden' && adHocExtraId && adHocSlot && adHocPlanDay && plan && (
        <ActiveWorkoutTracker
          planId={plan.id}
          workoutInstanceId={makeExtraWorkoutInstanceId(plan.id, today, adHocExtraId)}
          planDay={adHocPlanDay}
          slot={adHocSlot}
          programVars={{}}
          previousOutcome={null}
          resumeOutcome={null}
          previousSetsByExercise={{}}
          minimized={adHocWorkoutState === 'minimized'}
          onMinimize={() => setAdHocWorkoutState('minimized')}
          onResume={() => setAdHocWorkoutState('open')}
          onCancel={() => {
            if (adHocExtraId) removeExtraEntry(adHocExtraId)
            setAdHocExtraId(null)
            setAdHocSlot(null)
            setAdHocPlanDay(null)
            setAdHocWorkoutState('hidden')
          }}
          onComplete={(exercises, meta) => {
            setAdHocTrackedExercises(exercises)
            setAdHocTrackedDurationMin(Math.round(meta.totalElapsedSeconds / 60) || null)
            setAdHocWorkoutState('hidden')
            setShowAdHocOutcome(true)
          }}
        />
      )}

      {/* Ad hoc outcome modal */}
      {showAdHocOutcome && adHocExtraId && adHocPlanDay && plan && (() => {
        const instanceId = makeExtraWorkoutInstanceId(plan.id, today, adHocExtraId)
        return (
          <OutcomeModal
            planId={plan.id}
            calendarDate={today}
            planDay={adHocPlanDay}
            previousSetsByExercise={{}}
            isFromActiveWorkout={true}
            existingOutcome={{
              workoutInstanceId: instanceId,
              completionState: 'completed',
              completedAt: new Date().toISOString(),
              durationActualMin: adHocTrackedDurationMin,
              perceivedEffort: null,
              notes: null,
              runActual: null,
              swimActual: null,
              weightsActual: adHocTrackedExercises ? { exercises: adHocTrackedExercises } : null,
            }}
            onConfirm={(outcome) => {
              useOutcomeStore.getState().setOutcome({ ...outcome, workoutInstanceId: instanceId })
              setShowAdHocOutcome(false)
              setAdHocExtraId(null)
              setAdHocSlot(null)
              setAdHocPlanDay(null)
              setAdHocTrackedExercises(null)
              setAdHocTrackedDurationMin(null)
            }}
            onClose={() => {
              setShowAdHocOutcome(false)
              setAdHocExtraId(null)
              setAdHocSlot(null)
              setAdHocPlanDay(null)
              setAdHocTrackedExercises(null)
              setAdHocTrackedDurationMin(null)
            }}
          />
        )
      })()}

      {/* Ad hoc start modal */}
      {adHocModalOpen && plan && (
        <Modal title="Ad Hoc Workout" onClose={() => setAdHocModalOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Workout name
              </label>
              <input
                type="text"
                placeholder="e.g. Upper Body, Garage Workout…"
                value={adHocName}
                onChange={e => setAdHocName(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['weights', 'run', 'other'] as WorkoutType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setAdHocType(t)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors capitalize ${
                      adHocType === t
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'weights' ? 'Weights' : t === 'run' ? 'Cardio' : 'Other'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const name = adHocName.trim() || 'Ad Hoc Workout'
                const slotId = nanoid()
                const slot: WorkoutSlot = { id: slotId, type: adHocType, name }
                const day: PlanDay = { id: nanoid(), label: name, slots: [slot] }
                const extraId = addExtraEntry({
                  planId: plan.id,
                  calendarDate: today,
                  workoutType: adHocType,
                  workoutName: name,
                  source: 'history',
                })
                setAdHocSlot(slot)
                setAdHocPlanDay(day)
                setAdHocExtraId(extraId)
                setAdHocModalOpen(false)
                setAdHocWorkoutState('open')
              }}
              className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors active:scale-[0.98]"
            >
              Start
            </button>
          </div>
        </Modal>
      )}

      {/* Mobility tracker */}
      {showMobilityTracker && (
        <MobilityTracker
          today={today}
          onClose={() => setShowMobilityTracker(false)}
          onManageRoutine={() => {
            setShowMobilityTracker(false)
            navigate('/mobility')
          }}
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
        <Modal
          title={new Date(loggingUpcoming.rd.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          onClose={() => { setLoggingUpcoming(null); setUpcomingLogError(null) }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              {loggingUpcoming.rd.planDay.slots.map(slot => (
                <div key={slot.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{slot.name}</span>
                  {slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetDistance} mi</span>}
                  {slot.targetTime && !slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetTime} min</span>}
                </div>
              ))}
            </div>

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
          </div>
        </Modal>
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
        <Modal title="Mark as Day Off?" onClose={() => setShowCatchupConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              The following {unloggedDates.length} day{unloggedDates.length === 1 ? '' : 's'} (past 2 weeks) will be marked as Day Off.
              The rotation will continue from today.
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {unloggedDates.map(date => (
                <div key={date} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-sm text-slate-300">
                  <Coffee size={13} className="text-amber-400 flex-shrink-0" />
                  {new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCatchupConfirm(false)}
                className="flex-1 py-2.5 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  markDaysAsOff(plan!.id, unloggedDates)
                  setShowCatchupConfirm(false)
                }}
                className="flex-1 py-2.5 text-sm rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
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
            {isPending && (
              <button
                onClick={() => { handleSkip(); setShowOverride(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
              >
                <SkipForward size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-white">Skip today</p>
                  <p className="text-xs text-slate-400">Mark today as skipped and move on</p>
                </div>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Add Workout picker */}
      {showAddWorkout && (
        <Modal title="Add Workout" onClose={() => setShowAddWorkout(false)}>
          <div className="space-y-2">
            <button
              onClick={() => { setShowAddWorkout(false); setShowAddFromPlan(true) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <PlusCircle size={18} className="text-sky-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Add from plan</p>
                <p className="text-xs text-slate-400">Pick any workout from your plan to stack today</p>
              </div>
            </button>
            {adHocWorkoutState === 'hidden' && !showAdHocOutcome && (
              <button
                onClick={() => {
                  setAdHocName('')
                  setAdHocType('weights')
                  setAdHocModalOpen(true)
                  setShowAddWorkout(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
              >
                <ListPlus size={18} className="text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Add ad hoc</p>
                  <p className="text-xs text-slate-400">Log a custom workout outside your plan</p>
                </div>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Add from plan picker */}
      {showAddFromPlan && (
        <Modal title="Add from plan" onClose={() => setShowAddFromPlan(false)}>
          <div className="space-y-2">
            {plan.days.map((day, idx) => {
              const isScheduled = idx === todayResolved.planDayIndex
              const isAlreadyAdded = idx === addFromPlanIdx
              return (
                <button
                  key={day.id}
                  disabled={isScheduled}
                  onClick={() => {
                    setAddFromPlanIdx(isAlreadyAdded ? null : idx)
                    setShowAddFromPlan(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    isScheduled
                      ? 'bg-slate-800/50 opacity-40 cursor-not-allowed'
                      : isAlreadyAdded
                      ? 'bg-sky-500/20 border border-sky-500/50'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isScheduled ? 'text-slate-400' : 'text-white'}`}>{day.label}</p>
                    <p className="text-xs text-slate-400 truncate">{day.slots.map(s => s.name).join(' + ')}</p>
                  </div>
                  {isScheduled && <span className="text-xs text-slate-500 flex-shrink-0">Scheduled</span>}
                  {isAlreadyAdded && <span className="text-xs text-sky-400 font-medium flex-shrink-0">Added</span>}
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {/* Jump modal */}
      {showJump && (
        <Modal title="Change workout" onClose={() => setShowJump(false)}>
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
