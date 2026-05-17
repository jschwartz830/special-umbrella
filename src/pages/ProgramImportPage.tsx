import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode, type UIEvent } from 'react'
import gzclp5kTemplate from '../programs/gzclp-5k.yaml?raw'
import upperLowerTemplate from '../programs/upper-lower-hybrid-12w.yaml?raw'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Dumbbell, Footprints, Maximize2, Minimize2 } from 'lucide-react'
import { parseYamlProgram } from '../engine/programParser'
import { usePlanStore } from '../store/planStore'
import { useProgramStore } from '../store/programStore'
import type { Plan, WorkoutSlot } from '../types'
import type { ExerciseSpec, RunSegment } from '../types/program'

// ── Example stub shown on first load ─────────────────────────────────────────

const TEMPLATE_OPTIONS = [
  { id: 'gzclp-5k', label: 'GZCLP + 5K Build', yaml: gzclp5kTemplate },
  { id: 'upper-lower-12w', label: 'Upper/Lower Hybrid 12-Week', yaml: upperLowerTemplate },
] as const

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
  const warmupStr = ex.warmup
    ? ` · warmup ${typeof ex.warmup === 'string' ? ex.warmup : ex.warmup.percentages.map(p => `${p}%`).join(' / ')}`
    : ''
  const progStr = ex.progress
    ? ` → if (${ex.progress.if ?? 'always'}) ${ex.progress.then}`
    : ''
  return (
    <div className="text-xs text-slate-300 pl-2 border-l border-slate-600">
      <span className="text-white font-medium">{ex.exercise}</span>
      {setsStr && <span className="text-slate-400"> {setsStr}</span>}
      {loadStr && <span className="text-amber-400">{loadStr}</span>}
      {restStr && <span className="text-slate-500">{restStr}</span>}
      {warmupStr && <span className="text-orange-300">{warmupStr}</span>}
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


// ── YAML editor ────────────────────────────────────────────────────────────────

const YAML_PLACEHOLDER = `name: "My Program"
duration:
  type: weeks
  value: 8
vars:
  squat: 135
days:
  - label: "Day A"
    slots:
      - type: weights
        name: "Squat"
        exercises:
          - exercise: Squat
            sets: 5
            reps: 3
            load: squat
            rest: 3m
            progress:
              if: all_reps
              then: "squat += 5"`

function findYamlCommentIndex(line: string) {
  let quote: 'single' | 'double' | null = null
  let escaped = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (quote === 'double' && escaped) {
      escaped = false
      continue
    }

    if (quote === 'double' && char === '\\') {
      escaped = true
      continue
    }

    if (!quote && char === '"') quote = 'double'
    else if (quote === 'double' && char === '"') quote = null
    else if (!quote && char === "'") quote = 'single'
    else if (quote === 'single' && char === "'") quote = null
    else if (!quote && char === '#') return i
  }

  return -1
}

function highlightYamlValue(value: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  const tokenPattern = /("(?:\\.|[^"\\])*"|'[^']*'|\b(?:true|false|null)\b|\b\d+(?:\.\d+)?(?:ms|s|m|h|lb|kg|mi|km|%)?\b)/gi
  let lastIndex = 0
  let tokenIndex = 0

  for (const match of value.matchAll(tokenPattern)) {
    const token = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) parts.push(value.slice(lastIndex, index))

    const lower = token.toLowerCase()
    const className = token.startsWith('"') || token.startsWith("'")
      ? 'text-amber-300'
      : lower === 'true' || lower === 'false' || lower === 'null'
        ? 'text-fuchsia-300'
        : 'text-emerald-300'

    parts.push(<span key={`${keyPrefix}-token-${tokenIndex}`} className={className}>{token}</span>)
    lastIndex = index + token.length
    tokenIndex += 1
  }

  if (lastIndex < value.length) parts.push(value.slice(lastIndex))

  return parts
}

function highlightYamlLine(line: string, lineIndex: number): ReactNode {
  const commentIndex = findYamlCommentIndex(line)
  const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : ''
  const keyMatch = code.match(/^(\s*)(-\s*)?([A-Za-z_][\w-]*)(\s*:)(.*)$/)
  const nodes: ReactNode[] = []

  if (keyMatch) {
    const [, indent, listMarker = '', key, colon, value] = keyMatch
    nodes.push(indent)
    if (listMarker) {
      nodes.push(<span key={`${lineIndex}-dash`} className="text-sky-300">{listMarker}</span>)
    }
    nodes.push(<span key={`${lineIndex}-key`} className="text-cyan-300">{key}</span>)
    nodes.push(<span key={`${lineIndex}-colon`} className="text-slate-400">{colon}</span>)
    nodes.push(...highlightYamlValue(value, `${lineIndex}-value`))
  } else {
    const listMatch = code.match(/^(\s*)(-\s*)(.*)$/)

    if (listMatch) {
      const [, indent, listMarker, value] = listMatch
      nodes.push(indent)
      nodes.push(<span key={`${lineIndex}-dash`} className="text-sky-300">{listMarker}</span>)
      nodes.push(...highlightYamlValue(value, `${lineIndex}-value`))
    } else {
      nodes.push(...highlightYamlValue(code, `${lineIndex}-value`))
    }
  }

  if (comment) nodes.push(<span key={`${lineIndex}-comment`} className="text-slate-500">{comment}</span>)

  return nodes
}

function YamlEditor({
  value,
  onChange,
  onDirty,
  onPreview,
}: {
  value: string
  onChange: (value: string) => void
  onDirty: () => void
  onPreview: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const highlightRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lines = useMemo(() => value.split('\n'), [value])
  const lineCount = Math.max(1, lines.length)
  const highlighted = useMemo(
    () => lines.map((line, index) => (
      <span key={index}>
        {highlightYamlLine(line, index)}
        {index < lines.length - 1 ? '\n' : null}
      </span>
    )),
    [lines],
  )

  useEffect(() => {
    if (!expanded) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    textareaRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [expanded])

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!highlightRef.current) return
    highlightRef.current.scrollTop = event.currentTarget.scrollTop
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
  }

  const editorHeightClass = expanded
    ? 'h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] min-h-0'
    : 'h-64'
  const frameClass = expanded
    ? 'fixed inset-0 z-50 flex flex-col bg-slate-950 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)]'
    : ''

  return (
    <div className={frameClass}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider">
            Program YAML
          </label>
          {expanded && (
            <p className="text-[11px] text-slate-500">IDE-style colors · {lineCount} line{lineCount === 1 ? '' : 's'}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={onPreview}
              disabled={!value.trim()}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Preview
            </button>
          )}
          <button
            onClick={() => setExpanded(isExpanded => !isExpanded)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            aria-pressed={expanded}
            aria-label={expanded ? 'Collapse YAML editor' : 'Expand YAML editor'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {expanded ? 'Done' : 'Expand'}
          </button>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-inner ${editorHeightClass}`}>
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[16px] leading-6 text-slate-200"
        >
          {value ? highlighted : <span className="text-slate-600">{YAML_PLACEHOLDER}</span>}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { onChange(e.target.value); onDirty() }}
          onScroll={handleScroll}
          placeholder={YAML_PLACEHOLDER}
          className={`absolute inset-0 h-full w-full resize-none overflow-auto rounded-xl bg-transparent px-3 py-2.5 font-mono text-[16px] leading-6 caret-white placeholder-slate-600 selection:bg-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${value ? 'text-transparent' : 'text-slate-200'}`}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Tap Expand for a phone-friendly full-screen editor with YAML keys, strings, numbers, booleans, lists, and comments color coded.
      </p>
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
  const [selectedTemplate, setSelectedTemplate] = useState<(typeof TEMPLATE_OPTIONS)[number]['id']>('gzclp-5k')

  const handleParse = useCallback(() => {
    if (!yaml.trim()) return
    const result = parseYamlProgram(yaml)
    setParseResult(result)
    setImported(false)
  }, [yaml])

  const handleLoadExample = useCallback((templateId?: string) => {
    const chosen = TEMPLATE_OPTIONS.find(t => t.id === templateId) ?? TEMPLATE_OPTIONS[0]
    setYaml(chosen.yaml)
    const result = parseYamlProgram(chosen.yaml)
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
        {/* YAML editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value as (typeof TEMPLATE_OPTIONS)[number]['id'])}
              className="min-w-0 flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-2 sm:flex-none"
            >
              {TEMPLATE_OPTIONS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleLoadExample(selectedTemplate)}
              className="shrink-0 text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              Load template
            </button>
          </div>
          <YamlEditor
            value={yaml}
            onChange={setYaml}
            onDirty={() => { setParseResult(null); setImported(false) }}
            onPreview={handleParse}
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
    warmup: "30% / 40% / 50%"
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
