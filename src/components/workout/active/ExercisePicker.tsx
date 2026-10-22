import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { EXERCISE_LIBRARY } from '../../../lib/exerciseLibrary'

export type ExercisePickerMode = { mode: 'add' } | { mode: 'replace'; exIdx: number }

export function ExercisePicker({
  mode,
  exerciseNames,
  canSaveToTemplate,
  onSelect,
  onClose,
}: {
  mode: 'add' | 'replace'
  exerciseNames: string[]
  canSaveToTemplate: boolean
  onSelect: (name: string, insertAt: number, saveToTemplate: boolean) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [insertAt, setInsertAt] = useState(exerciseNames.length)
  const [showCustom, setShowCustom] = useState(false)
  const [saveToTemplate, setSaveToTemplate] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return EXERCISE_LIBRARY.slice(0, 25)
    return EXERCISE_LIBRARY.filter(ex => ex.name.toLowerCase().includes(q)).slice(0, 40)
  }, [query])

  function handleSelect(name: string) {
    onSelect(name, insertAt, saveToTemplate)
  }

  function handleCustomSubmit() {
    const name = customName.trim()
    if (!name) return
    handleSelect(name)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900">
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-slate-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-sm font-bold text-white flex-1">
          {mode === 'add' ? 'Add Exercise' : 'Replace Exercise'}
        </h2>
        {canSaveToTemplate && (
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <span className="text-[10px] text-slate-400 leading-none">Save to plan</span>
            <div
              onClick={() => setSaveToTemplate(v => !v)}
              className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${saveToTemplate ? 'bg-sky-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${saveToTemplate ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
          </label>
        )}
      </div>

      {mode === 'add' && exerciseNames.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Insert position</p>
          <div className="flex flex-wrap gap-1.5">
            {exerciseNames.map((name, i) => (
              <button
                key={i}
                onClick={() => setInsertAt(i)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  insertAt === i
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Before {name.split(',')[0]}
              </button>
            ))}
            <button
              onClick={() => setInsertAt(exerciseNames.length)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                insertAt === exerciseNames.length
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              At end
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises..."
          autoFocus={!showCustom}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-slate-600 text-slate-400 text-sm hover:border-sky-500/50 hover:text-sky-300 transition-colors"
          >
            + Enter custom exercise name
          </button>
        ) : (
          <div className="flex gap-2 mb-1">
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Custom exercise name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit() }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customName.trim()}
              className="px-3 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {filtered.map(ex => (
          <button
            key={ex.name}
            onClick={() => handleSelect(ex.name)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <p className="text-sm text-white leading-tight">{ex.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{ex.target.join(', ')}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
