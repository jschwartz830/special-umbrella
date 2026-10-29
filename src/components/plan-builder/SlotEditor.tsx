import { useState } from 'react'
import { Plus, GripVertical, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { WORKOUT_META, WORKOUT_TYPES } from '../../lib/constants'
import { Modal } from '../shared/Modal'
import { nanoid } from '../../lib/utils'
import type { WorkoutSlot } from '../../types'
import type { ExerciseSpec, ProgressionType, SetSpec } from '../../types/program'
import { MOBILITY_LIBRARY, singleTimedSet, type MobilityRoutineExercise, type MobilitySet } from '../../lib/mobilityLibrary'
import { MobilityRoutineEditor } from '../mobility/MobilityRoutineEditor'
import { useMobilityStore } from '../../store/mobilityStore'
import { useDragReorder } from '../../hooks/useDragReorder'
import type { WorkoutDifficulty, RunWorkoutSubtype, RunWorkoutConfig, WeightsFocusArea, WeightsTrainingIntent, SwimWorkoutSubtype, YogaWorkoutSubtype, OtherWorkoutSubtype } from '../../modules/workout-metadata/types'
import { RUN_SUBTYPE_LABELS, isRunType, defaultRunSubtype } from '../../modules/workout-metadata/types'
import { PROGRESSION_TYPE_META, toVarName } from './progressionTypes'
import { DEFAULT_LADDER_SESSIONS, ladderReps } from '../../modules/rep-ladder/ladder'
import { defaultRepScheme, formatStep, parseRepScheme, repSchemeSteps } from '../../modules/rep-ladder/repScheme'
import { AddExerciseModal } from './AddExerciseModal'

// ── Slot editor ──────────────────────────────────────────────────────────────

export function SlotEditor({
  slot,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: WorkoutSlot
  onChange: (s: WorkoutSlot) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const meta = WORKOUT_META[slot.type]
  const isRun = isRunType(slot.type)
  const isWeights = slot.type === 'weights' || slot.type === 'weightlifting'
  const isOther = slot.type === 'other' || slot.type === 'rest'

  function set<K extends keyof WorkoutSlot>(key: K, val: WorkoutSlot[K]) {
    onChange({ ...slot, [key]: val })
  }

  function setRunConfig(patch: Partial<RunWorkoutConfig>) {
    const existing: RunWorkoutConfig = slot.runConfig ?? {
      subtype: defaultRunSubtype(slot.type),
    }
    onChange({ ...slot, runConfig: { ...existing, ...patch } })
  }

  const DIFFICULTIES: WorkoutDifficulty[] = ['easy', 'moderate', 'hard']
  const SUBTYPES: RunWorkoutSubtype[] = [
    'easy', 'long', 'tempo', 'intervals', 'recovery', 'custom',
  ]
  const WEIGHTS_FOCUS_AREAS: WeightsFocusArea[] = ['upper', 'lower', 'full_body', 'push', 'pull', 'legs', 'core']
  const WEIGHTS_INTENTS: WeightsTrainingIntent[] = ['strength', 'hypertrophy', 'power', 'conditioning', 'technique', 'deload', 'recovery_mobility']
  const SWIM_SUBTYPES: SwimWorkoutSubtype[] = ['easy', 'endurance', 'intervals', 'technique', 'recovery']
  const YOGA_SUBTYPES: YogaWorkoutSubtype[] = ['mobility', 'flow', 'recovery', 'strength', 'stretch']
  const OTHER_SUBTYPES: OtherWorkoutSubtype[] = ['rest', 'walk', 'sport', 'pt_rehab', 'mobility', 'custom']
  const {
    dragIndex: dragExerciseIdx,
    dropIndex: dropExerciseIdx,
    startDrag: startExerciseDrag,
    moveDrag: moveExerciseDrag,
    endDrag: endExerciseDrag,
  } = useDragReorder(moveExercise)
  const [showAddExercise, setShowAddExercise] = useState(false)

  function updateExercises(exercises: ExerciseSpec[]) {
    onChange({ ...slot, exercises })
  }

  function updateExercise(index: number, patch: Partial<ExerciseSpec>) {
    const source = slot.exercises ?? []
    const next = source.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))
    updateExercises(next)
  }

  function updateSetSpec(exIndex: number, setIndex: number, patch: Partial<SetSpec>) {
    const source = slot.exercises ?? []
    const ex = source[exIndex]
    if (!ex || !Array.isArray(ex.sets)) return
    const sets = ex.sets.map((sp, k) => (k === setIndex ? { ...sp, ...patch } : sp))
    updateExercise(exIndex, { sets })
  }

  function removeExercise(index: number) {
    const source = slot.exercises ?? []
    updateExercises(source.filter((_, i) => i !== index))
  }

  function addExercises(specs: ExerciseSpec[]) {
    if (specs.length === 0) return
    updateExercises([...(slot.exercises ?? []), ...specs])
    setShowAddExercise(false)
  }

  function moveExercise(from: number, to: number) {
    const source = slot.exercises ?? []
    if (from === to || from < 0 || to < 0 || from >= source.length || to >= source.length) return
    const next = [...source]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateExercises(next)
  }

  // ── Mobility exercises (slot.mobilityExercises) ──────────────────────────
  function updateMobilityExercises(mobilityExercises: MobilityRoutineExercise[]) {
    onChange({ ...slot, mobilityExercises })
  }

  const mobilityCallbacks = {
    onUpdateExercise(id: string, patch: Partial<Pick<MobilityRoutineExercise, 'name' | 'restSec' | 'notes'>>) {
      updateMobilityExercises((slot.mobilityExercises ?? []).map(e => e.id === id ? { ...e, ...patch } : e))
    },
    onAddSet(exerciseId: string, newSet?: MobilitySet) {
      updateMobilityExercises((slot.mobilityExercises ?? []).map(e => {
        if (e.id !== exerciseId) return e
        const last = e.sets[e.sets.length - 1]
        return { ...e, sets: [...e.sets, newSet ?? last ?? { durationSec: 30 }] }
      }))
    },
    onUpdateSet(exerciseId: string, setIdx: number, patch: MobilitySet) {
      updateMobilityExercises((slot.mobilityExercises ?? []).map(e => {
        if (e.id !== exerciseId) return e
        return { ...e, sets: e.sets.map((s, i) => i === setIdx ? { ...patch } : s) }
      }))
    },
    onRemoveSet(exerciseId: string, setIdx: number) {
      updateMobilityExercises((slot.mobilityExercises ?? []).map(e => {
        if (e.id !== exerciseId || e.sets.length <= 1) return e
        return { ...e, sets: e.sets.filter((_, i) => i !== setIdx) }
      }))
    },
    onRemoveExercise(id: string) {
      updateMobilityExercises((slot.mobilityExercises ?? []).filter(e => e.id !== id))
    },
  }

  function reorderMobilityExercise(fromIdx: number, toIdx: number) {
    const next = [...(slot.mobilityExercises ?? [])]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    updateMobilityExercises(next)
  }

  function addMobilityExerciseFromLibrary(libraryId: string) {
    const existing = slot.mobilityExercises ?? []
    if (existing.some(e => e.id === libraryId)) return
    const libEx = MOBILITY_LIBRARY.find(e => e.id === libraryId)
    if (!libEx) return
    updateMobilityExercises([...existing, { id: libraryId, name: libEx.name, sets: singleTimedSet(libEx.durationSec) }])
  }

  function addCustomMobilityExercise(name: string, sets: MobilitySet[]) {
    updateMobilityExercises([...(slot.mobilityExercises ?? []), { id: nanoid(), name, sets }])
  }

  const mobilityTemplates = useMobilityStore(s => s.customTemplates)
  const saveMobilityTemplate = useMobilityStore(s => s.saveAsTemplate)

  function loadMobilityTemplate(templateId: string, mode: 'replace' | 'append') {
    const template = mobilityTemplates.find(t => t.id === templateId)
    if (!template) return
    const incoming = template.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) }))
    if (mode === 'replace') { updateMobilityExercises(incoming); return }
    const existing = new Set((slot.mobilityExercises ?? []).map(e => e.id))
    updateMobilityExercises([...(slot.mobilityExercises ?? []), ...incoming.filter(e => !existing.has(e.id))])
  }

  function saveMobilityAsTemplate(name: string) {
    saveMobilityTemplate(name, slot.mobilityExercises ?? [])
  }

  return (
    <div className="bg-slate-700/50 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Type picker button */}
        <button
          type="button"
          onClick={() => setShowTypePicker(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium ${meta.bgColor} flex-shrink-0`}
        >
          {<meta.icon size={12} />}
          {meta.label}
          <ChevronDown size={11} />
        </button>

        {/* Name */}
        <input
          type="text"
          value={slot.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Workout name"
          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-0"
        />

        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse workout' : 'Expand workout'}
          aria-expanded={expanded}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 active:bg-sky-500/30 transition-colors"
        >
          <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Type-specific fields */}
          {isRun && (
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Distance (mi)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={slot.targetDistance ?? ''}
                  onChange={e => set('targetDistance', parseFloat(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Pace (min/mi)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={slot.targetPace ?? ''}
                  onChange={e => set('targetPace', parseFloat(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Time (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetTime ?? ''}
                  onChange={e => set('targetTime', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
            </div>
          )}

          {isWeights && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Target time (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetTime ?? ''}
                  onChange={e => set('targetTime', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Location</span>
                <select
                  value={slot.location ?? ''}
                  onChange={e => set('location', e.target.value || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  <option value="home">Home</option>
                  <option value="gym">Gym</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Weights Focus Area</span>
                <select
                  value={slot.weightsFocusArea ?? ''}
                  onChange={e => set('weightsFocusArea', (e.target.value || undefined) as WeightsFocusArea | undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  {WEIGHTS_FOCUS_AREAS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Weights Training Intent</span>
                <select
                  value={slot.weightsIntent ?? ''}
                  onChange={e => set('weightsIntent', (e.target.value || undefined) as WeightsTrainingIntent | undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  {WEIGHTS_INTENTS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' / ')}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={slot.isDeload ?? false}
                  onChange={e => set('isDeload', e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span className="text-sm text-slate-300">Deload week</span>
              </label>
            </div>
          )}

          {(slot.type === 'swim' || slot.type === 'yoga' || isOther) && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Duration (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetDuration ?? ''}
                  onChange={e => set('targetDuration', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              {slot.type === 'swim' && (
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Distance (mi)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={slot.targetDistance ?? ''}
                    onChange={e => set('targetDistance', parseFloat(e.target.value) || undefined)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              )}
              {slot.type === 'swim' && (
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Swim Subtype</span>
                  <select
                    value={slot.subtype ?? ''}
                    onChange={e => set('subtype', e.target.value || undefined)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Select</option>
                    {SWIM_SUBTYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              )}
              {slot.type === 'yoga' && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-400">Yoga Subtype</span>
                    <select
                      value={slot.subtype ?? ''}
                      onChange={e => set('subtype', e.target.value || undefined)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select</option>
                      {YOGA_SUBTYPES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-400">Location</span>
                    <select
                      value={slot.location ?? ''}
                      onChange={e => set('location', e.target.value || undefined)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select</option>
                      <option value="self_directed">Self Directed</option>
                      <option value="class">Class</option>
                    </select>
                  </label>
                </>
              )}
              {isOther && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-400">Other Subtype</span>
                    <select
                      value={slot.subtype ?? ''}
                      onChange={e => set('subtype', e.target.value || undefined)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select</option>
                      {OTHER_SUBTYPES.map(v => <option key={v} value={v}>{v.replace('_', ' / ')}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-400">Location</span>
                    <select
                      value={slot.location ?? ''}
                      onChange={e => set('location', e.target.value || undefined)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select</option>
                      <option value="home">Home</option>
                      <option value="gym">Gym</option>
                      <option value="indoor">Indoor</option>
                      <option value="outdoor">Outdoor</option>
                    </select>
                  </label>
                </>
              )}
            </div>
          )}

          {/* ── Run config (progression) ────────────────────────────────── */}
          {isRun && (
            <div className="space-y-2 border border-slate-600/50 rounded-lg p-2.5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Run Config</p>

              {/* Subtype */}
              <label className="space-y-1 block">
                <span className="text-xs text-slate-400">Subtype</span>
                <select
                  value={(slot.subtype as RunWorkoutSubtype | undefined) ?? slot.runConfig?.subtype ?? defaultRunSubtype(slot.type)}
                  onChange={e => { set('subtype', e.target.value); setRunConfig({ subtype: e.target.value as RunWorkoutSubtype }) }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {SUBTYPES.map(st => (
                    <option key={st} value={st}>{RUN_SUBTYPE_LABELS[st]}</option>
                  ))}
                </select>
              </label>

              {/* Structure text */}
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Structure / intervals description</span>
                <input
                  type="text"
                  value={slot.runConfig?.targetStructureText ?? ''}
                  onChange={e => setRunConfig({ targetStructureText: e.target.value || null })}
                  placeholder="e.g. 3×1 mi @ tempo pace"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>

              {/* Progression enabled */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slot.adaptiveProgressionEnabled ?? slot.runConfig?.progressionEligible ?? false}
                  onChange={e => { set('adaptiveProgressionEnabled', e.target.checked); setRunConfig({ progressionEligible: e.target.checked }) }}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span className="text-sm text-slate-300">Enable adaptive progression</span>
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-slate-400">Location</span>
                <select
                  value={slot.location ?? ''}
                  onChange={e => set('location', e.target.value || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </label>

              {slot.runConfig?.progressionEligible && (
                <div className="space-y-2 pl-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-400">Progression group ID</span>
                    <input
                      type="text"
                      value={slot.runConfig?.progressionGroupId ?? ''}
                      onChange={e => setRunConfig({ progressionGroupId: e.target.value || null })}
                      placeholder="e.g. long-run or easy-run"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Step size (mi, default 0.5)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={slot.runConfig?.defaultStepMiles ?? 0.5}
                      onChange={e => setRunConfig({ defaultStepMiles: parseFloat(e.target.value) || 0.5 })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── Difficulty ──────────────────────────────────────────────── */}
          {slot.type !== 'rest' && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => {
                  const active = slot.difficulty === d
                  const colors: Record<WorkoutDifficulty, string> = {
                    easy: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
                    moderate: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
                    hard: 'bg-red-500/20 border-red-500/50 text-red-400',
                  }
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('difficulty', active ? undefined : d)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        active ? colors[d] : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {slot.type === 'mobility' && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">Mobility exercises</p>
              <MobilityRoutineEditor
                exercises={slot.mobilityExercises ?? []}
                onReorder={reorderMobilityExercise}
                onAddFromLibrary={addMobilityExerciseFromLibrary}
                onAddCustom={addCustomMobilityExercise}
                templates={mobilityTemplates}
                onLoadTemplate={loadMobilityTemplate}
                onSaveAsTemplate={saveMobilityAsTemplate}
                {...mobilityCallbacks}
              />
            </div>
          )}

          {isWeights && (
            <button
              type="button"
              onClick={() => setShowAddExercise(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-600 hover:border-sky-500/50 text-slate-400 hover:text-sky-300 text-xs font-medium transition-colors"
            >
              <Plus size={13} /> Add Exercise
            </button>
          )}

          {showAddExercise && (
            <AddExerciseModal
              onAdd={addExercises}
              onClose={() => setShowAddExercise(false)}
            />
          )}

          {slot.exercises && slot.exercises.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">Exercises</p>
              {slot.exercises.map((ex, i) => (
                <div
                  key={`${ex.exercise}-${i}`}
                  data-reorder-index={i}
                  className={`relative rounded-lg border bg-slate-800/60 p-2 space-y-2 transition-all ${dragExerciseIdx === i ? 'border-sky-500/50 opacity-60 scale-[0.99]' : 'border-slate-600'}`}
                >
                  {dragExerciseIdx !== null && dropExerciseIdx === i && dropExerciseIdx !== dragExerciseIdx && (
                    <div aria-hidden="true" className={`pointer-events-none absolute left-2 right-2 z-10 h-1 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] ${dropExerciseIdx < dragExerciseIdx ? '-top-[3px]' : '-bottom-[3px]'}`}>
                      <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-sky-400" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Drag to reorder ${ex.exercise}`}
                      className="flex min-h-8 min-w-7 touch-none select-none items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/70"
                      onPointerDown={event => startExerciseDrag(i, event)}
                      onPointerMove={moveExerciseDrag}
                      onPointerUp={endExerciseDrag}
                      onPointerCancel={endExerciseDrag}
                    >
                      <GripVertical size={14} className="cursor-grab text-slate-500 active:cursor-grabbing" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={ex.exercise}
                        onChange={e => updateExercise(i, { exercise: e.target.value })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-200"
                      />
                      {(ex.type?.length || ex.target?.length || ex.synergist?.length) && (
                        <span className="text-[10px] text-slate-400 block truncate mt-1">
                          T: {(ex.type ?? []).join(', ')} · Target: {(ex.target ?? []).join(', ')} · Syn: {(ex.synergist ?? []).join(', ')}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => moveExercise(i, i - 1)} disabled={i === 0} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronUp size={12} /></button>
                    <button type="button" onClick={() => moveExercise(i, i + 1)} disabled={i === (slot.exercises?.length ?? 0) - 1} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronDown size={12} /></button>
                    <button type="button" onClick={() => removeExercise(i)} className="p-0.5 text-red-400/80 hover:text-red-300"><Trash2 size={12} /></button>
                  </div>

                  {Array.isArray(ex.sets) ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sets (per-set reps &amp; weight)</p>
                        <button
                          type="button"
                          onClick={() => updateExercise(i, { sets: (ex.sets as SetSpec[]).length })}
                          className="text-[10px] text-sky-400 hover:text-sky-300"
                        >
                          Same for all sets
                        </button>
                      </div>
                      {ex.sets.map((setSpec, si) => (
                        <div key={si} className="grid grid-cols-[2rem_1fr_1fr_1fr_1.5rem] items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">#{si + 1}</span>
                          <input
                            type="text"
                            aria-label={`Set ${si + 1} reps`}
                            value={setSpec.reps ?? ''}
                            placeholder={ex.reps != null ? String(ex.reps) : 'reps'}
                            onChange={e => updateSetSpec(i, si, { reps: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                          <input
                            type="text"
                            aria-label={`Set ${si + 1} load`}
                            value={setSpec.load ?? ''}
                            placeholder={ex.load ?? 'load'}
                            onChange={e => updateSetSpec(i, si, { load: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                          <input
                            type="text"
                            aria-label={`Set ${si + 1} rest`}
                            value={setSpec.rest ?? ''}
                            placeholder={ex.rest ?? 'rest'}
                            onChange={e => updateSetSpec(i, si, { rest: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            aria-label={`Remove set ${si + 1}`}
                            disabled={(ex.sets as SetSpec[]).length <= 1}
                            onClick={() => updateExercise(i, { sets: (ex.sets as SetSpec[]).filter((_, k) => k !== si) })}
                            className="p-0.5 text-red-400/80 hover:text-red-300 disabled:opacity-30"
                          ><Trash2 size={12} /></button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const last = (ex.sets as SetSpec[])[(ex.sets as SetSpec[]).length - 1]
                            updateExercise(i, { sets: [...(ex.sets as SetSpec[]), { ...last }] })
                          }}
                          className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                        ><Plus size={11} /> Add set</button>
                        <span className="text-[10px] text-slate-500">Blank fields use the exercise defaults</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[10px] text-slate-400">Default reps</span>
                          <input
                            type="text"
                            value={ex.reps ?? ''}
                            placeholder="8-12"
                            onChange={e => updateExercise(i, { reps: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] text-slate-400">Default load</span>
                          <input
                            type="text"
                            value={ex.load ?? ''}
                            placeholder="135lb"
                            onChange={e => updateExercise(i, { load: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-400">Sets</span>
                      <input
                        type="number"
                        min="1"
                        value={typeof ex.sets === 'number' ? ex.sets : ''}
                        placeholder="3"
                        onChange={e => updateExercise(i, { sets: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-400">Reps</span>
                      <input
                        type="text"
                        value={ex.reps ?? ''}
                        placeholder="8-12"
                        onChange={e => updateExercise(i, { reps: e.target.value || undefined })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-400">Load</span>
                      <input
                        type="text"
                        value={ex.load ?? ''}
                        placeholder="135lb"
                        onChange={e => updateExercise(i, { load: e.target.value || undefined })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-400">Rest</span>
                      <input
                        type="text"
                        value={ex.rest ?? ''}
                        placeholder="90s"
                        onChange={e => updateExercise(i, { rest: e.target.value || undefined })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </label>
                  </div>
                      <button
                        type="button"
                        onClick={() => {
                          const n = typeof ex.sets === 'number' && ex.sets > 0 ? ex.sets : 3
                          updateExercise(i, { sets: Array.from({ length: n }, () => ({})) })
                        }}
                        className="text-[10px] text-sky-400 hover:text-sky-300"
                      >
                        Vary reps / weight per set
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Progression</p>
                    </div>

                    {/* Superset group */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500">Superset group (optional)</label>
                      <input
                        type="text"
                        value={ex.supersetGroupId ?? ''}
                        onChange={e => updateExercise(i, { supersetGroupId: e.target.value.trim() || undefined })}
                        placeholder="e.g. A  — same label pairs exercises"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    {/* Progression type selector */}
                    <div className="space-y-1">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] text-slate-500">Type</label>
                          <select
                            value={ex.progressionType ?? ''}
                            onChange={e => {
                              const val = (e.target.value || undefined) as ProgressionType | undefined
                              updateExercise(i, { progressionType: val })
                            }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                          >
                            <option value="">— none —</option>
                            {PROGRESSION_TYPE_META.map(pt => (
                              <option key={pt.type} value={pt.type}>{pt.label}</option>
                            ))}
                          </select>
                        </div>
                        {PROGRESSION_TYPE_META.find(pt => pt.type === ex.progressionType)?.template && (
                          <button
                            type="button"
                            title="Fill if/then/else fields with a template for this progression type"
                            onClick={() => {
                              const meta = PROGRESSION_TYPE_META.find(pt => pt.type === ex.progressionType)
                              if (!meta?.template) return
                              const varName = toVarName(ex.exercise)
                              const tpl = meta.template(varName)
                              updateExercise(i, { progress: { if: tpl.if, then: tpl.then, else: tpl.else } })
                            }}
                            className="px-2 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-600/50 text-sky-400 text-[10px] font-medium whitespace-nowrap transition-colors"
                          >
                            Apply template
                          </button>
                        )}
                      </div>
                      {ex.progressionType && (
                        <p className="text-[10px] text-slate-500 italic">
                          {PROGRESSION_TYPE_META.find(pt => pt.type === ex.progressionType)?.description}
                        </p>
                      )}
                    </div>

                    {ex.progressionType === 'rep_ladder' ? (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-400">Current max reps</span>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              value={ex.ladderMax ?? ''}
                              placeholder="e.g. 5"
                              onChange={e => {
                                const n = parseInt(e.target.value, 10)
                                updateExercise(i, { ladderMax: Number.isFinite(n) && n >= 1 ? n : undefined })
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] text-slate-400">Sessions per cycle</span>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              value={ex.ladderSessions ?? ''}
                              placeholder={String(DEFAULT_LADDER_SESSIONS)}
                              onChange={e => {
                                const n = parseInt(e.target.value, 10)
                                updateExercise(i, { ladderSessions: Number.isFinite(n) && n >= 1 ? n : undefined })
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {ex.ladderMax
                            ? `Session 1: ${ladderReps(ex.ladderMax, 0).join('-')} · Session 2: ${ladderReps(ex.ladderMax, 1).join('-')} … Sets and reps above are ignored. Entering a new max starts a new cycle.`
                            : 'Enter your current max to start the ladder.'}
                        </p>
                      </div>
                    ) : ex.progressionType === 'rep_sets' ? (
                      <div className="space-y-1.5">
                        <label className="space-y-1 block">
                          <span className="text-[10px] text-slate-400">Steps (optional)</span>
                          <input
                            type="text"
                            value={ex.repScheme ?? ''}
                            placeholder={defaultRepScheme(ex).map(formatStep).join(', ')}
                            onChange={e => updateExercise(i, { repScheme: e.target.value || undefined })}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          />
                        </label>
                        <p className={`text-[10px] ${ex.repScheme && !parseRepScheme(ex.repScheme) ? 'text-amber-400' : 'text-slate-500'}`}>
                          {ex.repScheme && !parseRepScheme(ex.repScheme)
                            ? 'Couldn’t read that — use steps like 3x8, 10/10/8 or 444, separated by commas. Using the default for now.'
                            : `${repSchemeSteps(ex).map(formatStep).join(' → ')}. One step per session where every set hits its reps; a miss repeats it. Leave blank to use the rep range above at this set count, then one more set. Editing the steps starts over.`}
                        </p>
                      </div>
                    ) : (
                    /* if / then / else rule fields */
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={ex.progress?.if ?? ''}
                        placeholder="if (optional) e.g. all_reps"
                        onChange={e => updateExercise(i, { progress: { ...ex.progress, if: e.target.value || undefined, then: ex.progress?.then ?? '' } })}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={ex.progress?.then ?? ''}
                        placeholder="then (required) e.g. squat += 5"
                        onChange={e => {
                          const value = e.target.value
                          if (!value && !ex.progress?.if && !ex.progress?.else) {
                            updateExercise(i, { progress: undefined })
                            return
                          }
                          updateExercise(i, { progress: { ...ex.progress, then: value } })
                        }}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={ex.progress?.else ?? ''}
                        placeholder="else (optional)"
                        onChange={e => {
                          const elseVal = e.target.value || undefined
                          if (!elseVal && !ex.progress?.if && !ex.progress?.then) {
                            updateExercise(i, { progress: undefined })
                            return
                          }
                          updateExercise(i, { progress: { ...ex.progress, else: elseVal, then: ex.progress?.then ?? '' } })
                        }}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {slot.type !== 'rest' && (
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Notes</span>
              <textarea
                rows={2}
                value={slot.notes ?? ''}
                onChange={e => set('notes', e.target.value || undefined)}
                placeholder="Coach notes, details..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
              />
            </label>
          )}

          {/* Delete lives inside the expanded body so it can't be hit when reaching for the toggle */}
          {canRemove && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
              >
                <Trash2 size={13} /> Remove workout
              </button>
            </div>
          )}
        </div>
      )}

      {/* Type picker modal */}
      {showTypePicker && (
        <Modal title="Choose workout type" onClose={() => setShowTypePicker(false)}>
          <div className="space-y-1.5">
            {WORKOUT_TYPES.map(wt => {
              const m = WORKOUT_META[wt]
              return (
                <button
                  key={wt}
                  onClick={() => { onChange({ ...slot, type: wt, name: m.label }); setShowTypePicker(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    slot.type === wt ? 'bg-slate-600' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg ${m.bgColor} flex items-center justify-center`}>
                    <m.icon size={16} className="text-white" />
                  </span>
                  <span className="text-sm font-medium text-white">{m.label}</span>
                  {slot.type === wt && <Check size={16} className="text-sky-400 ml-auto" />}
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
