import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Timer, Hash, Info, Check, BookmarkPlus, GripVertical } from 'lucide-react'
import {
  MOBILITY_LIBRARY,
  CATEGORY_LABELS,
  normalizeMobilityRoutine,
  singleTimedSet,
  summarizeMobilitySets,
  totalTimedSec,
  formatMobilityDuration,
  type MobilityCategory,
  type MobilityRoutineExercise,
  type MobilitySet,
  type MobilityUserTemplate,
} from '../../lib/mobilityLibrary'

export interface MobilityRoutineCallbacks {
  onUpdateExercise: (id: string, patch: Partial<Pick<MobilityRoutineExercise, 'name' | 'restSec' | 'notes'>>) => void
  onAddSet: (exerciseId: string, set?: MobilitySet) => void
  onUpdateSet: (exerciseId: string, setIdx: number, patch: MobilitySet) => void
  onRemoveSet: (exerciseId: string, setIdx: number) => void
  onRemoveExercise: (id: string) => void
}

// ── Per-exercise row: collapsed summary, expands into a per-set editor ──────

interface RowProps extends MobilityRoutineCallbacks {
  exercise: MobilityRoutineExercise
  draggable?: boolean
  dragIndex?: number
  onDragStart?: () => void
  onDragOver?: (targetIdx: number) => void
  onDragEnd?: () => void
  dragActive?: boolean
  dragHandle?: React.ReactNode
}

function MobilityDoseInput({ value, min, max, onCommit }: {
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => setDraft(String(value)), [value])

  function commit() {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = Math.min(max, Math.max(min, parsed))
    setDraft(String(next))
    onCommit(next)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
      className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
    />
  )
}

export function MobilityExerciseRow({
  exercise: exRaw,
  onUpdateExercise,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemoveExercise,
  draggable,
  dragIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragActive,
  dragHandle,
}: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const ex = normalizeMobilityRoutine([exRaw])[0]

  function setMode(setIdx: number, mode: 'timed' | 'reps') {
    if (mode === 'timed') onUpdateSet(ex.id, setIdx, { durationSec: ex.sets[setIdx].durationSec ?? 30 })
    else onUpdateSet(ex.id, setIdx, { reps: ex.sets[setIdx].reps ?? 10 })
  }

  return (
    <div
      data-mobility-row-index={dragIndex}
      className={`rounded-xl border bg-slate-800/80 transition-colors ${
        dragActive ? 'border-sky-500/50 opacity-60' : 'border-slate-700/60'
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-3">
        {draggable && (
          <span
            role="button"
            aria-label={`Reorder ${ex.name}`}
            className="touch-none select-none"
            onPointerDown={event => {
              if (!event.isPrimary || event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              onDragStart?.()
            }}
            onPointerMove={event => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              const row = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>('[data-mobility-row-index]')
              const targetIdx = Number(row?.dataset.mobilityRowIndex)
              if (Number.isInteger(targetIdx)) onDragOver?.(targetIdx)
            }}
            onPointerUp={event => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onDragEnd?.()
            }}
            onPointerCancel={onDragEnd}
          >
            {dragHandle ?? <GripVertical size={16} className="text-slate-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />}
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium text-slate-200 truncate">{ex.name}</p>
          <p className="text-xs text-slate-500">{summarizeMobilitySets(ex.sets)}</p>
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Edit sets'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={() => onRemoveExercise(ex.id)}
          className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          aria-label="Remove exercise"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40 pt-3">
          {ex.sets.map((s, i) => {
            const mode: 'timed' | 'reps' = s.reps != null ? 'reps' : 'timed'
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 w-10 flex-shrink-0">Set {i + 1}</span>
                <div className="flex rounded-lg border border-slate-600 overflow-hidden flex-shrink-0">
                  <button
                    onClick={() => setMode(i, 'timed')}
                    className={`px-2 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      mode === 'timed' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Timer size={11} /> Timed
                  </button>
                  <button
                    onClick={() => setMode(i, 'reps')}
                    className={`px-2 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      mode === 'reps' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Hash size={11} /> Reps
                  </button>
                </div>
                <MobilityDoseInput
                  value={mode === 'timed' ? s.durationSec ?? 30 : s.reps ?? 10}
                  min={mode === 'timed' ? 5 : 1}
                  max={mode === 'timed' ? 1800 : 200}
                  onCommit={n => onUpdateSet(ex.id, i, mode === 'timed' ? { durationSec: n } : { reps: n })}
                />
                <span className="text-[11px] text-slate-500 flex-shrink-0">{mode === 'timed' ? 'sec' : 'reps'}</span>
                <button
                  onClick={() => onRemoveSet(ex.id, i)}
                  disabled={ex.sets.length <= 1}
                  className="ml-auto p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 disabled:hover:text-slate-600 disabled:hover:bg-transparent transition-colors"
                  aria-label="Remove set"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}

          <button
            onClick={() => onAddSet(ex.id)}
            className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
          >
            <Plus size={12} /> Add set
          </button>

          {ex.sets.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <label className="text-[11px] text-slate-500 flex-shrink-0">Rest between sets (sec)</label>
              <input
                type="number"
                min={0}
                max={600}
                value={ex.restSec ?? ''}
                placeholder="0"
                onChange={e => {
                  const n = parseInt(e.target.value)
                  onUpdateExercise(ex.id, { restSec: Number.isFinite(n) ? n : undefined })
                }}
                className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Full self-contained editor: list + add-from-library + add-custom ────────

interface EditorProps extends MobilityRoutineCallbacks {
  exercises: MobilityRoutineExercise[]
  onReorder: (fromIdx: number, toIdx: number) => void
  onAddFromLibrary: (libraryId: string) => void
  onAddCustom: (name: string, sets: MobilitySet[]) => void
  /** Saved routine templates available to load. Omit to hide the Templates section entirely. */
  templates?: MobilityUserTemplate[]
  onLoadTemplate?: (id: string, mode: 'replace' | 'append') => void
  onSaveAsTemplate?: (name: string) => void
}

const LIBRARY_CATEGORIES: Array<MobilityCategory | 'all'> = [
  'all', 'scapula-shoulder', 'ankle-achilles', 'foot-arch', 'posture', 'general',
]

export function MobilityRoutineEditor({
  exercises,
  onReorder,
  onAddFromLibrary,
  onAddCustom,
  templates,
  onLoadTemplate,
  onSaveAsTemplate,
  ...callbacks
}: EditorProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const dragIdxRef = useRef<number | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [activeCategory, setActiveCategory] = useState<MobilityCategory | 'all'>('all')
  const [expandedLibId, setExpandedLibId] = useState<string | null>(null)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDuration, setCustomDuration] = useState('30')
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const inRoutineIds = new Set(exercises.map(e => e.id))
  const filtered = activeCategory === 'all'
    ? MOBILITY_LIBRARY
    : MOBILITY_LIBRARY.filter(e => e.categories.includes(activeCategory))

  function handleAddCustom() {
    const name = customName.trim()
    const sec = parseInt(customDuration)
    if (!name || !Number.isFinite(sec) || sec <= 0) return
    onAddCustom(name, singleTimedSet(sec))
    setCustomName('')
    setCustomDuration('30')
    setAddingCustom(false)
  }

  function handleSaveTemplate() {
    const name = templateName.trim()
    if (!name || !onSaveAsTemplate) return
    onSaveAsTemplate(name)
    setTemplateName('')
    setSavingTemplate(false)
  }

  function startDrag(idx: number) {
    dragIdxRef.current = idx
    setDragIdx(idx)
  }

  function moveDrag(targetIdx: number) {
    const currentIdx = dragIdxRef.current
    if (currentIdx === null || currentIdx === targetIdx) return
    onReorder(currentIdx, targetIdx)
    dragIdxRef.current = targetIdx
    setDragIdx(targetIdx)
  }

  function endDrag() {
    dragIdxRef.current = null
    setDragIdx(null)
  }

  return (
    <div className="space-y-2">
      {exercises.length === 0 && (
        <p className="text-xs text-slate-500 py-2">No exercises yet — add from the library or create a custom one.</p>
      )}

      {exercises.map((ex, idx) => (
        <MobilityExerciseRow
          key={ex.id}
          exercise={ex}
          draggable
          dragIndex={idx}
          onDragStart={() => startDrag(idx)}
          onDragOver={moveDrag}
          onDragEnd={endDrag}
          dragActive={dragIdx === idx}
          {...callbacks}
        />
      ))}

      {/* Add from library */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <button
          onClick={() => setShowLibrary(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
        >
          Add from library
          {showLibrary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showLibrary && (
          <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40 pt-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {LIBRARY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {filtered.map(ex => {
                const inRoutine = inRoutineIds.has(ex.id)
                const libExpanded = expandedLibId === ex.id
                return (
                  <div
                    key={ex.id}
                    className={`rounded-lg border transition-colors ${
                      inRoutine ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${inRoutine ? 'text-emerald-300' : 'text-slate-200'}`}>
                          {ex.name}
                        </p>
                        <span className="text-[11px] text-slate-500">{summarizeMobilitySets(singleTimedSet(ex.durationSec))}</span>
                      </div>
                      <button
                        onClick={() => setExpandedLibId(libExpanded ? null : ex.id)}
                        className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                        aria-label="Details"
                      >
                        <Info size={12} />
                      </button>
                      <button
                        onClick={() => !inRoutine && onAddFromLibrary(ex.id)}
                        disabled={inRoutine}
                        className={`p-1 rounded transition-colors ${
                          inRoutine ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        aria-label={inRoutine ? 'Already in routine' : 'Add to routine'}
                      >
                        {inRoutine ? <Check size={13} /> : <Plus size={13} />}
                      </button>
                    </div>
                    {libExpanded && (
                      <p className="px-2.5 pb-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-700/40 pt-1.5">
                        {ex.description}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Templates — load a saved routine, or save the current one for reuse */}
      {(onLoadTemplate || onSaveAsTemplate) && (
        <div className="rounded-xl border border-slate-700/60 overflow-hidden">
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
          >
            Templates
            {showTemplates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTemplates && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-700/40 pt-2.5">
              {onSaveAsTemplate && (
                savingTemplate ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Template name"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate() }}
                      autoFocus
                      className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setSavingTemplate(false); setTemplateName('') }}
                      className="px-2 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 text-xs transition-colors flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSavingTemplate(true)}
                    disabled={exercises.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 text-xs font-medium transition-colors"
                  >
                    <BookmarkPlus size={13} />
                    Save current as template
                  </button>
                )
              )}

              {onLoadTemplate && (
                <div className="space-y-1.5">
                  {(templates ?? []).length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-1">
                      No saved templates yet — save your current routine above to reuse it later.
                    </p>
                  ) : (
                    (templates ?? []).map(t => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{t.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · ~
                            {formatMobilityDuration(t.exercises.reduce((sum, e) => sum + totalTimedSec(e.sets), 0))}
                          </p>
                        </div>
                        <button
                          onClick={() => onLoadTemplate(t.id, 'append')}
                          className="flex-shrink-0 px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:border-sky-500 hover:text-sky-300 text-[11px] font-medium transition-colors"
                        >
                          Append
                        </button>
                        <button
                          onClick={() => onLoadTemplate(t.id, 'replace')}
                          className="flex-shrink-0 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[11px] font-medium transition-colors"
                        >
                          Replace
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add custom */}
      {addingCustom ? (
        <div className="rounded-xl border border-sky-500/40 bg-slate-800/80 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New exercise</p>
          <input
            type="text"
            placeholder="Exercise name"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustom() }}
            autoFocus
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 flex-shrink-0">Duration (sec)</label>
            <input
              type="number"
              min="5"
              max="1800"
              value={customDuration}
              onChange={e => setCustomDuration(e.target.value)}
              className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAddingCustom(false)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCustom(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm transition-colors"
        >
          <Plus size={16} />
          Add custom exercise
        </button>
      )}
    </div>
  )
}
