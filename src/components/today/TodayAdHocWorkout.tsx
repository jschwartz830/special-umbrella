import { useState, useEffect } from 'react'
import { ActiveWorkoutTracker } from '../workout/ActiveWorkoutTracker'
import type { WorkoutSessionMeta } from '../workout/ActiveWorkoutTracker'
import { OutcomeModal } from '../workout/OutcomeModal'
import { Modal } from '../shared/Modal'
import { useOutcomeStore, makeExtraWorkoutInstanceId } from '../../store/outcomeStore'
import type { ExtraWorkoutEntry } from '../../types'
import type { WorkoutType, WorkoutSlot, PlanDay } from '../../types'
import type { LoggedExerciseActual } from '../../modules/workout-outcomes/types'
import { nanoid } from '../../lib/utils'

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
  }

  return (
    <>
      {trackerState !== 'hidden' && extraId && slot && planDay && (
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
          onCancel={() => {
            if (extraId) removeExtraEntry(extraId)
            resetState()
            setTrackerState('hidden')
          }}
          onComplete={(exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) => {
            setTrackedExercises(exercises)
            setTrackedDurationMin(Math.round(meta.totalElapsedSeconds / 60) || null)
            setTrackerState('hidden')
            setShowOutcome(true)
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
                placeholder="e.g. Upper Body, Garage Workout…"
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
                {(['weights', 'run', 'other'] as WorkoutType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors capitalize ${
                      type === t
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
                const workoutName = name.trim() || 'Ad Hoc Workout'
                const slotId = nanoid()
                const newSlot: WorkoutSlot = { id: slotId, type, name: workoutName }
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
