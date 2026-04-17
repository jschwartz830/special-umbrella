import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { useActivePlan } from '../hooks/useActivePlan'
import { usePlanActions } from '../hooks/usePlanActions'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore, makeWorkoutInstanceId } from '../store/outcomeStore'
import { WorkoutDayCard } from '../components/workout/WorkoutDayCard'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import { generateRunAdaptationNote, generateDifficultySpacingWarning } from '../modules/recommendation/explanation'
import { resolveWorkoutDisplayTarget } from '../modules/run-adaptation/selectors'
import { isRunType } from '../modules/workout-metadata/types'
import { isPlanExpired } from '../engine/rotationEngine'
import type { ResolvedDay } from '../types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

export function TodayPage() {
  const navigate = useNavigate()
  const { plan, todayResolved, upcoming, planEntries } = useActivePlan()
  const actions = usePlanActions(plan?.id ?? null)
  const logAction = useHistoryStore(s => s.logAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const getOutcome = useOutcomeStore(s => s.getOutcome)
  const getProgressionState = useOutcomeStore(s => s.getProgressionState)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const today = new Intl.DateTimeFormat('en-CA').format(new Date())

  const [showOutcomeModal, setShowOutcomeModal] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [doubleDay, setDoubleDay] = useState(false)
  const [loggingUpcoming, setLoggingUpcoming] = useState<ResolvedDay | null>(null)
  const [showUpcomingOutcome, setShowUpcomingOutcome] = useState(false)

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

  const instanceId = makeWorkoutInstanceId(plan.id, today)
  const existingOutcome = getOutcome(instanceId)

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

  function handleCompleteClick() {
    setShowOutcomeModal(true)
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    const action = completionStateToAction(outcome.completionState)
    logAction(plan!.id, today, todayResolved!.planDayIndex, action, outcome.notes ?? undefined)

    // Double-day: advance one extra step so tomorrow skips past the bonus workout
    if (doubleDay) actions.advance()

    if (todayRunSlot) {
      logOutcomeWithProgression(outcome, todayRunSlot)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
    }

    setDoubleDay(false)
    setShowOutcomeModal(false)
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
    logAction(plan!.id, rd.calendarDate, rd.planDayIndex, action)
    if (action === 'complete') {
      setShowUpcomingOutcome(true)
    } else {
      setLoggingUpcoming(null)
    }
  }

  function handleUpcomingOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!loggingUpcoming) return
    const runSlot = loggingUpcoming.planDay.slots.find(s => isRunType(s.type))
    if (runSlot) {
      logOutcomeWithProgression(outcome, runSlot)
    } else {
      useOutcomeStore.getState().setOutcome(outcome)
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
        </p>
      </div>

      {/* Plan completion / expiry banner */}
      {planExpired && (
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
              removeEntry(plan.id, today)
              removeOutcome(makeWorkoutInstanceId(plan.id, today))
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
                    <WorkoutDayCard resolved={rd} onClick={() => setLoggingUpcoming(rd)} />
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
          planDay={todayResolved.planDay}
          existingOutcome={existingOutcome}
          onConfirm={handleOutcomeConfirm}
          onClose={() => setShowOutcomeModal(false)}
        />
      )}

      {/* Log upcoming workout modal */}
      {loggingUpcoming && !showUpcomingOutcome && (
        <Modal
          title={new Date(loggingUpcoming.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          onClose={() => setLoggingUpcoming(null)}
        >
          <div className="space-y-4">
            {/* Workout summary */}
            <div className="space-y-1.5">
              {loggingUpcoming.planDay.slots.map(slot => (
                <div key={slot.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{slot.name}</span>
                  {slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetDistance} mi</span>}
                  {slot.targetTime && !slot.targetDistance && <span className="text-xs text-slate-500 ml-auto">{slot.targetTime} min</span>}
                </div>
              ))}
            </div>

            {loggingUpcoming.historyEntry ? (
              /* Already logged — show status + edit/clear */
              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${
                  loggingUpcoming.historyEntry.action === 'complete' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                  loggingUpcoming.historyEntry.action === 'skip' ? 'bg-slate-700 border border-slate-600' :
                  'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  {loggingUpcoming.historyEntry.action === 'complete' && <CheckCircle2 size={16} className="text-emerald-400" />}
                  {loggingUpcoming.historyEntry.action === 'skip' && <SkipForward size={16} className="text-slate-400" />}
                  {loggingUpcoming.historyEntry.action === 'day_off' && <Coffee size={16} className="text-amber-400" />}
                  <span className={`text-sm font-medium capitalize ${
                    loggingUpcoming.historyEntry.action === 'complete' ? 'text-emerald-400' :
                    loggingUpcoming.historyEntry.action === 'skip' ? 'text-slate-300' : 'text-amber-400'
                  }`}>
                    {loggingUpcoming.historyEntry.action.replace('_', ' ')}
                  </span>
                </div>
                {loggingUpcoming.historyEntry.action === 'complete' && (
                  <button
                    onClick={() => setShowUpcomingOutcome(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
                  >
                    <Pencil size={14} /> Edit workout details
                  </button>
                )}
                <button
                  onClick={() => handleUpcomingClear(loggingUpcoming)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
                >
                  <X size={14} /> Clear entry
                </button>
              </div>
            ) : (
              /* Not yet logged — show action buttons */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpcomingLog(loggingUpcoming, 'complete')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors active:scale-95"
                  >
                    <CheckCircle2 size={16} /> Complete
                  </button>
                  <button
                    onClick={() => handleUpcomingLog(loggingUpcoming, 'skip')}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm font-medium transition-colors active:scale-95"
                  >
                    <SkipForward size={16} /> Skip
                  </button>
                </div>
                <button
                  onClick={() => handleUpcomingLog(loggingUpcoming, 'day_off')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors active:scale-95"
                >
                  <Coffee size={16} /> Day Off
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Outcome modal for upcoming workout */}
      {loggingUpcoming && showUpcomingOutcome && (
        <OutcomeModal
          planId={plan.id}
          calendarDate={loggingUpcoming.calendarDate}
          planDay={loggingUpcoming.planDay}
          existingOutcome={getOutcome(makeWorkoutInstanceId(plan.id, loggingUpcoming.calendarDate))}
          onConfirm={handleUpcomingOutcomeConfirm}
          onClose={() => { setShowUpcomingOutcome(false); setLoggingUpcoming(null) }}
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
