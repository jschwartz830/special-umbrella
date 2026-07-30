import { CheckCircle2 } from 'lucide-react'
import type { RotationCycleProgress } from '../../lib/historyStats'

interface CompletedWorkoutsRingProps {
  count: number
  percent: number
  accessibilityLabel?: string
  size?: number
}

export function CompletedWorkoutsRing({ count, percent, accessibilityLabel, size = 40 }: CompletedWorkoutsRingProps) {
  const r = size * 0.35
  const center = size / 2
  const strokeWidth = size * 0.0625
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={accessibilityLabel ?? `${count} workouts completed, ${percent}% of plan`}
      role="img"
    >
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={r} fill="none" stroke="#0ea5e9" strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={`font-bold text-white relative z-10 ${size >= 80 ? 'text-2xl' : 'text-sm'}`}>{count}</span>
    </div>
  )
}

interface TodayHabitSummaryProps {
  planStreak: number
  totalCompleted: number
  cycleProgress: RotationCycleProgress | null
  planCompletionPercent: number
  onOpenProgressModal: () => void
}

export function TodayHabitSummary({
  planStreak,
  totalCompleted,
  cycleProgress,
  planCompletionPercent,
  onOpenProgressModal,
}: TodayHabitSummaryProps) {
  return (
    <div className="flex items-center gap-4 px-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">🔥</span>
        <span className="text-sm font-bold text-white">{planStreak}</span>
        <span className="text-xs text-slate-400">streak</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-white">{totalCompleted}</span>
        <span className="text-xs text-slate-400">workouts</span>
      </div>
      {cycleProgress && (
        cycleProgress.justCompletedRotation ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-xs text-emerald-300">Cycle done</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{cycleProgress.doneInCycle}/{cycleProgress.rotationLength}</span>
            <span className="text-xs text-slate-400">cycle</span>
          </div>
        )
      )}
      <button
        onClick={onOpenProgressModal}
        className="ml-auto flex items-center gap-1.5 active:scale-95 transition-transform"
        aria-label={`View plan progress details — ${totalCompleted} workouts completed, ${planCompletionPercent}% of plan`}
      >
        <CompletedWorkoutsRing
          count={totalCompleted}
          percent={planCompletionPercent}
        />
        <span className="text-xs text-slate-500">plan</span>
      </button>
    </div>
  )
}
