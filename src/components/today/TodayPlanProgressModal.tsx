import { Modal } from '../shared/Modal'
import { CompletedWorkoutsRing } from './TodayHabitSummary'
import type { RotationCycleProgress, WorkoutCompletionRate } from '../../lib/historyStats'

interface TodayPlanProgressModalProps {
  totalCompleted: number
  planCompletionPercent: number
  planStreak: number
  longestPlanStreak: number
  weekProgress: { completed: number; total: number } | null
  cycleProgress: RotationCycleProgress | null
  planDurationType: string
  planDurationValue: number
  loggedRate: number | null
  workoutCompletionRate: WorkoutCompletionRate
  consecutiveSkips: number
  /** Average active workout sessions per week since plan start. null before any sessions exist. */
  avgWorkoutsPerWeek: number | null
  onClose: () => void
}

export function TodayPlanProgressModal({
  totalCompleted,
  planCompletionPercent,
  planStreak,
  longestPlanStreak,
  weekProgress,
  cycleProgress,
  planDurationType,
  planDurationValue,
  loggedRate,
  workoutCompletionRate,
  consecutiveSkips,
  avgWorkoutsPerWeek,
  onClose,
}: TodayPlanProgressModalProps) {
  return (
    <Modal title="Plan Progress" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2 py-2">
          <CompletedWorkoutsRing count={totalCompleted} percent={planCompletionPercent} size={88} />
          <p className="text-xs text-slate-500">{planCompletionPercent}% of plan complete</p>
        </div>

        <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 divide-y divide-slate-700/60">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-400">Workouts completed</span>
            <span className="text-sm font-semibold text-white">{totalCompleted}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-400">Current streak</span>
            <span className="text-sm font-semibold text-white">
              🔥 {planStreak} day{planStreak === 1 ? '' : 's'}
            </span>
          </div>
          {longestPlanStreak > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Longest streak</span>
              <span className="text-sm font-semibold text-white">
                🏆 {longestPlanStreak} day{longestPlanStreak === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {weekProgress && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Weeks elapsed</span>
              <span className="text-sm font-semibold text-white">{weekProgress.completed} / {weekProgress.total}</span>
            </div>
          )}
          {cycleProgress && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Current cycle</span>
              <span className="text-sm font-semibold text-white">
                {cycleProgress.justCompletedRotation
                  ? 'Just completed'
                  : `${cycleProgress.doneInCycle} / ${cycleProgress.rotationLength} days`}
              </span>
            </div>
          )}
          {planDurationType === 'rotations' && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Plan length</span>
              <span className="text-sm font-semibold text-white">
                {planDurationValue} rotation{planDurationValue === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {loggedRate !== null && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Logged rate</span>
              <span className="text-sm font-semibold text-white">{loggedRate}%</span>
            </div>
          )}
          {workoutCompletionRate.workoutCompletionRate !== null && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Completion rate</span>
              <span className="text-sm font-semibold text-white">{workoutCompletionRate.workoutCompletionRate}%</span>
            </div>
          )}
          {avgWorkoutsPerWeek !== null && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Avg / week</span>
              <span className="text-sm font-semibold text-white">{avgWorkoutsPerWeek}×</span>
            </div>
          )}
          {consecutiveSkips > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Consecutive skips</span>
              <span className="text-sm font-semibold text-amber-400">{consecutiveSkips}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
