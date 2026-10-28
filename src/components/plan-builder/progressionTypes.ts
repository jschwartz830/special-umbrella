import type { ProgressionType } from '../../types/program'

// ── Progression type definitions ─────────────────────────────────────────────

interface ProgressionTypeMeta {
  type: ProgressionType
  label: string
  description: string
  /** Rule template for the if/then/else fields; absent for types the app drives itself. */
  template?: (varName: string) => { if?: string; then: string; else?: string }
}

export const PROGRESSION_TYPE_META: ProgressionTypeMeta[] = [
  {
    type: 'single',
    label: 'Single Progression (Linear)',
    description: 'Add a fixed weight increment each session when all target reps are hit.',
    template: v => ({ if: 'all_reps', then: `${v} += 2.5`, else: `${v} = round5(${v} * 0.9)` }),
  },
  {
    type: 'double',
    label: 'Double Progression',
    description: 'Increase reps session-to-session; once max reps are hit, bump weight and reset.',
    template: v => ({ if: 'all_reps', then: `${v} += 5` }),
  },
  {
    type: 'dynamic_double',
    label: 'Dynamic Double Progression',
    description: 'Auto-regulates load based on effort; progress weight only when reps and effort both meet threshold.',
    template: v => ({ if: 'all_reps and effort <= 3', then: `${v} += 2.5`, else: `${v} = round5(${v} * 0.95)` }),
  },
  {
    type: 'triple',
    label: 'Triple Progression',
    description: 'Progress through reps, then sets, then weight across consecutive sessions.',
    template: v => ({ if: 'all_reps and effort <= 2', then: `${v} += 2.5`, else: `${v} = round5(${v} * 0.9)` }),
  },
  {
    type: 'step_loading',
    label: 'Step Loading',
    description: 'Pre-set loading blocks per training cycle with automatic weight jumps each block.',
    template: v => ({ if: 'all_reps', then: `${v} += 5`, else: `${v} = round5(${v} * 0.85)` }),
  },
  {
    type: 'rep_ladder',
    label: 'Rep Ladder (Russian Fighter)',
    description: 'Descending ladder from your max (5-4-3-2-1); each completed session adds one rep to the next set, a missed one repeats. Counts sessions, not days — best at 3+ sessions a week.',
  },
]

export function toVarName(exerciseName: string): string {
  return exerciseName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'weight'
}
