import { useState, useMemo } from 'react'
import { Check, X } from 'lucide-react'
import { Modal } from '../shared/Modal'
import type { ExerciseSpec } from '../../types/program'
import { EXERCISE_LIBRARY, exerciseEquipment, exercisePrimaryMuscle } from '../../lib/exerciseLibrary'

// ── Add exercise modal ──────────────────────────────────────────────────────
// Lets the user browse the exercise library (sortable, searchable) and
// multi-select several exercises to add at once, plus free-typed custom names.

type ExerciseSortMode = 'alphabetical' | 'muscle' | 'equipment'

const SORT_MODE_OPTIONS: { mode: ExerciseSortMode; label: string }[] = [
  { mode: 'alphabetical', label: 'A–Z' },
  { mode: 'muscle', label: 'Muscle group' },
  { mode: 'equipment', label: 'Equipment' },
]

export function AddExerciseModal({
  onAdd,
  onClose,
}: {
  onAdd: (specs: ExerciseSpec[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<ExerciseSortMode>('alphabetical')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customNames, setCustomNames] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? EXERCISE_LIBRARY.filter(ex =>
          ex.name.toLowerCase().includes(q) ||
          ex.target.some(t => t.toLowerCase().includes(q)) ||
          exerciseEquipment(ex.name).toLowerCase().includes(q),
        )
      : EXERCISE_LIBRARY
    const sorted = [...base]
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortMode === 'muscle') {
      sorted.sort((a, b) => exercisePrimaryMuscle(a).localeCompare(exercisePrimaryMuscle(b)) || a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => exerciseEquipment(a.name).localeCompare(exerciseEquipment(b.name)) || a.name.localeCompare(b.name))
    }
    return sorted
  }, [query, sortMode])

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function addCustom() {
    const name = customInput.trim()
    if (!name || customNames.includes(name)) return
    setCustomNames(prev => [...prev, name])
    setCustomInput('')
  }

  const totalSelected = selected.size + customNames.length

  function handleConfirm() {
    const specs: ExerciseSpec[] = EXERCISE_LIBRARY
      .filter(ex => selected.has(ex.name))
      .map(ex => ({ exercise: ex.name, sets: 3, reps: '8-12', type: ex.type, target: ex.target, synergist: ex.synergist }))
    for (const name of customNames) {
      specs.push({ exercise: name, sets: 3, reps: '8-12' })
    }
    onAdd(specs)
  }

  return (
    <Modal
      title="Add Exercise"
      onClose={onClose}
      footer={
        <button
          onClick={handleConfirm}
          disabled={totalSelected === 0}
          className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-xl font-semibold transition-colors"
        >
          {totalSelected > 0 ? `Add ${totalSelected} Exercise${totalSelected === 1 ? '' : 's'}` : 'Add Exercises'}
        </button>
      }
    >
      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, muscle, or equipment"
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />

        {/* Sort control */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500">Sort:</span>
          {SORT_MODE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                sortMode === mode
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom exercise entry */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            placeholder="Custom exercise name"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customInput.trim()}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>

        {/* Selected custom-name chips */}
        {customNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customNames.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setCustomNames(prev => prev.filter(n => n !== name))}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs"
              >
                {name} <X size={11} />
              </button>
            ))}
          </div>
        )}

        {/* Exercise list */}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {filtered.map(ex => {
            const isSelected = selected.has(ex.name)
            return (
              <button
                key={ex.name}
                type="button"
                onClick={() => toggle(ex.name)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                  isSelected ? 'bg-sky-500/10 border-sky-500/40' : 'bg-slate-700/40 border-transparent hover:bg-slate-700'
                }`}
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-500'}`}>
                  {isSelected && <Check size={11} className="text-white" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">{ex.name}</span>
                  <span className="block text-[10px] text-slate-500 truncate">
                    {ex.target.join(', ')} · {exerciseEquipment(ex.name)}
                  </span>
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">No exercises match "{query}".</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
