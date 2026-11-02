import { ArrowDown, ArrowUp, Minus, Target, X } from 'lucide-react'
import { formatNextTarget, type NextTarget, type NextTargetChange } from '../../modules/workout-outcomes/nextTargets'

interface TodayNextTargetsCardProps {
  targets: NextTarget[]
  onDismiss: () => void
}

const CHANGE_STYLE: Record<NextTargetChange, string> = {
  up: 'text-emerald-300',
  down: 'text-amber-300',
  hold: 'text-slate-400',
  deload: 'text-yellow-300',
  none: 'text-slate-500',
}

function ChangeIcon({ change }: { change: NextTargetChange }) {
  if (change === 'up') return <ArrowUp size={11} />
  if (change === 'down') return <ArrowDown size={11} />
  return <Minus size={11} />
}

/** Shown after a lifting session is logged: each lift's target for next time. */
export function TodayNextTargetsCard({ targets, onDismiss }: TodayNextTargetsCardProps) {
  if (targets.length === 0) return null
  return (
    <div className="px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-sky-400 flex-shrink-0" />
        <p className="flex-1 text-xs font-semibold text-sky-300">Next time</p>
        <button
          onClick={onDismiss}
          className="text-sky-400/50 hover:text-sky-200 flex-shrink-0 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
      <ul className="mt-1.5 space-y-1">
        {targets.map(t => (
          <li key={t.exercise} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-slate-200 min-w-0 truncate">{formatNextTarget(t)}</span>
            <span className={`flex items-center gap-1 flex-shrink-0 ${CHANGE_STYLE[t.change]}`}>
              <ChangeIcon change={t.change} />
              {t.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
