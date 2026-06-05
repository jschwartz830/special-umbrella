import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProgramVarDefs, ProgressionRule } from '../types/program'
import { evaluateCondition, evaluateUpdates, type EvalContext } from '../lib/expressionEval'

interface ProgramState {
  /** planId → varName → current value */
  vars: Record<string, Record<string, number>>

  /** Initialise vars for a plan from its programMeta.vars definition.
   *  Only sets values that don't already exist (idempotent on re-activation). */
  initVars: (planId: string, defs: ProgramVarDefs) => void

  /** Return current vars for a plan, or {} if none. */
  getVars: (planId: string) => Record<string, number>

  /** Overwrite a subset of vars for a plan. */
  setVars: (planId: string, patch: Record<string, number>) => void

  /** Remove all vars for a plan (called when plan is deleted). */
  clearPlanVars: (planId: string) => void

  /**
   * Evaluate a ProgressionRule against the given context and, if the condition
   * passes, apply the `then` updates; otherwise apply `else` updates if present.
   * Returns the set of vars that changed (empty if condition failed with no else).
   */
  applyProgressionRule: (
    planId: string,
    rule: ProgressionRule,
    ctx: Omit<EvalContext, 'vars'>,
  ) => Record<string, number>
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      vars: {},

      initVars(planId, defs) {
        set(s => {
          const existing = s.vars[planId] ?? {}
          const merged: Record<string, number> = { ...existing }
          for (const [k, v] of Object.entries(defs)) {
            if (!(k in merged)) merged[k] = v
          }
          return { vars: { ...s.vars, [planId]: merged } }
        })
      },

      getVars(planId) {
        return get().vars[planId] ?? {}
      },

      setVars(planId, patch) {
        set(s => ({
          vars: {
            ...s.vars,
            [planId]: { ...(s.vars[planId] ?? {}), ...patch },
          },
        }))
      },

      clearPlanVars(planId) {
        set(s => {
          const { [planId]: _removed, ...rest } = s.vars
          return { vars: rest }
        })
      },

      applyProgressionRule(planId, rule, ctxBase) {
        try {
          const currentVars = get().getVars(planId)
          const ctx: EvalContext = { ...ctxBase, vars: currentVars }

          const condMet = evaluateCondition(rule.if, ctx)
          const updateStr = condMet ? rule.then : (rule.else ?? '')
          if (!updateStr) return {}

          const updates = evaluateUpdates(updateStr, ctx)
          if (Object.keys(updates).length > 0) {
            get().setVars(planId, updates)
          }
          return updates
        } catch (err) {
          console.error('[programStore] applyProgressionRule failed:', err, { planId, rule })
          return {}
        }
      },
    }),
    { name: 'wpt_program_vars' },
  ),
)
