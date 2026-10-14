import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActiveWorkoutTracker } from '../workout/ActiveWorkoutTracker'
import type { WorkoutSessionMeta } from '../workout/ActiveWorkoutTracker'
import { CardioWorkoutTracker } from '../workout/CardioWorkoutTracker'
import { MobilityTracker } from '../workout/MobilityTracker'
import { OutcomeModal } from '../workout/OutcomeModal'
import { Modal } from '../shared/Modal'
import { useOutcomeStore, makeExtraWorkoutInstanceId } from '../../store/outcomeStore'
import type { ExtraWorkoutEntry } from '../../types'
import type { WorkoutType, WorkoutSlot, PlanDay } from '../../types'
import type { LoggedExerciseActual, MobilityWorkoutActual, WorkoutCompletionState } from '../../modules/workout-outcomes/types'
import type { MobilitySessionCheckpoint } from '../../store/mobilityStore'
import { useMobilityStore } from '../../store/mobilityStore'
import { nanoid } from '../../lib/utils'
import { WORKOUT_TYPE_OPTIONS } from '../../lib/constants'

/** Which tracker an ad hoc workout of each type runs in. */
function trackerKind(type: WorkoutType): 'weights' | 'mobility' | 'timer' {
  if (type === 'weights') return 'weights'
  if (type === 'mobility') return 'mobility'
  return 'timer'
}

interface TodayAdHocWorkoutProps {
  planId: string
  today: string
  addExtraEntry: (payload: Omit<ExtraWorkoutEntry, 'id' | 'createdAt'>) => string
  removeExtraEntry: (id: string) => void
  openRequested: boolean
  onOpenConsumed: () => void
  onActiveChange: (isActive: boolean) => void
}

export function TodayAdHocWorkout({
  planId,
  today,
  addExtraEntry,
  removeExtraEntry,
  openRequested,
  onOpenConsumed,
  onActiveChange,
}: TodayAdHocWorkoutProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<WorkoutType>('weights')
  const [trackerState, setTrackerState] = useState<'hidden' | 'open' | 'minimized'>('hidden')
  const [extraId, setExtraId] = useState<string | null>(null)
  const [slot, setSlot] = useState<WorkoutSlot | null>(null)
  const [planDay, setPlanDay] = useState<PlanDay | null>(null)
  const [trackedExercises, setTrackedExercises] = useState<LoggedExerciseActual[] | null>(null)
  const [trackedDurationMin, setTrackedDurationMin] = useState<number | null>(null)
  const [showOutcome, setShowOutcome] = useState(false)
  const [mobilitySession, setMobilitySession] = useState<MobilitySessionCheckpoint | null>(null)
  const mobilityLoggedRef = useRef(false)
  const navigate = useNavigate()
  const mobilityRoutine = useMobilityStore(s => s.routine)
  const mobilitySoundEnabled = useMobilityStore(s => s.soundEnabled)
  const mobilitySetSoundEnabled = useMobilityStore(s => s.setSoundEnabled)

  const isActive = trackerState !== 'hidden' || showOutcome
  useEffect(() => { onActiveChange(isActive) }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openRequested) return
    setName('')
    setType('weights')
    setModalOpen(true)
    onOpenConsumed()
  }, [openRequested]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetState() {
    setExtraId(null)
    setSlot(null)
    setPlanDay(null)
    setTrackedExercises(null)
    setTrackedDurationMin(null)
    setMobilitySession(null)
  }

  function cancelTracker() {
    if (extraId) removeExtraEntry(extraId)
    resetState()
    setTrackerState('hidden')
  }

  function handleMobilityLog(
    mobilitySlot: WorkoutSlot,
    completedAt: string,
    durationMin: number,
    completedExerciseIds: string[],
    completedSets: Record<string, number[]>,
  ) {
    if (!extraId) return
    const exercises = mobilitySlot.mobilityExercises ?? []
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
    const completionState: WorkoutCompletionState = exercises.length === 0 || allDone
      ? 'completed'
      : completedExerciseIds.length > 0 ? 'partially_completed' : 'skipped'
    useOutcomeStore.getState().setOutcome({
      workoutInstanceId: makeExtraWorkoutInstanceId(planId, today, extraId),
      completionState,
      completedAt,
      durationActualMin: durationMin,
      mobilityActual,
    })
    mobilityLoggedRef.current = true
  }

  return (
    <>
      {trackerState !== 'hidden' && extraId && slot && planDay && trackerKind(slot.type) === 'weights' && (
        <ActiveWorkoutTracker
          planId={planId}
          workoutInstanceId={makeExtraWorkoutInstanceId(planId, today, extraId)}
          planDay={planDay}
          slot={slot}
          programVars={{}}
          previousOutcome={null}
          resumeOutcome={null}
          previousSetsByExercise={{}}
          minimized={trackerState === 'minimized'}
          onMinimize={() => setTrackerState('minimized')}
          onResume={() => setTrackerState('open')}
          onCancel={cancelTracker}
          onComplete={(exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) => {
            setTrackedExercises(exercises)
            setTrackedDurationMin(Math.round(meta.totalElapsedSeconds / 60) || null)
            setTrackerState('hidden')
            setShowOutcome(true)
          }}
        />
      )}

      {/* Run / swim / yoga / other — timed session, details captured in the outcome modal */}
      {trackerState !== 'hidden' && extraId && slot && trackerKind(slot.type) === 'timer' && (
        <CardioWorkoutTracker
          slot={slot}
          minimized={trackerState === 'minimized'}
          onMinimize={() => setTrackerState('minimized')}
          onResume={() => setTrackerState('open')}
          onCancel={cancelTracker}
          onComplete={(durationMin: number) => {
            setTrackedDurationMin(durationMin || null)
            setTrackerState('hidden')
            setShowOutcome(true)
          }}
        />
      )}

      {/* Mobility — runs a snapshot of the saved mobility routine */}
      {trackerState !== 'hidden' && extraId && slot && trackerKind(slot.type) === 'mobility' && (
        <MobilityTracker
          today={today}
          title={slot.name}
          routine={slot.mobilityExercises ?? []}
          activeSession={mobilitySession}
          soundEnabled={mobilitySoundEnabled}
          setSoundEnabled={mobilitySetSoundEnabled}
          startSession={(date, exerciseIds) => setMobilitySession({
            date,
            exerciseIds,
            currentIdx: 0,
            currentSetIdx: 0,
            completedIds: [],
            completedSets: {},
            totalElapsedSec: 0,
            exElapsedSec: 0,
          })}
          saveCheckpoint={cp => setMobilitySession(cp)}
          clearSession={() => setMobilitySession(null)}
          onLogCompletion={({ completedAt, durationMin, completedExerciseIds, completedSets }) => {
            handleMobilityLog(slot, completedAt, durationMin, completedExerciseIds, completedSets)
          }}
          onClose={() => {
            if (mobilityLoggedRef.current) {
              resetState()
              setTrackerState('hidden')
            } else {
              cancelTracker()
            }
          }}
          minimized={trackerState === 'minimized'}
          onMinimize={() => setTrackerState('minimized')}
          onResume={() => setTrackerState('open')}
          onManageRoutine={() => {
            cancelTracker()
            navigate('/mobility')
          }}
        />
      )}

      {showOutcome && extraId && planDay && (() => {
        const instanceId = makeExtraWorkoutInstanceId(planId, today, extraId)
        return (
          <OutcomeModal
            planId={planId}
            calendarDate={today}
            planDay={planDay}
            previousSetsByExercise={{}}
            isFromActiveWorkout={true}
            existingOutcome={{
              workoutInstanceId: instanceId,
              completionState: 'completed',
              completedAt: new Date().toISOString(),
              durationActualMin: trackedDurationMin,
              perceivedEffort: null,
              notes: null,
              runActual: null,
              swimActual: null,
              weightsActual: trackedExercises ? { exercises: trackedExercises } : null,
            }}
            onConfirm={(outcome) => {
              useOutcomeStore.getState().setOutcome({ ...outcome, workoutInstanceId: instanceId })
              setShowOutcome(false)
              resetState()
            }}
            onClose={() => {
              setShowOutcome(false)
              resetState()
            }}
          />
        )
      })()}

      {modalOpen && (
        <Modal title="Ad Hoc Workout" onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Workout name
              </label>
              <input
                type="text"
                placeholder="e.g. Upper Body, Lap Swim, Pickup Basketball…"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {WORKOUT_TYPE_OPTIONS.map(({ type: t, label }) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      type === t
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const typeLabel = WORKOUT_TYPE_OPTIONS.find(o => o.type === type)?.label
                const workoutName = name.trim() || (type === 'other' ? 'Ad Hoc Workout' : typeLabel ?? 'Ad Hoc Workout')
                const slotId = nanoid()
                const newSlot: WorkoutSlot = { id: slotId, type, name: workoutName }
                if (type === 'mobility') newSlot.mobilityExercises = mobilityRoutine.map(ex => ({ ...ex, sets: ex.sets.map(st => ({ ...st })) }))
                mobilityLoggedRef.current = false
                const day: PlanDay = { id: nanoid(), label: workoutName, slots: [newSlot] }
                const newExtraId = addExtraEntry({
                  planId,
                  calendarDate: today,
                  workoutType: type,
                  workoutName,
                  source: 'history',
                })
                setSlot(newSlot)
                setPlanDay(day)
                setExtraId(newExtraId)
                setModalOpen(false)
                setTrackerState('open')
              }}
              className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors active:scale-[0.98]"
            >
              Start
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
