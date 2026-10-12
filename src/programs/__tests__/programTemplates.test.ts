/**
 * Every bundled program template must parse cleanly, only reference vars it
 * defines (in loads, run distances and progression rules), and point
 * mobility exercises at real library entries.
 */
import { describe, it, expect } from 'vitest'
import { PROGRAM_TEMPLATES, PROGRAM_CATEGORIES } from '..'
import { parseYamlProgram } from '../../engine/programParser'
import { resolveLoad, evaluateCondition, evaluateUpdates } from '../../lib/expressionEval'
import { getLibraryExerciseById } from '../../lib/mobilityLibrary'
import type { ProgressionRule } from '../../types/program'

const IDENT = /[a-zA-Z_]\w*/g
const BUILTINS = new Set(['min', 'max', 'round', 'floor', 'ceil', 'abs', 'round5', 'round2_5', 'and', 'or', 'not',
  'effort', 'all_reps', 'session_complete', 'mi', 'km', 'm', 's', 'min_', 'lb', 'kg'])

describe('program template library', () => {
  it('has unique ids and every category is populated', () => {
    const ids = PROGRAM_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const cat of PROGRAM_CATEGORIES) {
      expect(PROGRAM_TEMPLATES.some(t => t.category === cat)).toBe(true)
    }
  })

  for (const template of PROGRAM_TEMPLATES) {
    describe(template.label, () => {
      const { plan, errors } = parseYamlProgram(template.yaml)
      const vars = plan.programMeta?.vars ?? {}
      const ctx = { vars, effort: 3, all_reps: true, session_complete: true }

      const rules: Array<{ where: string; rule: ProgressionRule }> = []
      for (const day of plan.days) {
        for (const slot of day.slots) {
          if (slot.slotProgress) rules.push({ where: `${day.label} / ${slot.name}`, rule: slot.slotProgress })
          for (const ex of [...(slot.warmup ?? []), ...(slot.exercises ?? [])]) {
            if (ex.progress) rules.push({ where: `${day.label} / ${ex.exercise}`, rule: ex.progress })
          }
        }
      }

      it('parses without errors', () => {
        expect(errors).toEqual([])
        expect(plan.days.length).toBeGreaterThan(0)
      })

      it('every load expression resolves with the program vars', () => {
        for (const day of plan.days) {
          for (const slot of day.slots) {
            for (const ex of [...(slot.warmup ?? []), ...(slot.exercises ?? [])]) {
              const loads = [ex.load, ...(Array.isArray(ex.sets) ? ex.sets.map(s => s.load) : [])]
              for (const load of loads) {
                if (!load) continue
                expect(resolveLoad(load, ctx), `${day.label} / ${ex.exercise}: ${load}`).not.toBeNull()
              }
            }
          }
        }
      })

      it('run segment expressions only reference defined vars', () => {
        for (const day of plan.days) {
          for (const slot of day.slots) {
            for (const seg of slot.segments ?? []) {
              for (const field of [seg.distance, seg.duration, typeof seg.reps === 'string' ? seg.reps : undefined]) {
                for (const id of field?.match(IDENT) ?? []) {
                  if (!BUILTINS.has(id)) expect(vars, `${day.label}: ${field}`).toHaveProperty(id)
                }
              }
            }
          }
        }
      })

      it('progression rules evaluate and only update defined vars', () => {
        for (const { where, rule } of rules) {
          expect(() => evaluateCondition(rule.if, ctx), where).not.toThrow()
          const updates = evaluateUpdates(rule.then, ctx)
          expect(Object.keys(updates).length, `${where}: ${rule.then}`).toBeGreaterThan(0)
          for (const key of Object.keys(updates)) expect(vars, `${where}: ${rule.then}`).toHaveProperty(key)
        }
      })

      it('mobility exercises with library ids exist in the mobility library', () => {
        for (const day of plan.days) {
          for (const slot of day.slots) {
            for (const ex of slot.mobilityExercises ?? []) {
              if (ex.id.startsWith('lib-')) expect(getLibraryExerciseById(ex.id), ex.id).toBeDefined()
            }
          }
        }
      })
    })
  }
})
