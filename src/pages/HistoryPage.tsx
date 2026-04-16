import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle2,
  MinusCircle,
  SkipForward,
  Coffee,
  Pause,
  Shuffle,
  Pencil,
  Trash2,
  X,
  Ruler,
  Zap,
  Timer,
  Clock3,
} from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { useOutcomeStore, makeWorkoutInstanceId } from '../store/outcomeStore'
import { Modal } from '../components/shared/Modal'
import { DifficultyBadge } from '../components/workout/DifficultyBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { HistoryEntry } from '../types'
import type { WorkoutOutcome, WorkoutCompletionState, PerceivedEffort } from '../modules/workout-outcomes/types'
import {
  COMPLETION_STATE_LABELS,
  completionStateToAction,
  formatPace,
  derivePaceSecondsPerMile,
} from '../modules/workout-outcomes/types'
import { isRunType } from '../modules/workout-metadata/types'

const EFFORT_LABELS: Record<PerceivedEffort, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Max Effort',
}

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const entries = useHistoryStore(s => s.entries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)
  const updateAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const updateOutcome = useOutcomeStore(s => s.updateOutcome)
  const updateOutcomeNotes = useOutcomeStore(s => s.updateOutcomeNotes)

  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [notesText, setNotesText] = useState('')
  const [completionStateEdit, setCompletionStateEdit] = useState<WorkoutCompletionState | null>(null)
  const [effortEdit, setEffortEdit] = useState<PerceivedEffort | null>(null)
  const [durationEdit, setDurationEdit] = useState('')
  const [distanceEdit, setDistanceEdit] = useState('')
  const [runDurationEdit, setRunDurationEdit] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterPlanId, setFilterPlanId] = useState<string | 'all'>('all')

  const plansWithHistory = Object.values(plans).filter(p =>
    entries.some(e => e.planId === p.id),
  )
  const showPlanFilter = plansWithHistory.length > 1

  const sorted = [...entries]
    .sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))
    .filter(e => filterPlanId === 'all' || e.planId === filterPlanId)

  function getOutcome(entry: HistoryEntry): WorkoutOutcome | null {
    const id = makeWorkoutInstanceId(entry.planId, entry.calendarDate)
    return outcomes[id] ?? null
  }

  function openEdit(entry: HistoryEntry) {
    const outcome = getOutcome(entry)
    setNotesText(entry.notes ?? '')
    if (entry.action === 'complete') {
      const cs = outcome?.completionState
      setCompletionStateEdit(
        cs === 'partially_completed' ? 'partially_completed' : 'completed',
      )
    } else if (entry.action === 'skip') {
      setCompletionStateEdit(null)
    } else {
      setCompletionStateEdit(null)
    }
    setEffortEdit(outcome?.perceivedEffort ?? null)
    setDurationEdit(outcome?.durationActualMin?.toString() ?? '')
    setDistanceEdit(outcome?.runActual?.actualDistanceMiles?.toString() ?? '')
    setRunDurationEdit(outcome?.runActual?.actualDurationMin?.toString() ?? '')
    setEditingEntry(entry)
  }

  function saveAndClose() {
    if (!editingEntry) return

    const instanceId = makeWorkoutInstanceId(editingEntry.planId, editingEntry.calendarDate)
    const plan = plans[editingEntry.planId]
    const planDay = editingEntry.planDayIndex !== undefined
      ? plan?.days[editingEntry.planDayIndex]
      : undefined
    const hasRun = planDay?.slots.some(s => isRunType(s.type)) ?? false

    updateNotes(editingEntry.id, notesText)

    if (completionStateEdit != null) {
      const newAction = completionStateToAction(completionStateEdit)
      if (newAction !== editingEntry.action) {
        updateAction(editingEntry.planId, editingEntry.calendarDate, newAction, editingEntry.planDayIndex)
      }

      const dist = parseFloat(distanceEdit)
      const runDur = parseFloat(runDurationEdit)
      const runActual = hasRun ? {
        actualDistanceMiles: isFinite(dist) && dist > 0 ? dist : null,
        actualDurationMin: isFinite(runDur) && runDur > 0 ? runDur : null,
        averagePaceSecondsPerMile:
          isFinite(dist) && dist > 0 && isFinite(runDur) && runDur > 0
            ? derivePaceSecondsPerMile(dist, runDur)
            : null,
        completedAsPlanned: null,
      } : null

      const durMin = parseFloat(durationEdit)
      updateOutcome(instanceId, {
        completionState: completionStateEdit,
        perceivedEffort: effortEdit,
        durationActualMin: isFinite(durMin) && durMin > 0 ? durMin : null,
        notes: notesText.trim() || null,
        ...(hasRun ? { runActual } : {}),
      })
    } else {
      updateOutcomeNotes(instanceId, notesText)
    }

    setEditingEntry(null)
  }

  function deleteEntry(entry: HistoryEntry) {
    removeEntry(entry.planId, entry.calendarDate)
    setConfirmDeleteId(null)
    setEditingEntry(null)
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-bold text-white">History</h1>
        </div>
        <EmptyState
          title="No history yet"
          description="Complete or skip workouts to build your history."
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="text-sm text-slate-400 mt-0.5">{sorted.length} logged days</p>
          </div>
          {showPlanFilter && (
            <select
              value={filterPlanId}
              onChange={e => setFilterPlanId(e.target.value)}
              className="mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[140px] truncate"
            >
              <option value="all">All plans</option>
              {plansWithHistory.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {sorted.length === 0 && filterPlanId !== 'all' && (
        <p className="text-sm text-slate-500 text-center py-8">
          No entries for this plan.
        </p>
      )}

      <div className="space-y-2 pb-4">
        {sorted.map(entry => {
          const plan = plans[entry.planId]
          const planDay = plan?.days.find((_, idx) => idx === entry.planDayIndex)
          const outcome = getOutcome(entry)
          const completionState = outcome?.completionState ?? null

          // Only apply completionState to the display when it's consistent with entry.action
          const displayState = completionState && completionStateToAction(completionState) === entry.action
            ? completionState
            : null

          const actionIcon = displayState === 'partially_completed'
            ? <MinusCircle size={18} className="text-yellow-400" />
            : displayState === 'deferred'
              ? <Pause size={18} className="text-purple-400" />
              : displayState === 'swapped'
                ? <Shuffle size={18} className="text-sky-400" />
                : entry.action === 'complete'
                  ? <CheckCircle2 size={18} className="text-emerald-400" />
                  : entry.action === 'skip'
                    ? <SkipForward size={18} className="text-slate-500" />
                    : <Coffee size={18} className="text-amber-400" />

          const actionColor = displayState === 'partially_completed'
            ? 'text-yellow-400'
            : displayState === 'deferred'
              ? 'text-purple-400'
              : displayState === 'swapped'
                ? 'text-sky-400'
                : entry.action === 'complete'
                  ? 'text-emerald-400'
                  : entry.action === 'skip'
                    ? 'text-slate-400'
                    : 'text-amber-400'

          const stateLabel = displayState
            ? COMPLETION_STATE_LABELS[displayState]
            : entry.action === 'complete'
              ? 'Completed'
              : entry.action.replace('_', ' ')

          return (
            <div
              key={entry.id}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {actionIcon}
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium">
                        {format(parseISO(entry.calendarDate), 'EEE, MMM d, yyyy')}
                      </p>
                      <p className="text-sm font-semibold text-slate-200">
                        {planDay?.label ?? (entry.action === 'day_off' ? 'Day Off' : 'Unknown day')}
                      </p>
                    </div>
                  </div>

                  {planDay && (
                    <div className="mt-1 ml-6">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs text-slate-500">
                          {planDay.slots.map(s => s.name).join(' + ')} · {plan?.name}
                        </p>
                        {planDay.slots.map(s => s.difficulty && (
                          <DifficultyBadge key={s.id} difficulty={s.difficulty} />
                        ))}
                      </div>
                    </div>
                  )}

                  {outcome && (
                    <div className="mt-2 ml-6 space-y-1">
                      {outcome.perceivedEffort != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Effort:</span>
                          <div className="flex gap-0.5">
                            {([1,2,3,4,5] as const).map(e => (
                              <span
                                key={e}
                                className={`w-3 h-3 rounded-full ${
                                  e <= outcome.perceivedEffort!
                                    ? e <= 2
                                      ? 'bg-emerald-400'
                                      : e === 3
                                        ? 'bg-yellow-400'
                                        : e === 4
                                          ? 'bg-orange-400'
                                          : 'bg-red-400'
                                    : 'bg-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">{outcome.perceivedEffort}/5</span>
                        </div>
                      )}

                      {outcome.runActual && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          {outcome.runActual.actualDistanceMiles != null && (
                            <span className="flex items-center gap-0.5">
                              <Ruler size={10} /> {outcome.runActual.actualDistanceMiles} mi
                            </span>
                          )}
                          {outcome.runActual.actualDurationMin != null && (
                            <span className="flex items-center gap-0.5">
                              <Timer size={10} /> {outcome.runActual.actualDurationMin} min
                            </span>
                          )}
                          {outcome.runActual.averagePaceSecondsPerMile != null && (
                            <span className="flex items-center gap-0.5">
                              <Zap size={10} /> {formatPace(outcome.runActual.averagePaceSecondsPerMile)}
                            </span>
                          )}
                        </div>
                      )}

                      {!outcome.runActual && outcome.durationActualMin != null && (
                        <p className="text-xs text-slate-500">
                          {outcome.durationActualMin} min
                        </p>
                      )}
                    </div>
                  )}

                  {entry.notes && (
                    <p className="text-sm text-slate-400 italic mt-2 ml-6">"{entry.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-xs font-medium capitalize ${actionColor}`}>
                    {stateLabel}
                  </span>
                  <button
                    onClick={() => openEdit(entry)}
                    className="ml-1 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editingEntry && (() => {
        const plan = plans[editingEntry.planId]
        const planDay = editingEntry.planDayIndex !== undefined
          ? plan?.days[editingEntry.planDayIndex]
          : undefined
        const hasRun = planDay?.slots.some(s => isRunType(s.type)) ?? false
        const showOutcomeFields = completionStateEdit != null
        const isSkipEntry = editingEntry.action === 'skip'
        const isDayOffEntry = editingEntry.action === 'day_off'

        const dist = parseFloat(distanceEdit)
        const runDur = parseFloat(runDurationEdit)
        const derivedPace =
          isFinite(dist) && dist > 0 && isFinite(runDur) && runDur > 0
            ? derivePaceSecondsPerMile(dist, runDur)
            : null

        return (
          <Modal
            title={format(parseISO(editingEntry.calendarDate), 'EEE, MMM d, yyyy')}
            onClose={saveAndClose}
            footer={
              <button
                onClick={saveAndClose}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
              >
                Save
              </button>
            }
          >
            <div className="space-y-4">
              {/* Status — only for complete and skip entries */}
              {!isDayOffEntry && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                    {isSkipEntry ? 'Change to' : 'Status'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCompletionStateEdit('completed')}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                        completionStateEdit === 'completed'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                      Completed
                    </button>
                    <button
                      onClick={() => setCompletionStateEdit('partially_completed')}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                        completionStateEdit === 'partially_completed'
                          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                          : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      <MinusCircle size={16} />
                      Partial
                    </button>
                  </div>
                </div>
              )}

              {/* Outcome fields — shown when a completion state is selected */}
              {showOutcomeFields && (
                <>
                  {/* Perceived effort */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                      Perceived Effort
                    </p>
                    <div className="flex gap-1.5">
                      {([1, 2, 3, 4, 5] as PerceivedEffort[]).map(e => (
                        <button
                          key={e}
                          onClick={() => setEffortEdit(prev => prev === e ? null : e)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                            effortEdit === e
                              ? e <= 2
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : e === 3
                                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                  : e === 4
                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                    : 'bg-red-500/20 border-red-500/50 text-red-400'
                              : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    {effortEdit && (
                      <p className="text-xs text-slate-500 mt-1 text-center">{EFFORT_LABELS[effortEdit]}</p>
                    )}
                  </div>

                  {/* Duration */}
                  {!hasRun && (
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">
                        <Clock3 size={11} className="inline mr-1" />
                        Duration (min)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={durationEdit}
                        onChange={e => setDurationEdit(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}

                  {/* Run actuals */}
                  {hasRun && (
                    <div className="space-y-3 border border-slate-700 rounded-xl p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                        Run Actuals
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Ruler size={11} /> Distance (mi)
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={distanceEdit}
                            onChange={e => setDistanceEdit(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Timer size={11} /> Time (min)
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={runDurationEdit}
                            onChange={e => setRunDurationEdit(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </label>
                      </div>
                      {derivedPace != null && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2">
                          <Zap size={11} className="text-sky-400" />
                          <span>Avg pace: <strong className="text-sky-300">{formatPace(derivedPace)}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Notes</p>
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => setConfirmDeleteId(editingEntry.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
              >
                <Trash2 size={15} /> Delete entry
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* Delete confirm */}
      {confirmDeleteId && editingEntry && (
        <Modal title="Delete entry?" onClose={() => setConfirmDeleteId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will permanently remove this logged day. The rotation will treat that day as if nothing was recorded.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
              >
                <X size={14} className="inline mr-1" />Cancel
              </button>
              <button
                onClick={() => deleteEntry(editingEntry)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
