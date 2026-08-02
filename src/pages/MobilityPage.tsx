import { useRef, useState } from 'react'
import { ArrowLeft, Plus, GripVertical, BookOpen, Layers, Info, Check, BookmarkPlus, Trash2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMobilityStore } from '../store/mobilityStore'
import { MobilityExerciseRow } from '../components/mobility/MobilityRoutineEditor'
import {
  MOBILITY_LIBRARY,
  MOBILITY_PRESETS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  formatMobilityDuration,
  singleTimedSet,
  totalTimedSec,
  type MobilityCategory,
  type MobilityLibraryExercise,
} from '../lib/mobilityLibrary'

type Tab = 'routine' | 'library' | 'presets'

const fmt = formatMobilityDuration

// ── My Routine tab ────────────────────────────────────────────────────────────

function RoutineTab() {
  const routine = useMobilityStore(s => s.routine)
  const addExercise = useMobilityStore(s => s.addExercise)
  const removeExercise = useMobilityStore(s => s.removeExercise)
  const reorderExercise = useMobilityStore(s => s.reorderExercise)
  const updateExercise = useMobilityStore(s => s.updateExercise)
  const addSet = useMobilityStore(s => s.addSet)
  const updateSet = useMobilityStore(s => s.updateSet)
  const removeSet = useMobilityStore(s => s.removeSet)
  const saveAsTemplate = useMobilityStore(s => s.saveAsTemplate)

  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState('60')
  const [adding, setAdding] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const dragIdxRef = useRef<number | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savedTemplateName, setSavedTemplateName] = useState('')

  function handleSaveTemplate() {
    const name = templateName.trim()
    if (!name) return
    saveAsTemplate(name, routine)
    setSavedTemplateName(name)
    setTemplateName('')
    setSavingTemplate(false)
  }

  function handleAdd() {
    const name = newName.trim()
    const sec = parseInt(newDuration)
    if (!name || !Number.isFinite(sec) || sec <= 0) return
    addExercise(name, singleTimedSet(sec))
    setNewName('')
    setNewDuration('60')
    setAdding(false)
  }

  function startDrag(idx: number) {
    dragIdxRef.current = idx
    setDragIdx(idx)
  }

  function moveDrag(targetIdx: number) {
    const currentIdx = dragIdxRef.current
    if (currentIdx === null || currentIdx === targetIdx) return
    reorderExercise(currentIdx, targetIdx)
    dragIdxRef.current = targetIdx
    setDragIdx(targetIdx)
  }

  function endDrag() {
    dragIdxRef.current = null
    setDragIdx(null)
  }

  const totalSec = routine.reduce((sum, e) => sum + totalTimedSec(e.sets), 0)

  return (
    <div className="space-y-2">
      {routine.length === 0 && !adding && (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm mb-1">No exercises yet.</p>
          <p className="text-slate-600 text-xs">Add from the Library tab or create your own below.</p>
        </div>
      )}

      {routine.length > 0 && (
        <div className="flex items-center justify-between gap-2 pb-1">
          <p className="text-xs text-slate-500">
            {routine.length} exercise{routine.length === 1 ? '' : 's'} · ~{fmt(totalSec)}
          </p>
          {!savingTemplate && (
            <button
              onClick={() => setSavingTemplate(true)}
              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors flex-shrink-0"
            >
              <BookmarkPlus size={12} /> Save as template
            </button>
          )}
        </div>
      )}

      {savingTemplate && (
        <div className="flex items-center gap-2 pb-1">
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
      )}

      {savedTemplateName && !savingTemplate && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
          <span className="flex items-center gap-1.5"><Check size={13} /> “{savedTemplateName}” saved to Presets.</span>
          <button onClick={() => setSavedTemplateName('')} className="text-emerald-300/60 hover:text-emerald-200" aria-label="Dismiss confirmation">×</button>
        </div>
      )}

      {routine.map((ex, idx) => (
        <MobilityExerciseRow
          key={ex.id}
          exercise={ex}
          draggable
          dragIndex={idx}
          dragHandle={<GripVertical size={16} className="text-slate-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />}
          onDragStart={() => startDrag(idx)}
          onDragOver={moveDrag}
          onDragEnd={endDrag}
          dragActive={dragIdx === idx}
          onUpdateExercise={updateExercise}
          onAddSet={addSet}
          onUpdateSet={updateSet}
          onRemoveSet={removeSet}
          onRemoveExercise={removeExercise}
        />
      ))}

      {adding ? (
        <div className="rounded-xl border border-sky-500/40 bg-slate-800/80 p-4 space-y-3 mt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New exercise</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Exercise name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 flex-shrink-0">Duration (sec)</label>
              <input
                type="number"
                min="5"
                max="600"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm transition-colors mt-1"
        >
          <Plus size={16} />
          Add custom exercise
        </button>
      )}
    </div>
  )
}

// ── Library tab ───────────────────────────────────────────────────────────────

function LibraryTab() {
  const routine = useMobilityStore(s => s.routine)
  const addExerciseFromLibrary = useMobilityStore(s => s.addExerciseFromLibrary)
  const removeExercise = useMobilityStore(s => s.removeExercise)

  const [activeCategory, setActiveCategory] = useState<MobilityCategory | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories: Array<MobilityCategory | 'all'> = [
    'all',
    'scapula-shoulder',
    'ankle-achilles',
    'foot-arch',
    'posture',
    'general',
  ]

  const filtered = activeCategory === 'all'
    ? MOBILITY_LIBRARY
    : MOBILITY_LIBRARY.filter(e => e.categories.includes(activeCategory as MobilityCategory))

  const inRoutineIds = new Set(routine.map(e => e.id))

  function toggleExercise(ex: MobilityLibraryExercise) {
    if (inRoutineIds.has(ex.id)) {
      removeExercise(ex.id)
    } else {
      addExerciseFromLibrary(ex.id)
    }
  }

  return (
    <div className="space-y-3">
      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as MobilityCategory]}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        {filtered.map(ex => {
          const inRoutine = inRoutineIds.has(ex.id)
          const expanded = expandedId === ex.id
          return (
            <div
              key={ex.id}
              className={`rounded-xl border transition-colors ${
                inRoutine ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${inRoutine ? 'text-emerald-300' : 'text-slate-200'}`}>
                    {ex.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500">{fmt(ex.durationSec)}</span>
                    {ex.categories.map(cat => (
                      <span
                        key={cat}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[cat]}`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setExpandedId(expanded ? null : ex.id)}
                    className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                    aria-label="Details"
                  >
                    <Info size={13} />
                  </button>
                  <button
                    onClick={() => toggleExercise(ex)}
                    className={`p-1.5 rounded transition-colors ${
                      inRoutine
                        ? 'text-emerald-400 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    aria-label={inRoutine ? 'Remove from routine' : 'Add to routine'}
                  >
                    {inRoutine ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-slate-700/40 pt-2.5">
                  <p className="text-xs text-slate-400 leading-relaxed">{ex.description}</p>
                  {ex.note && (
                    <div className="flex gap-1.5 mt-1.5">
                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mt-0.5">Note</span>
                      <p className="text-xs text-amber-300/80 leading-relaxed">{ex.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Presets tab ───────────────────────────────────────────────────────────────

function TemplatesSection() {
  const customTemplates = useMobilityStore(s => s.customTemplates)
  const loadTemplate = useMobilityStore(s => s.loadTemplate)
  const renameTemplate = useMobilityStore(s => s.renameTemplate)
  const deleteTemplate = useMobilityStore(s => s.deleteTemplate)

  const [confirming, setConfirming] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function commitRename() {
    if (renamingId) renameTemplate(renamingId, renameValue)
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Templates</p>

      {customTemplates.length === 0 && (
        <p className="text-xs text-slate-500">
          No saved templates yet. Build a routine in My Routine, then tap "Save as template" to reuse it later.
        </p>
      )}

      {customTemplates.map(template => {
        const totalSec = template.exercises.reduce((sum, e) => sum + totalTimedSec(e.sets), 0)
        return (
          <div key={template.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              {renamingId === template.id ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                    autoFocus
                    className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <button onClick={commitRename} className="text-sky-400 hover:text-sky-300 text-xs font-semibold px-1.5 py-1">
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{template.name}</p>
                  <button
                    onClick={() => startRename(template.id, template.name)}
                    className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0"
                    aria-label="Rename template"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
              <span className="text-xs text-slate-500 flex-shrink-0 font-mono">~{formatMobilityDuration(totalSec)}</span>
            </div>

            <div className="text-xs text-slate-600">
              {template.exercises.length} exercise{template.exercises.length === 1 ? '' : 's'}
            </div>

            {deletingId === template.id ? (
              <div className="space-y-2">
                <p className="text-xs text-rose-300">Delete this template? This can't be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { deleteTemplate(template.id); setDeletingId(null) }}
                    className="flex-1 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-3 py-2 rounded-lg border border-slate-600 text-slate-500 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : confirming === template.id ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Replace your current routine or append missing exercises?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { loadTemplate(template.id, 'replace'); setConfirming(null) }}
                    className="flex-1 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => { loadTemplate(template.id, 'append'); setConfirming(null) }}
                    className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
                  >
                    Append
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="px-3 py-2 rounded-lg border border-slate-600 text-slate-500 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(template.id)}
                  className="flex-1 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold transition-colors"
                >
                  Load Routine
                </button>
                <button
                  onClick={() => setDeletingId(template.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PresetsTab() {
  const loadPreset = useMobilityStore(s => s.loadPreset)
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <TemplatesSection />

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Built-in Presets</p>
        <p className="text-xs text-slate-500">
          Load a pre-built routine tailored to your needs. Replace your current routine or append new exercises.
        </p>

        {MOBILITY_PRESETS.map(preset => (
        <div key={preset.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">{preset.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{preset.description}</p>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0 font-mono">~{preset.durationMin}m</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {preset.categories.map(cat => (
              <span
                key={cat}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[cat]}`}
              >
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>

          <div className="text-xs text-slate-600">
            {preset.exercises.length} exercises
          </div>

          {confirming === preset.id ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Replace your current routine or append missing exercises?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { loadPreset(preset, 'replace'); setConfirming(null) }}
                  className="flex-1 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                >
                  Replace
                </button>
                <button
                  onClick={() => { loadPreset(preset, 'append'); setConfirming(null) }}
                  className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
                >
                  Append
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="px-3 py-2 rounded-lg border border-slate-600 text-slate-500 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(preset.id)}
              className="w-full py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold transition-colors"
            >
              Load Routine
            </button>
          )}
        </div>
        ))}
      </div>
    </div>
  )
}

// ── Page shell ────────────────────────────────────────────────────────────────

export function MobilityPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('routine')

  const tabs: Array<{ id: Tab; label: string; icon: typeof Layers }> = [
    { id: 'routine', label: 'My Routine', icon: Layers },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'presets', label: 'Presets', icon: Plus },
  ]

  return (
    <div className="px-4 pt-safe pb-32">
      {/* Header */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-white">Mobility Routine</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-800/60 rounded-xl p-1">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'routine' && <RoutineTab />}
      {tab === 'library' && <LibraryTab />}
      {tab === 'presets' && <PresetsTab />}
    </div>
  )
}
