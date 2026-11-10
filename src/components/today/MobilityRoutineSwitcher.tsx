import { useMemo, useState } from 'react'
import { Check, ChevronRight, Shuffle } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { useMobilityStore } from '../../store/mobilityStore'
import {
  MOBILITY_PRESETS,
  presetToRoutine,
  routinesMatch,
  summarizeMobilitySets,
  totalTimedSec,
  type MobilityRoutineExercise,
} from '../../lib/mobilityLibrary'

interface Choice {
  key: string
  name: string
  detail: string
  exercises: MobilityRoutineExercise[]
  load: () => void
}

function routineDetail(exercises: MobilityRoutineExercise[]): string {
  const secs = exercises.reduce((sum, e) => sum + totalTimedSec(e.sets), 0)
  const count = `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`
  return secs > 0 ? `${count} · ~${Math.ceil(secs / 60)} min` : count
}

/**
 * "Routine: <name> · Switch" row for Today's mobility card. Switching replaces
 * the daily routine with a saved template or a preset; if the current routine
 * isn't saved anywhere, it offers to save it first so it isn't lost.
 */
export function MobilityRoutineSwitcher() {
  const routine = useMobilityStore(s => s.routine)
  const customTemplates = useMobilityStore(s => s.customTemplates)
  const loadTemplate = useMobilityStore(s => s.loadTemplate)
  const loadPreset = useMobilityStore(s => s.loadPreset)
  const saveAsTemplate = useMobilityStore(s => s.saveAsTemplate)
  const [open, setOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const templates: Choice[] = useMemo(() => customTemplates.map(t => ({
    key: `t-${t.id}`,
    name: t.name,
    detail: routineDetail(t.exercises),
    exercises: t.exercises,
    load: () => loadTemplate(t.id, 'replace'),
  })), [customTemplates, loadTemplate])

  const presets: Choice[] = useMemo(() => MOBILITY_PRESETS.map(p => {
    const exercises = presetToRoutine(p)
    return {
      key: `p-${p.id}`,
      name: p.name,
      detail: routineDetail(exercises),
      exercises,
      load: () => loadPreset(p, 'replace'),
    }
  }), [loadPreset])

  // Saved templates win over presets when both match.
  const current = [...templates, ...presets].find(c => routinesMatch(c.exercises, routine)) ?? null
  const unsaved = !current && routine.length > 0

  function choose(choice: Choice) {
    choice.load()
    setOpen(false)
  }

  function saveCurrent() {
    const name = saveName.trim()
    if (!name) return
    saveAsTemplate(name, routine)
    setSaveName('')
  }

  const list = (title: string, choices: Choice[]) => choices.length > 0 && (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{title}</p>
      {choices.map(c => {
        const isCurrent = current?.key === c.key
        return (
          <button
            key={c.key}
            onClick={() => (isCurrent ? setOpen(false) : choose(c))}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
              isCurrent
                ? 'border-teal-500/40 bg-teal-500/10'
                : 'border-slate-700 bg-slate-900/40 hover:bg-slate-700/40'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-100 font-medium truncate">{c.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {c.detail}
                {c.exercises[0] ? ` · ${c.exercises.slice(0, 3).map(e => e.name).join(', ')}${c.exercises.length > 3 ? '…' : ''}` : ''}
              </p>
            </div>
            {isCurrent ? <Check size={15} className="text-teal-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-slate-600 flex-shrink-0" />}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <div className="flex items-center justify-between gap-2 mt-1.5 px-1">
        <p className="text-xs text-slate-500 truncate">
          Routine: <span className="text-slate-300">{current?.name ?? 'Custom'}</span>
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0"
        >
          <Shuffle size={12} /> Switch
        </button>
      </div>

      {open && (
        <Modal title="Switch routine" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {unsaved && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <p className="text-xs text-amber-200">
                  Your current routine isn't saved as a template. Switching replaces it — save it first to keep it.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCurrent() }}
                    placeholder="Template name"
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                  />
                  <button
                    onClick={saveCurrent}
                    disabled={!saveName.trim()}
                    className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[11px] text-amber-200/60 truncate">
                  {routine.map(e => `${e.name} (${summarizeMobilitySets(e.sets)})`).join(', ')}
                </p>
              </div>
            )}
            {list('My templates', templates)}
            {list('Presets', presets)}
          </div>
        </Modal>
      )}
    </>
  )
}
