import { ChevronRight, ChevronLeft, ListPlus, SkipForward, PlusCircle } from 'lucide-react'
import { Modal } from '../shared/Modal'
import type { PlanDay } from '../../types'

export interface TodayRotationModalsProps {
  // Override modal
  showOverride: boolean
  onCloseOverride: () => void
  onAdvance: () => void
  onGoBack: () => void
  onGoToJump: () => void
  onSkipToday: () => void
  isPending: boolean

  // Jump modal
  showJump: boolean
  onCloseJump: () => void
  onJumpTo: (idx: number) => void

  // Add Workout modal
  showAddWorkout: boolean
  onCloseAddWorkout: () => void
  onGoToAddFromPlan: () => void
  canAddAdHoc: boolean
  onOpenAdHoc: () => void

  // Add From Plan modal
  showAddFromPlan: boolean
  onCloseAddFromPlan: () => void
  addFromPlanIdx: number | null
  onSelectFromPlan: (idx: number | null) => void

  // Shared data
  planDays: PlanDay[]
  currentPlanDayIndex: number
}

export function TodayRotationModals({
  showOverride,
  onCloseOverride,
  onAdvance,
  onGoBack,
  onGoToJump,
  onSkipToday,
  isPending,
  showJump,
  onCloseJump,
  onJumpTo,
  showAddWorkout,
  onCloseAddWorkout,
  onGoToAddFromPlan,
  canAddAdHoc,
  onOpenAdHoc,
  showAddFromPlan,
  onCloseAddFromPlan,
  addFromPlanIdx,
  onSelectFromPlan,
  planDays,
  currentPlanDayIndex,
}: TodayRotationModalsProps) {
  return (
    <>
      {/* Override modal */}
      {showOverride && (
        <Modal title="Override rotation" onClose={onCloseOverride}>
          <div className="space-y-2">
            <button
              onClick={onAdvance}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronRight size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Advance one day</p>
                <p className="text-xs text-slate-400">Move to the next workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={onGoBack}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronLeft size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Go back one day</p>
                <p className="text-xs text-slate-400">Return to the previous workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={onGoToJump}
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
                onClick={onSkipToday}
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

      {/* Jump modal */}
      {showJump && (
        <Modal title="Change Workout" onClose={onCloseJump}>
          <div className="space-y-2">
            {planDays.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => onJumpTo(idx)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  idx === currentPlanDayIndex
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
                {idx === currentPlanDayIndex && (
                  <span className="ml-auto text-xs text-sky-400 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Add Workout picker */}
      {showAddWorkout && (
        <Modal title="Add Workout" onClose={onCloseAddWorkout}>
          <div className="space-y-2">
            <button
              onClick={onGoToAddFromPlan}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <PlusCircle size={18} className="text-sky-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Add from plan</p>
                <p className="text-xs text-slate-400">Pick any workout from your plan to stack today</p>
              </div>
            </button>
            {canAddAdHoc && (
              <button
                onClick={onOpenAdHoc}
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
        <Modal title="Add from plan" onClose={onCloseAddFromPlan}>
          <div className="space-y-2">
            {planDays.map((day, idx) => {
              const isScheduled = idx === currentPlanDayIndex
              const isAlreadyAdded = idx === addFromPlanIdx
              return (
                <button
                  key={day.id}
                  disabled={isScheduled}
                  onClick={() => {
                    onSelectFromPlan(isAlreadyAdded ? null : idx)
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
    </>
  )
}
