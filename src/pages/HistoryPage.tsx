import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle2,
  SkipForward,
  Coffee,
  Pencil,
  Trash2,
  X,
  Plus,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { Modal } from '../components/shared/Modal'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { OutcomeMetrics } from '../components/workout/OutcomeMetrics'
import { WorkoutSlotDetails } from '../components/workout/WorkoutSlotDetails'
import { EmptyState } from '../components/shared/EmptyState'
import { CsvToolbar, type ImportResult } from '../components/shared/CsvToolbar'
import { downloadCsv, historyToCsv, historyFromCsv } from '../lib/csv'
import { computeHistoryStats, computePersonalRecords } from '../lib/historyStats'
import type { PersonalRecord } from '../lib/historyStats'
import { getPlansWithHistory, hasPlanHistory } from '../lib/historyScope'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import type { ActionType, HistoryEntry, ExtraWorkoutEntry, WorkoutType, PlanDay } from '../types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'
import { COMPLETION_STATE_LABELS } from '../modules/workout-outcomes/types'
import { extraToPlanDay } from '../lib/planDayUtils'

const WORKOUT_TYPES: { type: WorkoutType; label: string }[] = [
  { type: 'weights', label: 'Weights' },
  { type: 'run', label: 'Run' },
  { type: 'swim', label: 'Swim' },
  { type: 'yoga', label: 'Yoga' },
  { type: 'other', label: 'Other' },
]

/** Plural display labels used in the training-mix summary row. */
const TYPE_MIX_LABEL: Partial<Record<WorkoutType, string>> = {
  weights: 'weights',
  run: 'runs',
  swim: 'swims',
  yoga: 'yoga',
  other: 'other',
}

type FlatItem =
  | { kind: 'rotation'; date: string; sortKey: string; entry: HistoryEntry }
  | { kind: 'extra'; date: string; sortKey: string; extra: ExtraWorkoutEntry }

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const activePlanId = usePlanStore(s => s.activePlanId)
  const entries = useHistoryStore(s => s.entries)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)
  const updateAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const importEntries = useHistoryStore(s => s.importEntries)
  const importExtraEntries = useHistoryStore(s => s.importExtraEntries)
  const addExtraEntry = useHistoryStore(s => s.addExtraEntry)
  const removeExtraEntry = useHistoryStore(s => s.removeExtraEntry)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const updateOutcomeNotes = useOutcomeStore(s => s.updateOutcomeNotes)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const importOutcomes = useOutcomeStore(s => s.importOutcomes)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)
  const moveOutcome = useOutcomeStore(s => s.moveOutcome)
  const updateEntryDate = useHistoryStore(s => s.updateEntryDate)
  const updateExtraEntryDate = useHistoryStore(s => s.updateExtraEntryDate)
  const updateExtraEntry = useHistoryStore(s => s.updateExtraEntry)

  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [notesText, setNotesText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteExtraId, setConfirmDeleteExtraId] = useState<string | null>(null)

  const [outcomeTarget, setOutcomeTarget] = useState<{
    planId: string
    calendarDate: string
    planDay: PlanDay
    instanceId: string
  } | null>(null)

  // Inline "add extra" form — keyed by calendarDate
  const [addingExtraDate, setAddingExtraDate] = useState<string | null>(null)
  const [extraType, setExtraType] = useState<WorkoutType>('yoga')
  const [extraName, setExtraName] = useState('')

  const [editingEntryDate, setEditingEntryDate] = useState('')
  const [dateConflict, setDateConflict] = useState(false)

  const [editingExtra, setEditingExtra] = useState<ExtraWorkoutEntry | null>(null)
  const [editingExtraDate, setEditingExtraDate] = useState('')
  const [editingExtraType, setEditingExtraType] = useState<WorkoutType>('yoga')
  const [editingExtraName, setEditingExtraName] = useState('')

  const plansWithHistory = getPlansWithHistory(plans, entries, extraEntries)
  const showPlanFilter = plansWithHistory.length > 1
  const activePlanHasHistory = hasPlanHistory(activePlanId, entries, extraEntries)
  const [filterPlanId, setFilterPlanId] = useState<string | 'all'>(
    activePlanHasHistory ? activePlanId! : 'all',
  )

  const filteredEntries = useMemo(
    () => entries.filter(e => filterPlanId === 'all' || e.planId === filterPlanId),
    [entries, filterPlanId],
  )

  const filteredExtras = useMemo(
    () => extraEntries.filter(e => filterPlanId === 'all' || e.planId === filterPlanId),
    [extraEntries, filterPlanId],
  )

  // Build a unified flat list sorted newest-date-first; within a date: rotation before extras
  const flatItems: FlatItem[] = useMemo(() => [
    ...filteredEntries.map(e => ({
      kind: 'rotation' as const,
      date: e.calendarDate,
      sortKey: e.createdAt,
      entry: e,
    })),
    ...filteredExtras.map(e => ({
      kind: 'extra' as const,
      date: e.calendarDate,
      sortKey: e.createdAt,
      extra: e,
    })),
  ].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    if (a.kind !== b.kind) return a.kind === 'rotation' ? -1 : 1
    return b.sortKey.localeCompare(a.sortKey)
  }), [filteredEntries, filteredExtras])

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const stats = computeHistoryStats(filteredEntries, filteredExtras, todayKey)

  // Count completed workouts by type for the training-mix summary row.
  // Rotation entries use the plan day's first slot type; extras use workoutType.
  const typeCountMap = useMemo(() => {
    const counts = new Map<WorkoutType, number>()
    for (const item of flatItems) {
      let type: WorkoutType | undefined
      if (item.kind === 'extra') {
        type = item.extra.workoutType
      } else if (item.entry.action === 'complete') {
        const p = plans[item.entry.planId]
        type = p?.days[item.entry.planDayIndex ?? -1]?.slots[0]?.type
      }
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return counts
  }, [flatItems, plans])

  const typeMixLabel = useMemo(() => {
    if (typeCountMap.size === 0) return null
    return [...typeCountMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([t, n]) => `${n} ${TYPE_MIX_LABEL[t] ?? t}`)
      .join(' · ')
  }, [typeCountMap])

  const allExerciseRecords = useExerciseHistoryStore(s => s.records)
  const personalRecords = useMemo(
    () => computePersonalRecords(allExerciseRecords, filterPlanId === 'all' ? null : filterPlanId),
    [allExerciseRecords, filterPlanId],
  )

  function openEdit(entry: HistoryEntry) {
    setNotesText(entry.notes ?? '')
    setEditingEntryDate(entry.calendarDate)
    setDateConflict(false)
    setEditingEntry(entry)
  }

  function discardAndClose() {
    setEditingEntry(null)
    setDateConflict(false)
  }

  function saveAndClose() {
    if (!editingEntry) return
    const oldDate = editingEntry.calendarDate
    const newDate = editingEntryDate
    if (newDate !== oldDate) {
      const conflict = entries.some(
        e => e.id !== editingEntry.id && e.planId === editingEntry.planId && e.calendarDate === newDate,
      )
      if (conflict) { setDateConflict(true); return }
      moveOutcome(
        makeWorkoutInstanceId(editingEntry.planId, oldDate),
        makeWorkoutInstanceId(editingEntry.planId, newDate),
      )
      updateEntryDate(editingEntry.id, newDate)
    }
    updateNotes(editingEntry.id, notesText)
    updateOutcomeNotes(makeWorkoutInstanceId(editingEntry.planId, newDate), notesText)
    setEditingEntry(null)
    setDateConflict(false)
  }

  function changeAction(action: ActionType) {
    if (!editingEntry) return
    updateAction(editingEntry.planId, editingEntry.calendarDate, action)
    setEditingEntry(prev => prev ? { ...prev, action } : null)
  }

  function deleteEntry(entry: HistoryEntry) {
    removeEntry(entry.planId, entry.calendarDate)
    removeOutcome(makeWorkoutInstanceId(entry.planId, entry.calendarDate))
    setConfirmDeleteId(null)
    setEditingEntry(null)
  }

  function openOutcomeForEntry(entry: HistoryEntry) {
    const plan = plans[entry.planId]
    if (!plan || entry.planDayIndex === undefined) return
    const planDay = plan.days[entry.planDayIndex]
    if (!planDay) return
    setEditingEntry(null)
    setOutcomeTarget({
      planId: entry.planId,
      calendarDate: entry.calendarDate,
      planDay,
      instanceId: makeWorkoutInstanceId(entry.planId, entry.calendarDate),
    })
  }

  function openOutcomeForExtra(extra: ExtraWorkoutEntry) {
    setOutcomeTarget({
      planId: extra.planId,
      calendarDate: extra.calendarDate,
      planDay: extraToPlanDay(extra),
      instanceId: makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id),
    })
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!outcomeTarget) return
    const originalDate = outcomeTarget.calendarDate
    const completedDate = outcome.completedAt
      ? format(new Date(outcome.completedAt), 'yyyy-MM-dd')
      : originalDate
    const isExtra = outcomeTarget.instanceId.includes('_extra_')
    let finalOutcome = outcome

    if (completedDate !== originalDate) {
      if (isExtra) {
        const extraId = outcomeTarget.instanceId.split('_extra_')[1]
        if (extraId) {
          updateExtraEntryDate(extraId, completedDate)
          const nextId = makeExtraWorkoutInstanceId(outcomeTarget.planId, completedDate, extraId)
          moveOutcome(outcomeTarget.instanceId, nextId)
          finalOutcome = { ...outcome, workoutInstanceId: nextId }
        }
      } else {
        const entryToMove = entries.find(
          e => e.planId === outcomeTarget.planId && e.calendarDate === originalDate,
        )
        if (entryToMove) {
          removeEntry(outcomeTarget.planId, completedDate)
          updateEntryDate(entryToMove.id, completedDate)
        }
        const nextId = makeWorkoutInstanceId(outcomeTarget.planId, completedDate)
        moveOutcome(outcomeTarget.instanceId, nextId)
        finalOutcome = { ...outcome, workoutInstanceId: nextId }
      }
    }

    const slot = outcomeTarget.planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
    logOutcomeWithProgression(finalOutcome, slot)
    // Read fresh store state — `entries` closure is stale if updateEntryDate ran above
    const freshEntries = useHistoryStore.getState().entries
    const entry = freshEntries.find(
      e => e.planId === outcomeTarget.planId && e.calendarDate === completedDate,
    )
    if (entry && !outcomeTarget.instanceId.includes('_extra_')) {
      const action = completionStateToAction(outcome.completionState)
      if (entry.action !== action) updateAction(entry.planId, entry.calendarDate, action)
    }
    setOutcomeTarget(null)
  }

  function openExtraEdit(extra: ExtraWorkoutEntry) {
    setEditingExtra(extra)
    setEditingExtraDate(extra.calendarDate)
    setEditingExtraType(extra.workoutType)
    setEditingExtraName(extra.workoutName)
  }

  function saveAndCloseExtra() {
    if (!editingExtra) return
    const oldDate = editingExtra.calendarDate
    const newDate = editingExtraDate
    if (newDate !== oldDate) {
      moveOutcome(
        makeExtraWorkoutInstanceId(editingExtra.planId, oldDate, editingExtra.id),
        makeExtraWorkoutInstanceId(editingExtra.planId, newDate, editingExtra.id),
      )
      updateExtraEntryDate(editingExtra.id, newDate)
    }
    if (editingExtraType !== editingExtra.workoutType || editingExtraName !== editingExtra.workoutName) {
      updateExtraEntry(editingExtra.id, { workoutType: editingExtraType, workoutName: editingExtraName })
    }
    setEditingExtra(null)
  }

  function submitAddExtra(planId: string, calendarDate: string) {
    const name = extraName.trim() || WORKOUT_TYPES.find(w => w.type === extraType)?.label || extraType
    addExtraEntry({ planId, calendarDate, workoutType: extraType, workoutName: name, source: 'history' })
    setAddingExtraDate(null)
    setExtraName('')
    setExtraType('yoga')
  }

  function handleExport() {
    const csv = historyToCsv(entries, extraEntries, plans, outcomes)
    const stamp = format(new Date(), 'yyyy-MM-dd')
    downloadCsv(`workout-history-${stamp}.csv`, csv)
  }

  async function handleImport(file: File): Promise<ImportResult> {
    const text = await file.text()
    const existingPlanIds = new Set(Object.keys(plans))
    const {
      entries: newEntries,
      extras: newExtras,
      outcomes: newOutcomes,
      warnings,
    } = historyFromCsv(text, existingPlanIds)
    importEntries(newEntries)
    importExtraEntries(newExtras)
    importOutcomes(newOutcomes)
    const parts: string[] = []
    if (newEntries.length > 0) {
      parts.push(`${newEntries.length} history ${newEntries.length === 1 ? 'entry' : 'entries'}`)
    }
    if (newExtras.length > 0) {
      parts.push(`${newExtras.length} extra workout${newExtras.length === 1 ? '' : 's'}`)
    }
    if (newOutcomes.length > 0) {
      parts.push(`${newOutcomes.length} outcome record${newOutcomes.length === 1 ? '' : 's'}`)
    }
    const summary = parts.length === 0
      ? 'No importable rows found.'
      : `Imported ${parts.join(', ')}.`
    return { summary, warnings }
  }

  if (entries.length === 0 && extraEntries.length === 0) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-6 pb-4 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-white">History</h1>
          <CsvToolbar canExport={false} onExport={handleExport} onImport={handleImport} />
        </div>
        <EmptyState title="No history yet" description="Complete or skip workouts to build your history." />
      </div>
    )
  }

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="text-sm text-slate-400 mt-0.5">{flatItems.length} workout{flatItems.length === 1 ? '' : 's'}</p>
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
        <CsvToolbar canExport={entries.length > 0 || extraEntries.length > 0} onExport={handleExport} onImport={handleImport} />

        {(filteredEntries.length > 0 || filteredExtras.length > 0) && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <StatTile label="Streak" value={stats.currentStreak} suffix={stats.currentStreak === 1 ? 'day' : 'days'} />
              <StatTile label="7-day" value={stats.last7Completed} />
              <StatTile label="30-day" value={stats.last30Completed} />
              <StatTile label="Total" value={stats.totalCompleted} />
            </div>
            {typeMixLabel && (
              <p className="text-xs text-slate-500 text-center">{typeMixLabel}</p>
            )}
          </div>
        )}
      </div>

      {personalRecords.length > 0 && (
        <PersonalRecordsSection records={personalRecords} />
      )}

      {flatItems.length === 0 && filterPlanId !== 'all' && (
        <p className="text-sm text-slate-500 text-center py-8">No entries for this plan.</p>
      )}

      <div className="space-y-2 pb-4">
        {flatItems.map((item, idx) => {
          // Show "+ Add workout" between the last item of a date and the first item of the next date
          const isLastForDate = idx === flatItems.length - 1 || flatItems[idx + 1].date !== item.date

          if (item.kind === 'rotation') {
            const { entry } = item
            const plan = plans[entry.planId]
            const planDay = plan?.days[entry.planDayIndex ?? -1]
            const outcome = outcomes[makeWorkoutInstanceId(entry.planId, entry.calendarDate)] ?? null
            const completionState = outcome?.completionState ?? null

            const workoutTitle = entry.action === 'day_off'
              ? 'Day Off'
              : planDay
                ? planDay.slots.map(s => s.name).join(' + ')
                : 'Unknown workout'

            const actionColor = completionState === 'partially_completed' ? 'text-yellow-400'
              : completionState === 'deferred' ? 'text-purple-400'
              : completionState === 'swapped' ? 'text-sky-400'
              : entry.action === 'complete' ? 'text-emerald-400'
              : entry.action === 'skip' ? 'text-slate-400'
              : 'text-amber-400'

            const stateLabel = completionState
              ? COMPLETION_STATE_LABELS[completionState]
              : entry.action.replace(/_/g, ' ')

            const isComplete = entry.action === 'complete'

            return (
              <div key={entry.id}>
                <div
                  className={`bg-slate-800/80 rounded-xl border border-slate-700/50 overflow-hidden ${isComplete ? 'cursor-pointer hover:border-slate-600 transition-colors active:scale-[0.99]' : ''}`}
                  onClick={isComplete ? () => openOutcomeForEntry(entry) : undefined}
                >
                  <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Date */}
                      <p className="text-xs text-slate-500 font-medium mb-1">
                        {format(parseISO(entry.calendarDate), 'EEE, MMM d, yyyy')}
                      </p>

                      {/* Title + workout detail */}
                      {entry.action === 'day_off' ? (
                        <div className="flex items-center gap-2">
                          <Coffee size={14} className="text-amber-400 flex-shrink-0" />
                          <p className="text-sm font-semibold text-slate-200 truncate">{workoutTitle}</p>
                        </div>
                      ) : (
                        <div className={`space-y-2 ${planDay && planDay.slots.length > 1 ? 'divide-y divide-slate-700/50' : ''}`}>
                          {planDay?.slots.map((slot, i) => (
                            <WorkoutSlotDetails key={slot.id} slot={slot} planId={entry.planId} className={i > 0 ? 'pt-2' : ''} />
                          ))}
                          {plan && (
                            <p className="text-xs text-slate-500">{plan.name}</p>
                          )}
                        </div>
                      )}

                      {/* Outcome actuals */}
                      {outcome && (
                        <div className="mt-2">
                          <OutcomeMetrics outcome={outcome} />
                        </div>
                      )}

                      {entry.notes && (
                        <p className="text-xs text-slate-400 italic mt-1.5">"{entry.notes}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 mt-5" onClick={e => e.stopPropagation()}>
                      <span className={`text-xs font-medium capitalize ${actionColor}`}>{stateLabel}</span>
                      <button
                        onClick={() => openEdit(entry)}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                        title="Edit entry"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                  {isComplete && (
                    <p className="text-[10px] text-slate-600 mt-2">Tap to view &amp; edit workout details</p>
                  )}
                  </div>
                </div>

                {/* "+ Add workout" appears after the last item for this date */}
                {isLastForDate && addingExtraDate === entry.calendarDate ? (
                  <div className="mt-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-slate-400 font-medium">Add workout for {format(parseISO(entry.calendarDate), 'MMM d')}</p>
                    <select
                      value={extraType}
                      onChange={e => setExtraType(e.target.value as WorkoutType)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {WORKOUT_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
                    </select>
                    <input
                      type="text"
                      value={extraName}
                      onChange={e => setExtraName(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => submitAddExtra(entry.planId, entry.calendarDate)} className="flex-1 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">Add</button>
                      <button onClick={() => { setAddingExtraDate(null); setExtraName('') }} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : isLastForDate && addingExtraDate !== entry.calendarDate ? (
                  <button
                    onClick={() => { setAddingExtraDate(entry.calendarDate); setExtraType('yoga'); setExtraName('') }}
                    className="mt-1 flex items-center gap-1 text-xs text-slate-600 hover:text-sky-400 transition-colors px-1"
                  >
                    <Plus size={11} /> Add workout for this day
                  </button>
                ) : null}
              </div>
            )
          }

          // kind === 'extra'
          const { extra } = item
          const instanceId = makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id)
          const extraOutcome = outcomes[instanceId] ?? null

          return (
            <div key={extra.id}>
              <div
                className="bg-slate-800/60 rounded-xl border border-slate-700/30 overflow-hidden cursor-pointer hover:border-slate-600 transition-colors active:scale-[0.99]"
                onClick={() => openOutcomeForExtra(extra)}
              >
                <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      {format(parseISO(extra.calendarDate), 'EEE, MMM d, yyyy')}
                    </p>

                    <div className="space-y-1.5">
                      <WorkoutSlotDetails
                        slot={{ id: extra.id, type: extra.workoutType, name: extra.workoutName }}
                      />
                      {extra.source === 'double_day'
                        ? <span className="inline-flex text-[10px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-full font-medium">Bonus</span>
                        : <span className="inline-flex text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-full font-medium">Extra</span>
                      }
                    </div>

                    {extraOutcome && (
                      <div className="mt-2">
                        <OutcomeMetrics outcome={extraOutcome} />
                      </div>
                    )}

                    {extra.notes && (
                      <p className="text-xs text-slate-400 italic mt-1.5">"{extra.notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 mt-5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openExtraEdit(extra)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    {confirmDeleteExtraId === extra.id ? (
                      <>
                        <button
                          onClick={() => { removeExtraEntry(extra.id); removeOutcome(instanceId); setConfirmDeleteExtraId(null) }}
                          className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteExtraId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-medium transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteExtraId(extra.id)}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 mt-2">Tap to view &amp; edit workout details</p>
                </div>
              </div>

              {isLastForDate && addingExtraDate === extra.calendarDate ? (
                <div className="mt-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-slate-400 font-medium">Add workout for {format(parseISO(extra.calendarDate), 'MMM d')}</p>
                  <select
                    value={extraType}
                    onChange={e => setExtraType(e.target.value as WorkoutType)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {WORKOUT_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={extraName}
                    onChange={e => setExtraName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => submitAddExtra(extra.planId, extra.calendarDate)} className="flex-1 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">Add</button>
                    <button onClick={() => { setAddingExtraDate(null); setExtraName('') }} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : isLastForDate ? (
                <button
                  onClick={() => { setAddingExtraDate(extra.calendarDate); setExtraType('yoga'); setExtraName('') }}
                  className="mt-1 flex items-center gap-1 text-xs text-slate-600 hover:text-sky-400 transition-colors px-1"
                >
                  <Plus size={11} /> Add workout for this day
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Edit modal (rotation entries only) */}
      {editingEntry && (
        <Modal
          title={format(parseISO(editingEntry.calendarDate), 'EEE, MMM d, yyyy')}
          onClose={discardAndClose}
          footer={
            <button onClick={saveAndClose} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors">
              Save
            </button>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Date</p>
              <input
                type="date"
                value={editingEntryDate}
                onChange={e => { setEditingEntryDate(e.target.value); setDateConflict(false) }}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {dateConflict && (
                <p className="text-xs text-red-400 mt-1">A workout is already logged for that date.</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Status</p>
              <div className="grid grid-cols-3 gap-2">
                {(['complete', 'skip', 'day_off'] as ActionType[]).map(action => (
                  <button
                    key={action}
                    onClick={() => changeAction(action)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      editingEntry.action === action
                        ? action === 'complete' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : action === 'skip' ? 'bg-slate-600 border-slate-500 text-slate-200'
                          : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                    }`}
                  >
                    {action === 'complete' ? <CheckCircle2 size={16} /> : action === 'skip' ? <SkipForward size={16} /> : <Coffee size={16} />}
                    {action === 'complete' ? 'Complete' : action === 'skip' ? 'Skip' : 'Day Off'}
                  </button>
                ))}
              </div>
            </div>

            {editingEntry.action === 'complete' && editingEntry.planDayIndex !== undefined && (
              <button
                onClick={() => openOutcomeForEntry(editingEntry)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
              >
                Edit Workout Details
              </button>
            )}

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

            <button
              onClick={() => setConfirmDeleteId(editingEntry.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              <Trash2 size={15} /> Delete entry
            </button>
          </div>
        </Modal>
      )}

      {confirmDeleteId && editingEntry && (
        <Modal title="Delete entry?" onClose={() => setConfirmDeleteId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will permanently remove this logged day. The rotation will treat that day as if nothing was recorded.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors">
                <X size={14} className="inline mr-1" />Cancel
              </button>
              <button onClick={() => deleteEntry(editingEntry)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingExtra && (
        <Modal
          title="Edit Workout"
          onClose={() => setEditingExtra(null)}
          footer={
            <button onClick={saveAndCloseExtra} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors">
              Save
            </button>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Date</p>
              <input
                type="date"
                value={editingExtraDate}
                onChange={e => setEditingExtraDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Type</p>
              <select
                value={editingExtraType}
                onChange={e => setEditingExtraType(e.target.value as WorkoutType)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {WORKOUT_TYPES.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Name</p>
              <input
                type="text"
                value={editingExtraName}
                onChange={e => setEditingExtraName(e.target.value)}
                placeholder="Workout name"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              onClick={() => {
                const iid = makeExtraWorkoutInstanceId(editingExtra.planId, editingExtra.calendarDate, editingExtra.id)
                removeExtraEntry(editingExtra.id)
                removeOutcome(iid)
                setEditingExtra(null)
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {outcomeTarget && (
        <OutcomeModal
          planId={outcomeTarget.planId}
          calendarDate={outcomeTarget.calendarDate}
          planDay={outcomeTarget.planDay}
          existingOutcome={outcomes[outcomeTarget.instanceId] ?? null}
          workoutInstanceId={outcomeTarget.instanceId}
          onConfirm={handleOutcomeConfirm}
          onClose={() => setOutcomeTarget(null)}
        />
      )}
    </div>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-2 py-2 text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-100 leading-tight mt-0.5">{value}</p>
      {suffix && <p className="text-[10px] text-slate-500 leading-tight">{suffix}</p>}
    </div>
  )
}

function PersonalRecordsSection({ records }: { records: PersonalRecord[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-1 py-1 text-left group"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Trophy size={12} className="text-yellow-500/80" />
          Personal Records
          <span className="font-normal text-slate-600 normal-case tracking-normal">({records.length})</span>
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        ) : (
          <ChevronDown size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 border-b border-slate-700/40">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">Exercise</span>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium text-right">Best weight</span>
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium text-right">Best reps</span>
          </div>
          {records.map(pr => (
            <div
              key={pr.exerciseName}
              className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 border-b border-slate-700/30 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{pr.exerciseName}</p>
                <p className="text-[10px] text-slate-600">{pr.sessionCount} session{pr.sessionCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {pr.maxLoad !== null ? (
                  <>
                    <p className="text-xs font-semibold text-slate-200">{pr.maxLoad} lb</p>
                    {pr.maxLoadDate && (
                      <p className="text-[10px] text-slate-600">{format(parseISO(pr.maxLoadDate), 'MMM d')}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600">—</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {pr.maxReps !== null ? (
                  <>
                    <p className="text-xs font-semibold text-slate-200">{pr.maxReps} reps</p>
                    {pr.maxRepsDate && (
                      <p className="text-[10px] text-slate-600">{format(parseISO(pr.maxRepsDate), 'MMM d')}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
