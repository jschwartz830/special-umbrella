import { Ruler, Timer, Zap } from 'lucide-react'
import { formatPace } from '../../modules/workout-outcomes/types'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

export function OutcomeMetrics({ outcome }: { outcome: WorkoutOutcome }) {
  return (
    <div className="space-y-1.5 py-1">
      {outcome.perceivedEffort != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Effort:</span>
          <div className="flex gap-0.5">
            {([1, 2, 3, 4, 5] as const).map(e => (
              <span key={e} className={`w-3 h-3 rounded-full ${
                e <= outcome.perceivedEffort!
                  ? e <= 2 ? 'bg-emerald-400' : e === 3 ? 'bg-yellow-400' : e === 4 ? 'bg-orange-400' : 'bg-red-400'
                  : 'bg-slate-600'
              }`} />
            ))}
          </div>
          <span className="text-xs text-slate-500">{outcome.perceivedEffort}/5</span>
        </div>
      )}
      {outcome.runActual && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {outcome.runActual.actualDistanceMiles != null && (
            <span className="flex items-center gap-0.5"><Ruler size={10} /> {outcome.runActual.actualDistanceMiles} mi</span>
          )}
          {outcome.runActual.actualDurationMin != null && (
            <span className="flex items-center gap-0.5"><Timer size={10} /> {outcome.runActual.actualDurationMin} min</span>
          )}
          {outcome.runActual.averagePaceSecondsPerMile != null && (
            <span className="flex items-center gap-0.5"><Zap size={10} /> {formatPace(outcome.runActual.averagePaceSecondsPerMile)}</span>
          )}
        </div>
      )}
      {!outcome.runActual && outcome.durationActualMin != null && (
        <p className="text-xs text-slate-500">{outcome.durationActualMin} min</p>
      )}
    </div>
  )
}
