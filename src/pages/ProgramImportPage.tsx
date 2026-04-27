import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Dumbbell, Footprints } from 'lucide-react'
import { parseYamlProgram } from '../engine/programParser'
import { usePlanStore } from '../store/planStore'
import { useProgramStore } from '../store/programStore'
import type { Plan, WorkoutSlot } from '../types'
import type { ExerciseSpec, RunSegment } from '../types/program'

// ── Example stub shown on first load ─────────────────────────────────────────

const EXAMPLE_YAML = `name: "GZCLP + 5K Build"
description: "Linear strength progression + 5K base building. 6-day rotation."
duration:
  type: weeks
  value: 12

vars:
  squat: 135
  bench: 95
  ohp: 65
  deadlift: 155
  row: 95
  easy_miles: 3.0
  tempo_miles: 2.0
  interval_reps: 4

days:
  - label: "Squat + OHP"
    slots:
      - type: weights
        name: "T1 Squat / T2 OHP"
        focus: legs
        intent: strength
        durationMin: 55

        warmup:
          - exercise: Squat
            sets:
              - { reps: 5, load: "45lb" }
              - { reps: 3, load: "0.6 * squat" }
              - { reps: 1, load: "0.8 * squat" }

        exercises:
          - exercise: Squat
            sets: 5
            reps: 3
            load: squat
            rest: 3m
            progress:
              if: all_reps
              then: "squat += 5"
              else: "squat = round5(squat * 0.85)"

          - exercise: OHP
            sets: 3
            reps: 10
            load: ohp
            rest: 90s
            progress:
              if: all_reps
              then: "ohp += 5"

  - label: "Easy Run"
    slots:
      - type: run
        name: "Easy Run"
        subtype: easy
        segments:
          - type: easy
            distance: "easy_miles mi"
            pace: easy
        progress:
          if: "effort <= 3"
          then: "easy_miles = min(easy_miles + 0.5, 8)"

  - label: "Bench + Row"
    slots:
      - type: weights
        name: "T1 Bench / T2 Row"
        focus: upper
        intent: strength
        durationMin: 55
        warmup:
          - exercise: "Bench Press"
            sets:
              - { reps: 10, load: "45lb" }
              - { reps: 5,  load: "0.6 * bench" }
              - { reps: 1,  load: "0.8 * bench" }
        exercises:
          - exercise: "Bench Press"
            sets: 5
            reps: 3
            load: bench
            rest: 3m
            progress:
              if: all_reps
              then: "bench += 5"
              else: "bench = round5(bench * 0.85)"
          - exercise: "Barbell Row"
            sets: 3
            reps: 10
            load: row
            rest: 90s
            progress:
              if: all_reps
              then: "row += 5"

  - label: "Tempo + Drills"
    slots:
      - type: run
        name: "Tempo with Drills"
        subtype: tempo
        durationMin: 40
        segments:
          - type: warmup
            duration: 10m
            pace: easy
          - type: drills
            drills:
              - { name: "High Knees",   sets: 2, duration: 20s, rest: 30s }
              - { name: "A-Skips",      sets: 2, reps: 20,      rest: 30s }
              - { name: "Leg Swings",   sets: 1, reps: 10 }
          - type: tempo
            distance: "tempo_miles mi"
            pace: tempo
          - type: cooldown
            duration: 5m
            pace: easy
        progress:
          if: "effort <= 3"
          then: "tempo_miles = min(tempo_miles + 0.25, 5)"

  - label: "Deadlift + Core"
    slots:
      - type: weights
        name: "T1 Deadlift / Core"
        focus: full_body
        intent: strength
        durationMin: 45
        warmup:
          - exercise: Deadlift
            sets:
              - { reps: 5, load: "135lb" }
              - { reps: 3, load: "0.65 * deadlift" }
              - { reps: 1, load: "0.8 * deadlift" }
        exercises:
          - exercise: Deadlift
            sets: 1
            reps: 5
            load: deadlift
            rest: 5m
            progress:
              if: all_reps
              then: "deadlift += 10"
              else: "deadlift = round5(deadlift * 0.9)"
          - exercise: Plank
            sets: 3
            duration: 45s
            rest: 60s
          - exercise: "Dead Bug"
            sets: 3
            reps: 10
            rest: 45s

  - label: "Intervals"
    slots:
      - type: run
        name: "800m Intervals"
        subtype: intervals
        segments:
          - type: warmup
            distance: 1mi
            pace: easy
          - type: interval
            name: "800m Repeats"
            distance: 800m
            pace: "5K"
            reps: interval_reps
            rest: 2m
          - type: cooldown
            distance: 1mi
            pace: easy
        progress:
          if: "effort <= 3"
          then: "interval_reps = min(interval_reps + 1, 8)"

  - label: "Rest"
    slots:
      - type: other
        name: "Rest Day"
        subtype: rest
`

// ── Preview components ────────────────────────────────────────────────────────

function ExerciseRow({ ex }: { ex: ExerciseSpec }) {
  const setsStr =
    typeof ex.sets === 'number'
      ? `${ex.sets} × ${ex.reps ?? '?'}`
      : Array.isArray(ex.sets)
        ? `${ex.sets.length} sets`
        : ex.reps
          ? `× ${ex.reps}`
          : ''
  const loadStr = ex.load ? ` @ ${ex.load}` : ''
  const restStr = ex.rest ? ` · rest ${ex.rest}` : ''
  const progStr = ex.progress
    ? ` → if (${ex.progress.if ?? 'always'}) ${ex.progress.then}`
    : ''
  return (
    <div className="text-xs text-slate-300 pl-2 border-l border-slate-600">
      <span className="text-white font-medium">{ex.exercise}</span>
      {setsStr && <span className="text-slate-400"> {setsStr}</span>}
      {loadStr && <span className="text-amber-400">{loadStr}</span>}
      {restStr && <span className="text-slate-500">{restStr}</span>}
      {progStr && <span className="text-emerald-400 block pl-1 italic text-[11px]">{progStr}</span>}
    </div>
  )
}

function SegmentRow({ seg }: { seg: RunSegment }) {
  const label = seg.name ?? seg.type
  const dist = seg.distance ? ` ${seg.distance}` : ''
  const dur = seg.duration ? ` ${seg.duration}` : ''
  const pace = seg.pace ? ` @ ${seg.pace}` : ''
  const reps = seg.reps ? ` × ${seg.reps}` : ''
  const rest = seg.rest ? ` · rest ${seg.rest}` : ''
  const drillCount = seg.drills?.length ? ` (${seg.drills.length} drills)` : ''
  return (
    <div className="text-xs text-slate-300 pl-2 border-l border-slate-600">
      <span className="text-white font-medium capitalize">{label}</span>
      <span className="text-sky-400">{dist}{dur}{reps}</span>
      {pace && <span className="text-slate-400">{pace}</span>}
      {rest && <span className="text-slate-500">{rest}</span>}
      {drillCount && <span className="text-purple-400">{drillCount}</span>}
    </div>
  )
}

function SlotPreview({ slot }: { slot: WorkoutSlot }) {
  const [open, setOpen] = useState(false)
  const hasDetail = (slot.exercises?.length ?? 0) + (slot.warmup?.length ?? 0) + (slot.segments?.length ?? 0) > 0
  const isWeights = slot.type === 'weights' || slot.type === 'weightlifting'

  return (
    <div className="bg-slate-700/40 rounded-lg p-2 space-y-1">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => hasDetail && setOpen(o => !o)}
        disabled={!hasDetail}
      >
        {isWeights
          ? <Dumbbell size={13} className="text-orange-400 shrink-0" />
          : <Footprints size={13} className="text-emerald-400 shrink-0" />}
        <span className="text-sm font-medium text-white">{slot.name}</span>
        {slot.durationMin && (
          <span className="text-xs text-slate-400 ml-1">{slot.durationMin}m</span>
        )}
        {hasDetail && (
          open
            ? <ChevronDown size={13} className="text-slate-400 ml-auto" />
            : <ChevronRight size={13} className="text-slate-400 ml-auto" />
        )}
      </button>

      {open && (
        <div className="space-y-1 pt-1">
          {slot.warmup && slot.warmup.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Warmup</p>
              {slot.warmup.map((ex, i) => <ExerciseRow key={i} ex={ex} />)}
            </div>
          )}
          {slot.exercises && slot.exercises.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Exercises</p>
              {slot.exercises.map((ex, i) => <ExerciseRow key={i} ex={ex} />)}
            </div>
          )}
          {slot.segments && slot.segments.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Segments</p>
              {slot.segments.map((seg, i) => <SegmentRow key={i} seg={seg} />)}
            </div>
          )}
          {slot.slotProgress && (
            <p className="text-[11px] text-emerald-400 italic pl-2">
              Progression: if ({slot.slotProgress.if ?? 'always'}) → {slot.slotProgress.then}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PlanPreview({ plan }: { plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base">{plan.name}</h3>
        {plan.description && (
          <p className="text-slate-400 text-sm mt-0.5">{plan.description}</p>
        )}
        <p className="text-slate-500 text-xs mt-1">
          {plan.duration.value} {plan.duration.type} · {plan.days.length} day rotation
        </p>
      </div>

      {plan.programMeta && Object.keys(plan.programMeta.vars).length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Program Variables</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(plan.programMeta.vars).map(([k, v]) => (
              <span key={k} className="bg-slate-700 rounded px-2 py-0.5 text-xs text-slate-300">
                <span className="text-amber-400">{k}</span>
                <span className="text-slate-500"> = </span>
                <span className="text-white">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plan.days.map((day, i) => (
          <div key={day.id} className="bg-slate-800 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-slate-400">
              Day {i + 1} — {day.label}
            </p>
            {day.slots.map(slot => (
              <SlotPreview key={slot.id} slot={slot} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProgramImportPage() {
  const navigate = useNavigate()
  const createPlan = usePlanStore(s => s.createPlan)
  const initVars = useProgramStore(s => s.initVars)

  const [yaml, setYaml] = useState('')
  const [parseResult, setParseResult] = useState<{
    plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
    errors: string[]
  } | null>(null)
  const [imported, setImported] = useState(false)

  const handleParse = useCallback(() => {
    if (!yaml.trim()) return
    const result = parseYamlProgram(yaml)
    setParseResult(result)
    setImported(false)
  }, [yaml])

  const handleLoadExample = useCallback(() => {
    setYaml(EXAMPLE_YAML)
    const result = parseYamlProgram(EXAMPLE_YAML)
    setParseResult(result)
    setImported(false)
  }, [])

  const handleImport = useCallback(() => {
    if (!parseResult || parseResult.errors.length > 0) return
    const planId = createPlan(parseResult.plan)
    if (parseResult.plan.programMeta) {
      initVars(planId, parseResult.plan.programMeta.vars)
    }
    setImported(true)
  }, [parseResult, createPlan, initVars])

  const hasErrors = (parseResult?.errors.length ?? 0) > 0
  const canImport = parseResult && !hasErrors && !imported

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-semibold text-base leading-tight">Import Program</h1>
            <p className="text-xs text-slate-400">Paste YAML to create a programmatic plan</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Program YAML
            </label>
            <button
              onClick={handleLoadExample}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              Load example
            </button>
          </div>
          <textarea
            value={yaml}
            onChange={e => { setYaml(e.target.value); setParseResult(null); setImported(false) }}
            placeholder={`name: "My Program"\nduration:\n  type: weeks\n  value: 8\nvars:\n  squat: 135\ndays:\n  - label: "Day A"\n    slots:\n      - type: weights\n        name: "Squat"\n        exercises:\n          - exercise: Squat\n            sets: 5\n            reps: 3\n            load: squat\n            rest: 3m\n            progress:\n              if: all_reps\n              then: "squat += 5"`}
            className="w-full h-56 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleParse}
            disabled={!yaml.trim()}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Preview
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={15} />
            Import Plan
          </button>
        </div>

        {/* Errors */}
        {parseResult && hasErrors && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <AlertCircle size={15} />
              {parseResult.errors.length} error{parseResult.errors.length > 1 ? 's' : ''}
            </div>
            {parseResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 pl-5">{e}</p>
            ))}
          </div>
        )}

        {/* Success */}
        {imported && (
          <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle size={15} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-300">Plan imported successfully</p>
              <p className="text-xs text-slate-400">
                Go to{' '}
                <button
                  onClick={() => navigate('/plans')}
                  className="text-sky-400 underline"
                >
                  Plans
                </button>{' '}
                to activate it.
              </p>
            </div>
          </div>
        )}

        {/* Preview */}
        {parseResult && !hasErrors && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Preview</p>
            <PlanPreview plan={parseResult.plan} />
          </div>
        )}

        {/* Format reference */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400 transition-colors select-none py-1">
            Format reference ▸
          </summary>
          <div className="mt-2 bg-slate-900 rounded-xl p-3 space-y-3 text-xs text-slate-400">
            <div>
              <p className="text-slate-300 font-medium mb-1">Top-level fields</p>
              <pre className="text-slate-400 leading-relaxed">{`name: string (required)
description: string
duration:
  type: "weeks" | "rotations"
  value: number
vars:           # named numeric variables
  squat: 135`}</pre>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Weights slot</p>
              <pre className="text-slate-400 leading-relaxed">{`type: weights
focus: upper|lower|full_body|push|pull|legs|core
intent: strength|hypertrophy|power|conditioning|…
warmup:         # optional warmup exercises
  - exercise: Squat
    sets:
      - { reps: 5, load: "45lb" }
      - { reps: 3, load: "0.6 * squat" }
exercises:
  - exercise: "Bench Press"
    sets: 5          # count, uses reps/load below
    reps: 3
    load: bench      # var reference
    rest: 3m
    progress:
      if: all_reps   # condition
      then: "bench += 5"
      else: "bench = round5(bench * 0.85)"`}</pre>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Run slot</p>
              <pre className="text-slate-400 leading-relaxed">{`type: run
subtype: easy|tempo|intervals|long|recovery
segments:
  - type: warmup
    duration: 10m
    pace: easy
  - type: drills
    drills:
      - { name: "High Knees", sets: 2, duration: 20s, rest: 30s }
  - type: interval
    distance: 800m
    pace: "5K"
    reps: interval_reps   # var reference
    rest: 2m
  - type: cooldown
    distance: 1mi
    pace: easy
progress:
  if: "effort <= 3"
  then: "easy_miles = min(easy_miles + 0.5, 8)"`}</pre>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Progression expressions</p>
              <pre className="text-slate-400 leading-relaxed">{`Conditions: all_reps, session_complete,
            effort <= 3, all_reps and effort <= 4

Updates:    squat += 5
            squat = round5(squat * 0.85)
            easy_miles = min(easy_miles + 0.5, 8)

Functions:  min  max  round  floor  ceil  abs
            round5    (nearest 5lb)
            round2_5  (nearest 2.5lb)`}</pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
