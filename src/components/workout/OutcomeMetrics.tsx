import { Ruler, Timer, Zap, Dumbbell, Waves } from 'lucide-react'
import { formatPace, formatSwimPace } from '../../modules/workout-outcomes/types'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'
import type { RunProgressionState } from '../../modules/run-adaptation/types'

export function OutcomeMetrics({
  outcome,
  progressionState,
}: {
  outcome: WorkoutOutcome
  progressionState?: RunProgressionState | null
}) {
  const weightSetCount = outcome.weightsActual?.exercises
    ?.flatMap(ex => ex.sets)
    .filter(s => s.completed).length ?? 0

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

      {outcome.weightsActual && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Dumbbell size={10} /> {weightSetCount} completed set{weightSetCount === 1 ? '' : 's'}
        </p>
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

      {outcome.swimActual && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {outcome.swimActual.actualDistanceMeters != null && (
            <span className="flex items-center gap-0.5"><Waves size={10} /> {outcome.swimActual.actualDistanceMeters} m</span>
          )}
          {outcome.swimActual.actualDurationMin != null && (
            <span className="flex items-center gap-0.5"><Timer size={10} /> {outcome.swimActual.actualDurationMin} min</span>
          )}
          {outcome.swimActual.averagePaceSecondsPer100m != null && (
            <span className="flex items-center gap-0.5"><Zap size={10} /> {formatSwimPace(outcome.swimActual.averagePaceSecondsPer100m)}</span>
          )}
        </div>
      )}

      {outcome.progressionRecommendation?.action === 'progress' && (
        <p className="text-xs text-sky-300">↗ {outcome.progressionRecommendation.note}</p>
      )}

      {progressionState?.lastResult === 'progress' && progressionState.currentTargetDistanceMiles != null && (
        <p className="text-xs text-emerald-400">
          ↑ Progressed — next target: {progressionState.currentTargetDistanceMiles} mi
        </p>
      )}
      {progressionState?.lastResult === 'regress' && progressionState.currentTargetDistanceMiles != null && (
        <p className="text-xs text-amber-400">
          ↓ Adjusted down — next target: {progressionState.currentTargetDistanceMiles} mi
        </p>
      )}

      {!outcome.runActual && !outcome.swimActual && outcome.durationActualMin != null && (
        <p className="text-xs text-slate-500">{outcome.durationActualMin} min</p>
      )}
    </div>
  )
}
